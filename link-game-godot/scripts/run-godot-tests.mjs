import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const runTestsGd = resolve(projectRoot, "run_tests.gd");

/**
 * Resolve Godot executable: GODOT / GODOT_BIN env, then `godot` on PATH.
 * @returns {string | null}
 */
export function resolveGodotExecutable() {
  const fromEnv = process.env.GODOT ?? process.env.GODOT_BIN;
  if (fromEnv && fromEnv.trim().length > 0) {
    return fromEnv.trim();
  }
  return "godot";
}

/**
 * @param {{ godotExe?: string }} [opts]
 * @returns {{ code: number | null; signal: NodeJS.Signals | null; error?: Error }}
 */
export function runGodotHeadlessTests(opts = {}) {
  const godotExe = opts.godotExe ?? resolveGodotExecutable();
  if (!existsSync(runTestsGd)) {
    return {
      code: 1,
      signal: null,
      error: new Error(`missing ${runTestsGd}`),
    };
  }

  const r = spawnSync(
    godotExe,
    ["--headless", "-s", "run_tests.gd"],
    {
      cwd: projectRoot,
      stdio: "inherit",
      shell: false,
    },
  );

  if (r.error) {
    return { code: 1, signal: null, error: r.error };
  }
  return { code: r.status ?? 1, signal: r.signal };
}

function main() {
  const result = runGodotHeadlessTests();
  if (result.error) {
    console.error("[test:godot]", result.error.message);
    process.exit(1);
  }
  if (result.code !== 0) {
    if (result.code == null) {
      console.error("[test:godot] Godot exited abnormally (no exit code).");
      process.exit(1);
    }
    console.error(
      `[test:godot] Godot tests failed (exit ${result.code}). Is 'godot' on PATH? Set GODOT or GODOT_BIN to the editor binary.`,
    );
    process.exit(result.code);
  }
  console.log("[test:godot] OK");
}

const _thisFile = fileURLToPath(import.meta.url);
const _invoked = process.argv[1] ? resolve(process.argv[1]) : "";
if (_invoked && resolve(_invoked) === resolve(_thisFile)) {
  main();
}
