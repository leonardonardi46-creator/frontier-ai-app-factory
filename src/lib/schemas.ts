import { z } from "zod";

export const credentialsSchema = z.object({
  email: z.string().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(12).max(72).refine(
    (value) => new TextEncoder().encode(value).length <= 72,
    "Password must not exceed 72 UTF-8 bytes",
  ),
});

export const projectCreateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(2000).optional().default(""),
});

export const projectUpdateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(2000).optional(),
});

export const requirementCreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  details: z.string().trim().max(4000).optional().default(""),
});

export const requirementUpdateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  details: z.string().trim().max(4000).optional(),
  completed: z.boolean().optional(),
});

export const codeUpdateSchema = z.object({
  code: z.string().max(500_000),
  label: z.string().trim().min(1).max(120).optional().default("Manual checkpoint"),
});

export const generateSchema = z.object({
  instruction: z.string().trim().min(1).max(8000),
  provider: z.enum(["openai", "anthropic", "ollama"]).optional(),
  currentCode: z.string().max(500_000).optional(),
});
