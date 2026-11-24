import "server-only";

export type AIProviderName = "openai" | "anthropic" | "ollama" | "nvidia";

export interface GenerateInput {
  instruction: string;
  currentCode: string;
  requirements: Array<{ title: string; details: string }>;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  attachmentContext?: string;
  images?: Array<{ mimeType: string; base64: string }>;
}

export interface AIProvider {
  generate(input: GenerateInput): Promise<string>;
}

export type NvidiaMessage = {
  role: "system" | "user" | "assistant";
  content: string | Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  >;
};

export class AIProviderError extends Error {
  constructor(message: string, readonly status = 502) {
    super(message);
    this.name = "AIProviderError";
  }
}

function cleanGeneratedCode(content: string) {
  return content.replace(/^```(?:tsx|typescript|jsx)?\s*/i, "").replace(/\s*```$/, "");
}

function buildPrompt(input: GenerateInput) {
  const requirements = input.requirements
    .map((item) => `- ${item.title}: ${item.details}`)
    .join("\n");
  return [
    "Act as a senior React product engineer and build a complete, polished, functional app from the user's request.",
    "Return only a complete TSX module with a default-exported React component, without Markdown fences or explanation.",
    "Implement the requested screens and interactions, with responsive and accessible UI. Use realistic sample content where useful.",
    "Keep the app self-contained: use React, standard HTML elements, and inline styles only. Do not import packages, use remote assets, or rely on a backend or network access.",
    "When updating existing code, preserve its working features and make only the requested changes.",
    `Conversation:\n${input.history?.map((message) => `${message.role}: ${message.content}`).join("\n") || "No previous messages."}`,
    `Requirements:\n${requirements || "None provided."}`,
    `Attached files:\n${input.attachmentContext || "No attachments."}`,
    `User request:\n${input.instruction}`,
    `Existing source:\n${input.currentCode || "(No source yet; create a complete React component.)"}`,
  ].join("\n\n");
}

async function requestNvidia(messages: NvidiaMessage[], model: string, maxTokens: number, temperature: number) {
  const key = process.env.NVIDIA_API_KEY;
  if (!key) throw new AIProviderError("NVIDIA_API_KEY is not configured", 503);
  const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!response.ok) {
    throw new AIProviderError(`NVIDIA request failed (${response.status})`);
  }
  const data: unknown = await response.json();
  const content = (data as { choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }> })
    .choices?.[0]?.message?.content;
  const text = typeof content === "string"
    ? content
    : content?.filter((item) => item.type === "text").map((item) => item.text ?? "").join("");
  if (!text) throw new AIProviderError("NVIDIA returned an empty response");
  return text;
}

export class OpenAIProvider implements AIProvider {
  async generate(input: GenerateInput) {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("OPENAI_API_KEY is not configured");
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [{ role: "user", content: buildPrompt(input) }],
        max_completion_tokens: 8192,
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(90_000),
    });
    if (!response.ok) {
      throw new Error(`OpenAI request failed (${response.status})`);
    }
    const data: unknown = await response.json();
    const content = (data as { choices?: Array<{ message?: { content?: string } }> })
      .choices?.[0]?.message?.content;
    if (!content) throw new Error("OpenAI returned an empty response");
    return cleanGeneratedCode(content);
  }
}

export class AnthropicProvider implements AIProvider {
  async generate(input: GenerateInput) {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error("ANTHROPIC_API_KEY is not configured");
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001",
        max_tokens: 8192,
        messages: [{ role: "user", content: buildPrompt(input) }],
      }),
      signal: AbortSignal.timeout(90_000),
    });
    if (!response.ok) {
      throw new Error(`Anthropic request failed (${response.status})`);
    }
    const data: unknown = await response.json();
    const content = (data as { content?: Array<{ type: string; text?: string }> })
      .content?.find((item) => item.type === "text")?.text;
    if (!content) throw new Error("Anthropic returned an empty response");
    return cleanGeneratedCode(content);
  }
}

export class NvidiaProvider implements AIProvider {
  async generate(input: GenerateInput) {
    const userContent = [
      { type: "text" as const, text: buildPrompt(input) },
      ...(input.images ?? []).map(({ mimeType, base64 }) => ({
        type: "image_url" as const,
        image_url: { url: `data:${mimeType};base64,${base64}` },
      })),
    ];
    const content = await requestNvidia(
      [{ role: "user", content: userContent }],
      input.images?.length
        ? process.env.NVIDIA_VISION_MODEL || "moonshotai/kimi-k3.1-pro"
        : process.env.NVIDIA_MODEL || "google/gemma-4-31b-it",
      8192,
      0.3,
    );
    return cleanGeneratedCode(content);
  }

  async chat(messages: NvidiaMessage[]) {
    const hasImage = messages.some((message) => Array.isArray(message.content)
      && message.content.some((part) => part.type === "image_url"));
    return requestNvidia(
      messages,
      hasImage
        ? process.env.NVIDIA_VISION_MODEL || "moonshotai/kimi-k3.1-pro"
        : process.env.NVIDIA_CHAT_MODEL || process.env.NVIDIA_MODEL || "google/gemma-4-31b-it",
      4096,
      0.5,
    );
  }

  async generateImage(prompt: string) {
    const key = process.env.NVIDIA_API_KEY;
    if (!key) throw new AIProviderError("NVIDIA_API_KEY is not configured", 503);
    const model = process.env.NVIDIA_IMAGE_MODEL || "stabilityai/stable-diffusion-3-medium";
    const response = await fetch(`https://ai.api.nvidia.com/v1/genai/${model}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        steps: 50,
        cfg_scale: 5,
        aspect_ratio: "1:1",
        seed: 0,
      }),
      signal: AbortSignal.timeout(180_000),
    });
    if (!response.ok) {
      throw new AIProviderError(`NVIDIA image generation failed (${response.status})`);
    }
    const data: unknown = await response.json();
    const image = (data as { image?: string }).image;
    if (!image) throw new AIProviderError("NVIDIA returned no generated image");
    return `data:image/jpeg;base64,${image}`;
  }
}

function ollamaBaseUrl() {
  return (process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434").replace(/\/+$/, "");
}

export async function isOllamaAvailable() {
  try {
    const response = await fetch(`${ollamaBaseUrl()}/api/tags`, {
      signal: AbortSignal.timeout(1500),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export class OllamaProvider implements AIProvider {
  async generate(input: GenerateInput) {
    const response = await fetch(`${ollamaBaseUrl()}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OLLAMA_MODEL || "qwen2.5-coder:0.5b",
        stream: false,
        messages: [{ role: "user", content: buildPrompt(input) }],
        options: { temperature: 0.3, num_ctx: 4096, num_predict: 3072 },
      }),
      signal: AbortSignal.timeout(180_000),
    });
    if (!response.ok) throw new Error(`Ollama request failed (${response.status})`);
    const data: unknown = await response.json();
    const content = (data as { message?: { content?: string } }).message?.content;
    if (!content) throw new Error("Ollama returned an empty response");
    return cleanGeneratedCode(content);
  }
}

export function createAIProvider(name: AIProviderName): AIProvider {
  if (name === "openai") return new OpenAIProvider();
  if (name === "anthropic") return new AnthropicProvider();
  if (name === "nvidia") return new NvidiaProvider();
  return new OllamaProvider();
}
