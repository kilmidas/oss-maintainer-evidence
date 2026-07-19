import { z } from "zod";

export const repositorySchema = z
  .object({
    full_name: z.string(),
    private: z.boolean(),
    visibility: z.string().nullable().optional(),
    html_url: z.string().url(),
    default_branch: z.string(),
    fork: z.boolean().optional(),
  })
  .strip();

export const searchSchema = z
  .object({
    total_count: z.number().int().nonnegative(),
    incomplete_results: z.boolean(),
    items: z.array(z.unknown()),
  })
  .strip();

export type RepositoryResponse = z.infer<typeof repositorySchema>;
export type SearchResponse = z.infer<typeof searchSchema>;
