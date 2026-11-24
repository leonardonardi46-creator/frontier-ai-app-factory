import { build, type BuildFailure } from "esbuild";

export async function compilePreview(code: string) {
  try {
    const result = await build({
      stdin: {
        contents: `import React from "react";\nimport { createRoot } from "react-dom/client";\nimport App from "virtual:frontier-app";\ncreateRoot(document.getElementById("root")).render(React.createElement(App));`,
        resolveDir: process.cwd(),
        sourcefile: "frontier-preview.tsx",
        loader: "tsx",
      },
      bundle: true,
      write: false,
      logLevel: "silent",
      format: "iife",
      platform: "browser",
      target: "es2020",
      jsx: "automatic",
      plugins: [{
        name: "sandbox-entry",
        setup(buildApi) {
          buildApi.onResolve({ filter: /^virtual:frontier-app$/ }, () => ({
            path: "virtual:frontier-app",
            namespace: "frontier",
          }));
          buildApi.onLoad({ filter: /.*/, namespace: "frontier" }, () => ({
            contents: code,
            loader: "tsx",
            resolveDir: process.cwd(),
          }));
          buildApi.onResolve({ filter: /.*/, namespace: "frontier" }, (args) => {
            if (args.path === "react" || args.path.startsWith("react/")) return;
            if (args.path === "react-dom/client") return;
            return { errors: [{ text: `Preview dependency "${args.path}" is not available in the isolated preview.` }] };
          });
        },
      }],
    });
    return result.outputFiles[0].text;
  } catch (error) {
    if (error instanceof Error && "errors" in error) {
      const failure = error as BuildFailure;
      throw new PreviewCompileError(failure.errors.map((item) => item.text).join("\n"));
    }
    throw error;
  }
}

export class PreviewCompileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PreviewCompileError";
  }
}
