import fs from "node:fs";
import path from "node:path";

const webRoot = process.cwd();
const problemsRoot = path.resolve(webRoot, "..", "judge", "problems");
const outRoot = path.resolve(webRoot, "public", "judge-tests");

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

if (!fs.existsSync(problemsRoot)) {
  console.error("No judge/problems directory found.");
  process.exit(0);
}

if (fs.existsSync(outRoot)) {
  fs.rmSync(outRoot, { recursive: true, force: true });
}

const manifests = walkManifests(problemsRoot);
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
}

console.log(`Exported ${manifests.length} manifest(s) to ${outRoot}`);
