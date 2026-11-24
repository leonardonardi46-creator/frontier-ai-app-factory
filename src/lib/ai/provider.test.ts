import { afterEach, describe, expect, it, vi } from "vitest";
import { NvidiaProvider } from "./provider";

const originalApiKey = process.env.NVIDIA_API_KEY;
const originalChatModel = process.env.NVIDIA_CHAT_MODEL;
const originalVisionModel = process.env.NVIDIA_VISION_MODEL;
const originalImageModel = process.env.NVIDIA_IMAGE_MODEL;

afterEach(() => {
  vi.unstubAllGlobals();
  for (const [name, value] of [
    ["NVIDIA_API_KEY", originalApiKey],
    ["NVIDIA_CHAT_MODEL", originalChatModel],
    ["NVIDIA_VISION_MODEL", originalVisionModel],
    ["NVIDIA_IMAGE_MODEL", originalImageModel],
  ] as const) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

describe("NVIDIA provider", () => {
  it("uses the NVIDIA NIM endpoint and returns generated TSX", async () => {
    process.env.NVIDIA_API_KEY = "test-key";
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({
        choices: [{ message: { content: "```tsx\nexport default function App() { return <main />; }\n```" } }],
      })),
    );
    vi.stubGlobal("fetch", fetchMock);

    const code = await new NvidiaProvider().generate({
      instruction: "Create an app",
      currentCode: "",
      requirements: [],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://integrate.api.nvidia.com/v1/chat/completions",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer test-key" }),
        body: expect.stringContaining('"model":"google/gemma-4-31b-it"'),
      }),
    );
    expect(code).toBe("export default function App() { return <main />; }");
  });

  it("fails explicitly when the API key is missing", async () => {
    delete process.env.NVIDIA_API_KEY;

    await expect(new NvidiaProvider().generate({
      instruction: "Create an app",
      currentCode: "",
      requirements: [],
    })).rejects.toThrow("NVIDIA_API_KEY is not configured");
  });

  it("uses the vision model for chat messages with images", async () => {
    process.env.NVIDIA_API_KEY = "test-key";
    process.env.NVIDIA_VISION_MODEL = "test/vision-model";
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({
        choices: [{ message: { content: "This image shows a cat." } }],
      })),
    );
    vi.stubGlobal("fetch", fetchMock);

    const message = await new NvidiaProvider().chat([{
      role: "user",
      content: [
        { type: "text", text: "What is in this image?" },
        { type: "image_url", image_url: { url: "data:image/png;base64,dGVzdA==" } },
      ],
    }]);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://integrate.api.nvidia.com/v1/chat/completions",
      expect.objectContaining({ body: expect.stringContaining('"model":"test/vision-model"') }),
    );
    expect(message).toBe("This image shows a cat.");
  });

  it("returns an NVIDIA-generated image as a data URL", async () => {
    process.env.NVIDIA_API_KEY = "test-key";
    process.env.NVIDIA_IMAGE_MODEL = "test/image-model";
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ image: "aW1hZ2U=" })),
    );
    vi.stubGlobal("fetch", fetchMock);

    const image = await new NvidiaProvider().generateImage("A mountain landscape");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://ai.api.nvidia.com/v1/genai/test/image-model",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer test-key" }),
        body: expect.stringContaining('"prompt":"A mountain landscape"'),
      }),
    );
    expect(image).toBe("data:image/jpeg;base64,aW1hZ2U=");
  });
});
