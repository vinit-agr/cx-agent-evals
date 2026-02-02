## 1. StrategyContext extension

- [x] 1.1 Add `readonly embedder?: Embedder` to `StrategyContext` in `src/synthetic-datagen/strategies/types.ts`
- [x] 1.2 Add new progress event types to `ProgressEvent` union: `embedding-questions`, `embedding-passages`, `matching`
- [x] 1.3 Add `RealWorldGroundedStrategyOptions` interface to `types.ts`

## 2. Matching module

- [x] 2.1 Create `src/synthetic-datagen/strategies/real-world-grounded/matching.ts` with `splitIntoPassages()` function (split on `\n\n`, merge short paragraphs, cap ~500 chars)
- [x] 2.2 Add `embedInBatches()` utility that batches strings into groups of 100 and embeds in parallel with `Promise.all`
- [x] 2.3 Add `cosineSimilarity()` utility function
- [x] 2.4 Implement `matchQuestionsToDocuments()` — splits docs into passages, embeds passages + questions, computes cosine similarity, returns `Map<docId, MatchedQuestion[]>` filtered by threshold

## 3. Generation module

- [x] 3.1 Create `src/synthetic-datagen/strategies/real-world-grounded/generation.ts` with few-shot prompt construction
- [x] 3.2 Implement `generateFewShotQuestions()` — takes a document, few-shot examples, count, and LLM client; returns generated questions
- [x] 3.3 Add budget distribution logic: distribute `totalSyntheticQuestions` proportional to match count, with minimum 1 per unmatched doc

## 4. Strategy orchestrator

- [x] 4.1 Create `src/synthetic-datagen/strategies/real-world-grounded/generator.ts` with `RealWorldGroundedStrategy` class implementing `QuestionStrategy`
- [x] 4.2 Wire pipeline: validate embedder → match questions → Mode A (direct queries) → Mode B (few-shot generation) → combine results
- [x] 4.3 Emit progress events for each phase via `onProgress` callback
- [x] 4.4 Throw clear error if `context.embedder` is undefined

## 5. Library exports

- [x] 5.1 Export `RealWorldGroundedStrategy` and `RealWorldGroundedStrategyOptions` from `src/synthetic-datagen/index.ts`
- [x] 5.2 Export from `src/index.ts` (main library entry point)

## 6. Unit tests

- [x] 6.1 Test `splitIntoPassages()` — basic splitting, short paragraph merging, cap enforcement
- [x] 6.2 Test `cosineSimilarity()` — identical vectors, orthogonal vectors, known values
- [x] 6.3 Test `matchQuestionsToDocuments()` with mock embedder — threshold filtering, correct doc assignment
- [x] 6.4 Test `RealWorldGroundedStrategy.generate()` integration — mock LLM + mock embedder, verify both direct and generated queries in output
- [x] 6.5 Test error when embedder is missing

## 7. Frontend: Strategy selector update

- [x] 7.1 Add `"real-world-grounded"` to `StrategyType` union in `frontend/src/lib/types.ts`
- [x] 7.2 Add third card to `StrategySelector.tsx` for "Real-World Grounded"

## 8. Frontend: Real-world questions modal

- [x] 8.1 Create `frontend/src/components/RealWorldQuestionsModal.tsx` with two tabs: "Upload CSV" and "Paste"
- [x] 8.2 Implement CSV parsing (single column, skip header if present, trim whitespace)
- [x] 8.3 Implement paste parsing (split on newlines, trim, filter empty)
- [x] 8.4 Show question count and preview list in modal
- [x] 8.5 Save/Cancel buttons, call `onSave(questions: string[])` on save

## 9. Frontend: Config and state

- [x] 9.1 Add real-world questions state to `page.tsx` (`realWorldQuestions`, `totalSyntheticQuestions`)
- [x] 9.2 Add localStorage persistence for real-world questions (load on mount, save on modal save) under key `rag-eval:real-world-questions`
- [x] 9.3 Add real-world grounded config section to `GenerateConfig.tsx` — show question count + Edit button or "Set Up Questions" button, synthetic budget input
- [x] 9.4 Disable Generate button when strategy is real-world-grounded and no questions are loaded

## 10. Frontend: API route

- [x] 10.1 Add `realWorldQuestions` and `totalSyntheticQuestions` params to route request schema
- [x] 10.2 Add `real-world-grounded` branch in strategy dispatch — create `OpenAIEmbedder`, build `StrategyContext` with embedder, instantiate `RealWorldGroundedStrategy`, wire progress events to SSE, stream results
- [x] 10.3 Extend `page.tsx` `handleGenerate` to include real-world params in request body

## 11. Build and verify

- [x] 11.1 Run `npm run build` at project root — verify library compiles
- [x] 11.2 Run `pnpm run build` in frontend — verify Next.js build passes
- [x] 11.3 Run `npx vitest run` — verify all tests pass
