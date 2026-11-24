import { describe, expect, it } from "vitest";
import { compilePreview, PreviewCompileError } from "./preview";

describe("isolated preview compiler", () => {
  it("bundles a default-exported TSX component and its React runtime", async () => {
    const javascript = await compilePreview(
      'export default function App() { return <main>Hello</main>; }',
    );

    expect(javascript).toContain("Hello");
    expect(javascript).toContain("createRoot");
    expect(javascript).not.toContain('from "react"');
  });

  it("rejects unavailable third-party packages", async () => {
    await expect(
      compilePreview('import Widget from "untrusted-package"; export default Widget;'),
    ).rejects.toBeInstanceOf(PreviewCompileError);
  });
});
