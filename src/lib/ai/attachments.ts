import "server-only";
import { get } from "@vercel/blob";

export type AttachmentReference = {
  pathname: string;
  name: string;
};

export type AttachmentImage = {
  mimeType: string;
  base64: string;
};

export type LoadedAttachments = {
  context: string;
  images: AttachmentImage[];
};

const TEXT_LIMIT_BYTES = 256 * 1024;
const PDF_LIMIT_BYTES = 10 * 1024 * 1024;
const IMAGE_LIMIT_BYTES = 4 * 1024 * 1024;
const TOTAL_IMAGE_LIMIT_BYTES = 8 * 1024 * 1024;
const TEXT_LIMIT_CHARS = 12_000;
const textExtensions = new Set([
  "c", "cc", "cpp", "css", "csv", "go", "h", "html", "java", "js", "json", "jsx",
  "log", "md", "mjs", "py", "rb", "rs", "sh", "sql", "svg", "toml", "ts", "tsx",
  "txt", "xml", "yaml", "yml",
]);
const imageMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

async function readPrefix(stream: ReadableStream<Uint8Array>, limit: number, fullSize: number) {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (total < limit) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = value.subarray(0, limit - total);
      chunks.push(chunk);
      total += chunk.byteLength;
      if (total >= limit && fullSize > total) {
        await reader.cancel();
        break;
      }
    }
  } finally {
    reader.releaseLock();
  }
  return { bytes: Buffer.concat(chunks), truncated: fullSize > total };
}

function isTextFile(name: string, contentType: string) {
  const extension = name.split(".").pop()?.toLowerCase() ?? "";
  return contentType.startsWith("text/") || [
    "application/json",
    "application/javascript",
    "application/xml",
    "application/x-yaml",
  ].includes(contentType) || textExtensions.has(extension);
}

async function extractPdfText(bytes: Buffer) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const document = await pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: true }).promise;
  try {
    const pages = Math.min(document.numPages, 20);
    const parts: string[] = [];
    for (let pageNumber = 1; pageNumber <= pages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      parts.push(content.items.flatMap((item) => "str" in item ? [item.str] : []).join(" "));
      if (parts.join("\n").length >= TEXT_LIMIT_CHARS) break;
    }
    return parts.join("\n").slice(0, TEXT_LIMIT_CHARS);
  } finally {
    await document.cleanup();
  }
}

export async function loadAttachments(projectId: string, attachments: AttachmentReference[]): Promise<LoadedAttachments> {
  const context: string[] = [];
  const images: AttachmentImage[] = [];
  let totalImageBytes = 0;
  for (const attachment of attachments) {
    if (!attachment.pathname.startsWith(`chat/${projectId}/`)) {
      throw new Error("An attachment does not belong to this project");
    }
    const result = await get(attachment.pathname, { access: "private" });
    if (!result || result.statusCode !== 200 || !result.stream) {
      throw new Error(`Unable to retrieve attachment: ${attachment.name}`);
    }

    const { contentType, size } = result.blob;
    const header = `File: ${attachment.name} (${contentType}, ${size} bytes)`;
    if (imageMimeTypes.has(contentType)) {
      if (size > IMAGE_LIMIT_BYTES || totalImageBytes + size > TOTAL_IMAGE_LIMIT_BYTES) {
        context.push(`${header}\nImage is attached but was omitted from the model request (4 MiB per-image and 8 MiB total image limits).`);
        await result.stream.cancel();
      } else {
        const { bytes } = await readPrefix(result.stream, IMAGE_LIMIT_BYTES, size);
        images.push({ mimeType: contentType, base64: bytes.toString("base64") });
        totalImageBytes += size;
        context.push(`${header}\nImage included with the message.`);
      }
      continue;
    }

    if (contentType === "application/pdf" || attachment.name.toLowerCase().endsWith(".pdf")) {
      if (size > PDF_LIMIT_BYTES) {
        context.push(`${header}\nPDF is attached but too large for text extraction (10 MiB limit).`);
        await result.stream.cancel();
        continue;
      }
      const { bytes } = await readPrefix(result.stream, PDF_LIMIT_BYTES, size);
      const text = await extractPdfText(bytes);
      context.push(`${header}\nExtracted PDF text${text.length >= TEXT_LIMIT_CHARS ? " (truncated)" : ""}:\n${text || "(No extractable text; scanned pages may require OCR.)"}`);
      continue;
    }

    if (isTextFile(attachment.name, contentType)) {
      const { bytes, truncated } = await readPrefix(result.stream, TEXT_LIMIT_BYTES, size);
      const text = new TextDecoder().decode(bytes).slice(0, TEXT_LIMIT_CHARS);
      context.push(`${header}\nExtracted text${truncated || text.length >= TEXT_LIMIT_CHARS ? " (truncated)" : ""}:\n${text}`);
      continue;
    }

    context.push(`${header}\nFile is attached, but this file format is not supported for content extraction.`);
    await result.stream.cancel();
  }
  return { context: context.join("\n\n"), images };
}
