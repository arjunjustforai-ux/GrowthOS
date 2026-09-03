// Resolves TypeScript-style imports ("@/..." aliases and extensionless relative
// paths) for plain `node` runs, so the engine can be exercised from a script
// without a bundler. Used by scripts/verify-engine.mjs.
import { pathToFileURL, fileURLToPath } from "node:url";
import { statSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

function firstExisting(base) {
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")]) {
    try {
      if (statSync(candidate).isFile()) return pathToFileURL(candidate).href;
    } catch {
      /* try next candidate */
    }
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const hit = firstExisting(path.join(root, "src", specifier.slice(2)));
    if (hit) return { url: hit, shortCircuit: true };
  }
  if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
    const base = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
    const hit = firstExisting(base);
    if (hit) return { url: hit, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
