import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

process.on("uncaughtException", (error) => {
  console.error(`Release readiness failed: ${error.message}`);
  process.exitCode = 1;
});

const root = resolve(import.meta.dirname, "..");
const requireEnvironment = process.argv.includes("--require-env");
const checks = [];
const warnings = [];

function pass(message) {
  checks.push(message);
}

function requiredFile(relativePath, minimumBytes = 1) {
  const absolutePath = resolve(root, relativePath);
  assert.ok(existsSync(absolutePath), `Missing required file: ${relativePath}`);
  assert.ok(
    statSync(absolutePath).size >= minimumBytes,
    `${relativePath} is unexpectedly empty`,
  );
  pass(relativePath);
  return absolutePath;
}

function pngDimensions(relativePath, expectedWidth, expectedHeight) {
  const bytes = readFileSync(requiredFile(relativePath, 100));
  assert.equal(
    bytes.toString("hex", 0, 8),
    "89504e470d0a1a0a",
    `${relativePath} is not a PNG`,
  );
  assert.equal(
    bytes.readUInt32BE(16),
    expectedWidth,
    `${relativePath} has the wrong width`,
  );
  assert.equal(
    bytes.readUInt32BE(20),
    expectedHeight,
    `${relativePath} has the wrong height`,
  );
}

function loadLocalEnvironment() {
  const values = { ...process.env };
  for (const filename of [".env", ".env.local"]) {
    const path = resolve(root, filename);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (!match || values[match[1]]) continue;
      values[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
    }
  }
  return values;
}

pngDimensions("public/icon-192.png", 192, 192);
pngDimensions("public/icon-512.png", 512, 512);
pngDimensions("public/icon-maskable-512.png", 512, 512);
requiredFile("public/apple-touch-icon.png", 100);
requiredFile("public/offline.html", 500);
const worker = readFileSync(requiredFile("public/sw.js", 500), "utf8");
assert.match(worker, /offline\.html/, "Service worker has no offline fallback");
assert.match(
  worker,
  /hostname\.includes\("supabase"\)/,
  "Service worker must bypass Supabase",
);
pass("service-worker privacy rules");

const migrations = readdirSync(resolve(root, "supabase/migrations"))
  .filter((file) => /^\d{4}_.+\.sql$/.test(file))
  .sort();
assert.ok(migrations.length >= 5, "Expected all Pagewise Supabase migrations");
migrations.forEach((file, index) =>
  assert.equal(
    Number(file.slice(0, 4)),
    index + 1,
    `Migration sequence has a gap at ${file}`,
  ),
);
pass(`${migrations.length} ordered Supabase migrations`);

const environment = loadLocalEnvironment();
const supabaseUrl = environment.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseAnonKey = environment.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const groqKey = environment.GROQ_API_KEY?.trim();
const groqModel = environment.GROQ_METADATA_MODEL?.trim();
if (supabaseUrl && supabaseAnonKey) {
  const parsed = new URL(supabaseUrl);
  assert.equal(
    parsed.protocol,
    "https:",
    "Production Supabase URL must use HTTPS",
  );
  assert.ok(
    supabaseAnonKey.length >= 20,
    "Supabase anonymous key looks incomplete",
  );
  pass("Supabase public environment");
} else if (requireEnvironment) {
  assert.fail(
    "Production release requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY",
  );
} else {
  warnings.push(
    "Supabase environment is not configured; preview mode remains active",
  );
}

if (groqKey) {
  assert.ok(groqKey.length >= 20, "Groq API key looks incomplete");
  assert.ok(
    groqModel,
    "GROQ_METADATA_MODEL is required when AI metadata is enabled",
  );
  pass("optional AI metadata environment");
} else {
  warnings.push(
    "Groq environment is not configured; optional AI metadata review remains disabled",
  );
}

console.log(`Release readiness: ${checks.length} checks passed.`);
for (const check of checks) console.log(`  ✓ ${check}`);
for (const warning of warnings) console.log(`  ! ${warning}`);
