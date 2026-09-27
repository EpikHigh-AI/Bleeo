import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { build } from "esbuild";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const headlines = JSON.parse(await readFile(new URL("../tests/fixtures/headlines.json", import.meta.url), "utf8"));
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== "--baseline")) {
  throw new Error("Usage: npm run evaluate -- [--baseline <git-ref>]");
}

async function loadDetector(ref) {
  const input = ref
    ? { stdin: {
        contents: execFileSync("git", ["show", `${ref}:src/shared/heuristics.ts`], { cwd: projectRoot, encoding: "utf8" }),
        resolveDir: path.join(projectRoot, "src/shared"),
        loader: "ts"
      } }
    : { entryPoints: [path.join(projectRoot, "src/shared/heuristics.ts")] };
  const result = await build({ ...input, bundle: true, write: false, platform: "node", format: "esm", logLevel: "silent" });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].contents).toString("base64")}`);
}

function evaluate(detector, sensitivity) {
  const counts = { truePositive: 0, falsePositive: 0, trueNegative: 0, falseNegative: 0 };
  const errors = [];
  for (const { text, label } of headlines) {
    const result = detector.classifyCandidates([{ id: "headline", text }], sensitivity, "bbc.com")[0];
    // Include collection eligibility; a correct score cannot help a title that is never scanned.
    const actual = detector.isCandidateText(text) ? result.label : "safe";
    const expectedPositive = label === "sensational";
    const actualPositive = actual === "sensational";
    const key = expectedPositive
      ? (actualPositive ? "truePositive" : "falseNegative")
      : (actualPositive ? "falsePositive" : "trueNegative");
    counts[key] += 1;
    if (label !== actual) errors.push({ expected: label, actual, text });
  }
  const precision = counts.truePositive / (counts.truePositive + counts.falsePositive || 1);
  const recall = counts.truePositive / (counts.truePositive + counts.falseNegative || 1);
  return { sensitivity, ...counts, precision: precision.toFixed(3), recall: recall.toFixed(3), errors };
}

console.log(`Authored regression set: ${headlines.length} headlines; not an independent accuracy benchmark.`);
console.log("Hostname: bbc.com (existing social uppercase rules are covered separately by tests).");
for (const ref of [...(args.length ? [args[1]] : []), undefined]) {
  const detector = await loadDetector(ref);
  console.log(`\n${ref ? `Baseline ${ref}` : "Current working tree"}`);
  const reports = ["low", "medium", "high"].map((sensitivity) => evaluate(detector, sensitivity));
  console.table(reports.map(({ errors, ...report }) => report));
  for (const error of reports.find(({ sensitivity }) => sensitivity === "medium").errors) {
    console.log(`${error.expected} → ${error.actual}: ${error.text}`);
  }
}
