import { z } from 'zod';

const componentExampleInfoSchema = z.object({
    displayName: z.string(),
    relativePath: z.string(),
});

export const componentGalleryParamsSchema = z.object({
    columns: z.number().default(2),
    examples: z.array(componentExampleInfoSchema).default([]),
    selectedExamplePath: z.string().optional(),
    random: z.number().optional(),
});

export type ComponentExampleInfo = z.infer<typeof componentExampleInfoSchema>;
export type ComponentGalleryParams = z.infer<typeof componentGalleryParamsSchema>;
