import assert from "node:assert/strict";
import test from "node:test";

import {
  EXPECTED_COUNTS,
  runChecks,
} from "./check_supabase_read.mjs";

const probeRow = {
  item: "Legal fees",
  pct_low: 0.01,
  pct_high: 0.02,
  source: "test fixture",
};

function fakeClient({
  counts = EXPECTED_COUNTS,
  countErrors = {},
  insertError = { code: "42501", message: "permission denied" },
} = {}) {
  return {
    from(table) {
      return {
        select(_columns, options) {
          if (options?.count === "exact" && options?.head === true) {
            return Promise.resolve({
              count: counts[table],
              error: countErrors[table] ?? null,
            });
          }

          return {
            limit(limit) {
              return {
                single() {
                  if (table === "cost_assumptions" && limit === 1) {
                    return Promise.resolve({ data: probeRow, error: null });
                  }
                  return Promise.resolve({ data: null, error: { code: "BAD_QUERY" } });
                },
              };
            },
          };
        },
        insert(row) {
          const validProbe = table === "cost_assumptions" && row === probeRow;
          return Promise.resolve({
            error: validProbe ? insertError : { code: "BAD_PROBE" },
          });
        },
      };
    },
  };
}

test("reports all expected counts and an RLS-rejected insert as passing", async () => {
  const output = [];

  const exitCode = await runChecks(fakeClient(), (line) => output.push(line));

  assert.equal(exitCode, 0);
  assert.deepEqual(output, [
    "transactions: 120191 PASS",
    "sdp_schemes: 48 PASS",
    "mhpi_quarterly: 3500 PASS",
    "cost_assumptions: 6 PASS",
    "fairness_curve: 72 PASS",
    "backtest_results: 24 PASS",
    "cost_assumptions anon insert: PASS",
  ]);
});

test("returns failure for a count mismatch without printing error details", async () => {
  const output = [];
  const counts = { ...EXPECTED_COUNTS, transactions: 12 };

  const exitCode = await runChecks(
    fakeClient({
      counts,
      countErrors: { sdp_schemes: { message: "sensitive server detail" } },
    }),
    (line) => output.push(line),
  );

  assert.equal(exitCode, 1);
  assert.equal(output[0], "transactions: 12 FAIL");
  assert.equal(output[1], "sdp_schemes: FAIL");
  assert.equal(output.join("\n").includes("sensitive server detail"), false);
});

test("does not accept a duplicate-key error as proof that anon writes are denied", async () => {
  const output = [];

  const exitCode = await runChecks(
    fakeClient({
      insertError: { code: "23505", message: "duplicate key" },
    }),
    (line) => output.push(line),
  );

  assert.equal(exitCode, 1);
  assert.equal(output.at(-1), "cost_assumptions anon insert: FAIL");
});
