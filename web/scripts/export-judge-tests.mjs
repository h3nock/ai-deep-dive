import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const webRoot = process.cwd();
const problemsRoot = path.resolve(webRoot, "..", "judge", "problems");
const outRoot = path.resolve(webRoot, "public", "judge-tests");
const contentRoot = path.resolve(webRoot, "content");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data));
}

function walkManifests(dir, manifests = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkManifests(full, manifests);
    } else if (entry.isFile() && entry.name === "manifest.json") {
      manifests.push(full);
    }
  }
  return manifests;
}

function walkDescriptions(dir, descriptions = []) {
  if (!fs.existsSync(dir)) return descriptions;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDescriptions(full, descriptions);
    } else if (entry.isFile() && entry.name === "description.md") {
      descriptions.push(full);
    }
  }
  return descriptions;
}

function checkPublicBundles() {
  const missing = [];
  const missingProblemId = [];
  const emptyPublic = [];

  if (!fs.existsSync(contentRoot)) {
    return { missing, missingProblemId, emptyPublic };
  }

  const descriptions = walkDescriptions(contentRoot);
  for (const descPath of descriptions) {
    const raw = fs.readFileSync(descPath, "utf8");
    const { data } = matter(raw);
    const problemId = data?.problemId;
    if (!problemId) {
      missingProblemId.push(path.relative(contentRoot, descPath));
      continue;
    }

    const problemDir = path.join(problemsRoot, ...String(problemId).split("/"));
    const manifestPath = path.join(problemDir, "manifest.json");
    const publicTestsPath = path.join(problemDir, "public_tests.json");

    if (!fs.existsSync(manifestPath) || !fs.existsSync(publicTestsPath)) {
      missing.push(problemId);
      continue;
    }

    try {
      const tests = readJson(publicTestsPath);
      const cases = Array.isArray(tests?.cases) ? tests.cases : (Array.isArray(tests) ? tests : []);
      if (cases.length === 0) {
        emptyPublic.push(problemId);
      }
    } catch {
      missing.push(problemId);
    }
  }

  return { missing, missingProblemId, emptyPublic };
}

if (!fs.existsSync(problemsRoot)) {
  console.error("No judge/problems directory found.");
  process.exit(1);
}

const { missing, missingProblemId, emptyPublic } = checkPublicBundles();
if (missingProblemId.length > 0) {
  console.error("Some challenges are missing problemId in description.md:");
  for (const rel of missingProblemId) {
    console.error(`  - ${rel}`);
  }
}
if (missing.length > 0) {
  console.error("Missing public tests for these problem ids:");
  for (const problemId of missing) {
    console.error(`  - ${problemId}`);
  }
}
if (emptyPublic.length > 0) {
  console.warn("Warning: public_tests.json has zero cases for:");
  for (const problemId of emptyPublic) {
    console.warn(`  - ${problemId}`);
  }
}
if (missingProblemId.length > 0 || missing.length > 0) {
  process.exit(1);
}

if (fs.existsSync(outRoot)) {
  fs.rmSync(outRoot, { recursive: true, force: true });
}

const manifests = walkManifests(problemsRoot);
let exportedCount = 0;
for (const manifestPath of manifests) {
  const problemDir = path.dirname(manifestPath);
  const publicTestsPath = path.join(problemDir, "public_tests.json");
  if (!fs.existsSync(publicTestsPath)) continue;

  const manifest = readJson(manifestPath);
  const tests = readJson(publicTestsPath);
  const version = String(manifest.version || "v1");

  const rel = path.relative(problemsRoot, problemDir);
  const outDir = path.join(outRoot, rel);

  const bundleName = `public_bundle.${version}.json`;
  const bundle = {
    version,
    runner: manifest.runner || "",
    comparison: manifest.comparison || { type: "exact" },
    tests,
  };

  writeJson(path.join(outDir, bundleName), bundle);

  const publicManifest = {
    problem_id: manifest.id || rel,
    version,
    bundle: bundleName,
    runner: manifest.runner || "",
    comparison: manifest.comparison || { type: "exact" },
  };

  writeJson(path.join(outDir, "public_manifest.json"), publicManifest);
  exportedCount += 1;
}

console.log(`Exported ${exportedCount} public bundle(s) to ${outRoot}`);
