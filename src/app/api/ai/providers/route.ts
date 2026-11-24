import { NextResponse } from "next/server";
import { isOllamaAvailable } from "@/lib/ai/provider";

export async function GET() {
  const providers = [
    { id: "openai", configured: Boolean(process.env.OPENAI_API_KEY) },
    { id: "anthropic", configured: Boolean(process.env.ANTHROPIC_API_KEY) },
    { id: "ollama", configured: await isOllamaAvailable() },
  ];
  return NextResponse.json({ providers, defaultProvider: process.env.AI_PROVIDER || "openai" });
}
