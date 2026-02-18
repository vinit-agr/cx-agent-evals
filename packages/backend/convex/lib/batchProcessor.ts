import { ActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { Id } from "../_generated/dataModel";

/** 8-minute time budget (2-minute safety margin before 10-minute timeout) */
const TIME_BUDGET_MS = 8 * 60 * 1000;

/** 11-minute watchdog delay (fires after action timeout) */
const WATCHDOG_DELAY_MS = 11 * 60 * 1000;

export interface BatchProcessorConfig<TItem, TResult> {
  /** The job ID to track progress */
  jobId: Id<"jobs">;
  /** The current phase name */
  phase: string;
  /** Max items to fetch per batch */
  batchSize: number;
  /** Process a single item, return the result */
  processItem: (item: TItem) => Promise<TResult>;
  /** Human-readable phase description for progress messages */
  phaseMessage: string;
  /**
   * The internal action to schedule for continuation.
   * Must accept { jobId: Id<"jobs"> } at minimum.
   */
  continuationAction: any; // FunctionReference
  /** Optional: additional args to pass when scheduling continuation */
  continuationArgs?: Record<string, unknown>;
  /**
   * Optional: action to schedule when this phase completes.
   * If not provided, the job stays in current phase (caller handles).
   */
  nextPhaseAction?: any; // FunctionReference
  /** Optional: args to pass to the next phase action */
  nextPhaseArgs?: Record<string, unknown>;
}

/**
 * Run a batch processing loop with time budget and per-item checkpointing.
 *
 * Pattern:
 * 1. Query for pending items
 * 2. Process each item within time budget
 * 3. Mark each item done/failed individually
 * 4. Update job progress
 * 5. Schedule continuation if more items remain
 * 6. Schedule next phase if all items done
 * 7. Schedule watchdog as safety net
 */
export async function processBatch<
  TItem extends { _id: Id<"jobItems">; itemKey: string },
  TResult,
>(ctx: ActionCtx, config: BatchProcessorConfig<TItem, TResult>): Promise<void> {
  const startTime = Date.now();

  // Update job to running
  await ctx.runMutation(internal.jobs.update, {
    jobId: config.jobId,
    status: "running",
    phase: config.phase,
  });

  // Schedule watchdog
  const currentProgress = await ctx.runQuery(internal.jobItems.getProgress, {
    jobId: config.jobId,
    phase: config.phase,
  });

  await ctx.scheduler.runAfter(WATCHDOG_DELAY_MS, internal.jobs.watchdog, {
    jobId: config.jobId,
    expectedPhase: config.phase,
    expectedProgress: currentProgress.done,
  });

  // Fetch pending items
  const items = (await ctx.runQuery(internal.jobItems.getPending, {
    jobId: config.jobId,
    phase: config.phase,
    limit: config.batchSize,
  })) as unknown as TItem[];

  // If no pending items, phase is complete
  if (items.length === 0) {
    await handlePhaseComplete(ctx, config);
    return;
  }

  // Process items within time budget
  let processedCount = 0;
  for (const item of items) {
    // Check time budget
    if (Date.now() - startTime > TIME_BUDGET_MS) {
      break;
    }

    try {
      const result = await config.processItem(item);
      await ctx.runMutation(internal.jobItems.markDone, {
        itemId: item._id,
        result: result as any,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      await ctx.runMutation(internal.jobItems.markFailed, {
        itemId: item._id,
        error: message,
      });
    }
    processedCount++;
  }

  // Update progress
  const progress = await ctx.runQuery(internal.jobItems.getProgress, {
    jobId: config.jobId,
    phase: config.phase,
  });

  await ctx.runMutation(internal.jobs.update, {
    jobId: config.jobId,
    progress: {
      current: progress.done,
      total: progress.total,
      message: `${config.phaseMessage}... ${progress.done}/${progress.total}`,
    },
  });

  // If there are still pending items, schedule continuation
  if (progress.pending > 0) {
    await ctx.scheduler.runAfter(0, config.continuationAction, {
      jobId: config.jobId,
      ...(config.continuationArgs ?? {}),
    });
  } else {
    // Phase complete
    await handlePhaseComplete(ctx, config);
  }
}

async function handlePhaseComplete<TItem, TResult>(
  ctx: ActionCtx,
  config: BatchProcessorConfig<TItem, TResult>,
): Promise<void> {
  if (config.nextPhaseAction) {
    await ctx.scheduler.runAfter(0, config.nextPhaseAction, {
      jobId: config.jobId,
      ...(config.nextPhaseArgs ?? {}),
    });
  } else {
    // No next phase — mark job complete
    await ctx.runMutation(internal.jobs.update, {
      jobId: config.jobId,
      status: "completed",
    });
  }
}
