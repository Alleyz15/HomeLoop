import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { parseEnv } from "node:util";
import { fileURLToPath } from "node:url";

export const EXPECTED_COUNTS = Object.freeze({
  transactions: 120191,
  sdp_schemes: 48,
  mhpi_quarterly: 3500,
  cost_assumptions: 6,
  fairness_curve: 72,
  backtest_results: 24,
});

function isPermissionDenied(error) {
  if (!error) {
    return false;
  }

  const message = String(error.message ?? "");
  return (
    String(error.code ?? "") === "42501" ||
    /permission denied|row-level security/i.test(message)
  );
}

export async function runChecks(supabase, writeLine = console.log) {
  let failed = false;

  for (const [table, expected] of Object.entries(EXPECTED_COUNTS)) {
    const { count, error } = await supabase
      .from(table)
      .select("*", { count: "exact", head: true });

    if (error || count === null) {
      writeLine(`${table}: FAIL`);
      failed = true;
      continue;
    }

    const passed = count === expected;
    writeLine(`${table}: ${count} ${passed ? "PASS" : "FAIL"}`);
    failed ||= !passed;
  }

  const { data: probeRow, error: probeError } = await supabase
    .from("cost_assumptions")
    .select("*")
    .limit(1)
    .single();

  if (probeError || !probeRow) {
    writeLine("cost_assumptions anon insert: FAIL");
    return 1;
  }

  const { error: insertError } = await supabase
    .from("cost_assumptions")
    .insert(probeRow);
  const insertDenied = isPermissionDenied(insertError);
  writeLine(`cost_assumptions anon insert: ${insertDenied ? "PASS" : "FAIL"}`);

  return failed || !insertDenied ? 1 : 0;
}

async function main() {
  try {
    const scriptPath = fileURLToPath(import.meta.url);
    const repositoryRoot = path.resolve(path.dirname(scriptPath), "..");
    const webDirectory = path.join(repositoryRoot, "apps", "web");
    const env = parseEnv(
      readFileSync(path.join(webDirectory, ".env.local"), "utf8"),
    );
    const url = env.NEXT_PUBLIC_SUPABASE_URL;
    const publishableKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !publishableKey) {
      console.log("setup: FAIL");
      return 1;
    }

    const require = createRequire(path.join(webDirectory, "package.json"));
    const { createClient } = require("@supabase/supabase-js");
    const supabase = createClient(url, publishableKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    });

    return await runChecks(supabase);
  } catch {
    console.log("setup: FAIL");
    return 1;
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
