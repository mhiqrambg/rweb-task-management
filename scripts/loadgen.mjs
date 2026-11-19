#!/usr/bin/env node
/**
 * Controlled staged-concurrency load generator for the benchmark.
 * Usage: node scripts/loadgen.mjs <url> [cookieHeader] [totalMs] [stages]
 *   cookieHeader: e.g. "sid=<token>" or empty for public routes; multiple cookies
 *   separated by "|" rotate round-robin per request (for per-user rate-limit spread).
 *   stages: comma-separated concurrency levels, each held totalMs/len(stages).
 * Prints per-stage + aggregate stats: rps, mean, p50, p90, p95, p99, max, errors.
 */
const url = process.argv[2];
const cookieHeader = process.argv[3] || "";
const cookies = cookieHeader.split("|").filter(Boolean);
const totalMs = Number(process.argv[4] || 40000);
const stages = (process.argv[5] || "10,20,30,50").split(",").map(Number);

let rot = 0;
function nextCookie() {
  if (!cookies.length) return "";
  return cookies[rot++ % cookies.length];
}

if (!url) {
  console.error("usage: loadgen.mjs <url> [cookie] [totalMs] [stages]");
  process.exit(1);
}

async function worker(concurrency, durationMs, results, errors) {
  const deadline = Date.now() + durationMs;
  const run = async () => {
    while (Date.now() < deadline) {
      const t0 = performance.now();
      try {
        const c = nextCookie();
        const res = await fetch(url, {
          headers: c ? { cookie: c } : {},
          redirect: "manual",
          signal: AbortSignal.timeout(15000),
        });
        const dt = performance.now() - t0;
        results.push({ dt, status: res.status, bytes: Number(res.headers.get("content-length") || 0) });
        if (res.status >= 400) errors.push(res.status);
      } catch (e) {
        const dt = performance.now() - t0;
        results.push({ dt, status: 0, bytes: 0, err: e.name });
        errors.push(0);
      }
      // keep the worker tight without spinning at 100% CPU
      await new Promise((r) => setTimeout(r, 5));
    }
  };
  await Promise.all(Array.from({ length: concurrency }, run));
}

function pct(sorted, p) {
  if (!sorted.length) return 0;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * sorted.length)));
  return sorted[i];
}

async function main() {
  const perStage = totalMs / stages.length;
  const all = [];
  const allErrors = [];
  for (const c of stages) {
    const results = [];
    const errors = [];
    console.log(`stage concurrency=${c} duration=${Math.round(perStage)}ms`);
    await worker(c, perStage, results, errors);
    const sorted = results.map((r) => r.dt).sort((a, b) => a - b);
    const ok = results.filter((r) => r.status >= 200 && r.status < 400).length;
    const stats = {
      stage: c,
      requests: results.length,
      ok,
      errors: errors.length,
      errorRatePct: +((errors.length / Math.max(1, results.length)) * 100).toFixed(2),
      rps: +(results.length / (perStage / 1000)).toFixed(1),
      mean_ms: +(sorted.reduce((a, b) => a + b, 0) / Math.max(1, sorted.length)).toFixed(1),
      p50_ms: +pct(sorted, 50).toFixed(1),
      p90_ms: +pct(sorted, 90).toFixed(1),
      p95_ms: +pct(sorted, 95).toFixed(1),
      p99_ms: +pct(sorted, 99).toFixed(1),
      max_ms: +sorted[sorted.length - 1].toFixed(1),
    };
    console.log(JSON.stringify(stats));
    all.push(...results);
    allErrors.push(...errors);
  }
  const sorted = all.map((r) => r.dt).sort((a, b) => a - b);
  const ok = all.filter((r) => r.status >= 200 && r.status < 400).length;
  console.log("AGGREGATE " + JSON.stringify({
    requests: all.length,
    ok,
    errors: allErrors.length,
    errorRatePct: +((allErrors.length / Math.max(1, all.length)) * 100).toFixed(2),
    rps: +(all.length / (totalMs / 1000)).toFixed(1),
    mean_ms: +(sorted.reduce((a, b) => a + b, 0) / Math.max(1, sorted.length)).toFixed(1),
    p50_ms: +pct(sorted, 50).toFixed(1),
    p90_ms: +pct(sorted, 90).toFixed(1),
    p95_ms: +pct(sorted, 95).toFixed(1),
    p99_ms: +pct(sorted, 99).toFixed(1),
    max_ms: +sorted[sorted.length - 1].toFixed(1),
  }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
