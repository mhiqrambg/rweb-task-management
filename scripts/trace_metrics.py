#!/usr/bin/env python3
"""Extract lab CWV metrics from Chrome DevTools MCP performance trace JSON.

Usage: python3 scripts/trace_metrics.py <trace.json> [<trace.json> ...]
Output: one JSON line per trace: {file, lcp, fcp, ttfb, cls, tbt, longTasks, docLen}

Metric sources (trace event conventions from Chrome DevTools):
- LCP / FCP / DCL / Load: PageLoadMetrics UKM events (navigation-anchored).
- CLS: LayoutShift X events (score).
- TBT: main-thread RunTask events with duration >= 50ms (blocking = dur - 50).
"""
import json
import sys
import os


def extract(path):
    with open(path) as f:
        tr = json.load(f)
    events = tr.get("traceEvents", tr if isinstance(tr, list) else [])

    # --- navigation anchor: last navigationStart with a document URL ---
    nav_starts = [e for e in events if e.get("name") == "navigationStart" and e.get("args", {}).get("data", {}).get("documentLoaderURL")]
    nav_start = nav_starts[-1]["ts"] if nav_starts else None

    # --- UKM PageLoadMetrics ---
    ukm = {}
    for e in events:
        name = e.get("name", "")
        if name in ("PageLoadMetrics.NavigationToFirstContentfulPaint",
                    "PageLoadMetrics.NavigationToLargestContentfulPaint",
                    "PageLoadMetrics.NavigationToLargestContentfulPaint::Candidate",
                    "PageLoadMetrics.NavigationToDOMContentLoadedEventFired",
                    "PageLoadMetrics.NavigationToMainFrameOnLoad"):
            ukm[name] = e["ts"]
        elif name == "NavStartToLargestContentfulPaint::Candidate::AllFrames::UKM":
            d = e.get("args", {}).get("data", {}).get("durationInMilliseconds")
            if d is not None:
                ukm["lcp_ms"] = d

    lcp_ms = ukm.get("lcp_ms")
    if lcp_ms is None and "PageLoadMetrics.NavigationToLargestContentfulPaint::Candidate" in ukm and nav_start:
        lcp_ms = round((ukm["PageLoadMetrics.NavigationToLargestContentfulPaint::Candidate"] - nav_start) / 1000, 1)
    fcp_ms = None
    if "PageLoadMetrics.NavigationToFirstContentfulPaint" in ukm and nav_start:
        fcp_ms = round((ukm["PageLoadMetrics.NavigationToFirstContentfulPaint"] - nav_start) / 1000, 1)

    # --- CLS ---
    cls = 0.0
    for e in events:
        if e.get("ph") == "X" and e.get("name") == "LayoutShift":
            cls += e.get("args", {}).get("data", {}).get("score", 0.0)

    # --- TBT via RunTask (main thread) ---
    long_tasks = []
    for e in events:
        if e.get("name") != "RunTask":
            continue
        dur = e.get("args", {}).get("data", {}).get("duration", 0)
        if dur >= 50_000:
            long_tasks.append({"d_ms": round(dur / 1000, 1),
                               "b_ms": round(max(0.0, dur - 50_000) / 1000, 1),
                               "ts": e.get("ts", 0)})
    tbt = sum(lt["b_ms"] for lt in long_tasks)

    return {
        "file": os.path.basename(path),
        "lcp_ms": lcp_ms,
        "fcp_ms": fcp_ms,
        "cls": round(cls, 4),
        "tbt_ms": round(tbt, 1),
        "n_long_tasks": len(long_tasks),
        "long_tasks": long_tasks[:10],
        "nav_start": nav_start,
    }


def main():
    out = []
    for p in sys.argv[1:]:
        try:
            out.append(extract(p))
        except Exception as exc:  # noqa: BLE001
            out.append({"file": p, "error": str(exc)})
    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    main()
