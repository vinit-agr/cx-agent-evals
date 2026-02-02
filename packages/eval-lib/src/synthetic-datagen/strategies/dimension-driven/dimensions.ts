import { z } from "zod";
import { readFile } from "node:fs/promises";
import type { Dimension } from "../types.js";

export const DimensionSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  values: z.array(z.string().min(1)).min(2),
});

export const DimensionsFileSchema = z.object({
  dimensions: z.array(DimensionSchema).min(1),
});

export async function loadDimensions(filePath: string): Promise<Dimension[]> {
  const raw = await readFile(filePath, "utf-8");
  const parsed = DimensionsFileSchema.parse(JSON.parse(raw));
  return parsed.dimensions;
}
