import { z } from "zod";

import { PROJECT_NAME_MAX } from "@/lib/domain/project";

export const projectInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(PROJECT_NAME_MAX),
});

export type ProjectInput = z.infer<typeof projectInputSchema>;
