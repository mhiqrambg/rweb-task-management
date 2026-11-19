#!/usr/bin/env python3
"""Generate docs/laporan-pengujian-astro-vs-nextjs.docx from measured evidence."""
from docx import Document
from docx.shared import Pt, Inches, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCREEN = os.path.join(ROOT, "docs", "screenshoot")
OUT = os.path.join(ROOT, "docs", "laporan-pengujian-astro-vs-nextjs.docx")

ACCENT = RGBColor(0x00, 0x77, 0xB6)  # ocean palette #0077b6
DARK = RGBColor(0x03, 0x04, 0x5E)    # #03045e

doc = Document()

# Base style
style = doc.styles["Normal"]
style.font.name = "Calibri"
style.font.size = Pt(11)

def h1(text):
    p = doc.add_heading(text, level=1)
    for r in p.runs:
        r.font.color.rgb = DARK
    return p

def h2(text):
    p = doc.add_heading(text, level=2)
    for r in p.runs:
        r.font.color.rgb = ACCENT
    return p

def para(text, bold=False, italic=False):
    p = doc.add_paragraph()
    r = p.add_run(text)
    r.bold = bold
    r.italic = italic
    return p

def bullets(items):
    for it in items:
        doc.add_paragraph(it, style="List Bullet")

def table(headers, rows):
    t = doc.add_table(rows=1 + len(rows), cols=len(headers))
    t.style = "Light Grid Accent 1"
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    for j, htxt in enumerate(headers):
        cell = t.rows[0].cells[j]
        cell.text = htxt
        for r in cell.paragraphs[0].runs:
            r.bold = True
            r.font.color.rgb = DARK
    for i, row in enumerate(rows, start=1):
        for j, val in enumerate(row):
            t.rows[i].cells[j].text = str(val)
    return t


def chart(fname, caption):
    path = os.path.join(os.path.join(ROOT, "docs", "evidence"), fname)
    if os.path.exists(path):
        doc.add_picture(path, width=Inches(6.0))
        doc.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER
        p = doc.add_paragraph()
        r = p.add_run(caption)
        r.italic = True
        r.font.size = Pt(9)
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER

def shot(fname, caption):
    path = os.path.join(SCREEN, fname)
    if os.path.exists(path):
        doc.add_picture(path, width=Inches(5.5))
        doc.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER
        p = doc.add_paragraph()
        r = p.add_run(caption)
        r.italic = True
        r.font.size = Pt(9)
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER

# ---------- Cover ----------
title = doc.add_paragraph()
title.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = title.add_run("Laporan Pengujian Kinerja\nAstro SSR/MPA vs Next.js SSG/SPA-style")
run.bold = True
run.font.size = Pt(22)
run.font.color.rgb = DARK
sub = doc.add_paragraph()
sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = sub.add_run("RWeb Task Management - Perbandingan Model Rendering\n19 November 2026")
r.font.size = Pt(13)
r.font.color.rgb = ACCENT
doc.add_paragraph()

# ---------- 1 Executive Summary ----------
h1("1. Ringkasan Eksekutif (Executive Summary)")
para("Pengujian ini membandingkan dua deployment frontend yang berbagi satu backend API "
     "(rweb-api) dan satu basis data ter-seed (akun benchmark sintetis yang sama). "
     "Hasil inti:")
table(
    ["Dimensi", "Astro SSR/MPA", "Next.js SSG/SPA-style"],
    [
        ["TTFB dokumen (cold, dashboard)", "199-322 ms", "45-48 ms"],
        ["LCP dashboard (cold, median 2 run)", "~396 ms", "~550 ms"],
        ["LCP dashboard (warm)", "392 ms", "449 ms"],
        ["FCP dashboard (cold, run 1)", "350 ms", "147 ms (skeleton)"],
        ["CLS (semua baseline)", "0.00", "0.00"],
        ["TBT (semua baseline)", "0 ms", "0 ms"],
        ["JS terkirim / ter-decode", "31 KB / 93 KB", "198 KB / 650 KB"],
        ["Navigasi", "Dokumen penuh (MPA)", "Client-side (SPA)"],
        ["API", "Server-side selama SSR", "Client-side fetch"],
        ["LCP 4x CPU + Slow 4G", "1342 ms", "3927 ms"],
        ["LCP 4x CPU + Slow 3G", "4559 ms", "12829 ms"],
        ["Throughput edge (30-60 konkurensi)", "541 rps (landing)", "447 rps (dokumen)"],
        ["INP (burst interaksi, lab)", "71 ms", "71 ms"],
        ["Heap setelah idle pasca-burst", "6.8 MB (+0.3 MB)", "10.5 MB (+1.3 MB)"],
    ],
)
doc.add_paragraph()
para("Temuan utama: Next.js unggul di TTFB karena dokumen statis di edge; Astro unggul di "
     "LCP karena HTML lengkap dari SSR tanpa menunggu bundle JS + hydration. Di bawah throttle "
     "CPU, Next terdegradasi jauh lebih parah (LCP 12.8s vs 4.6s pada 4x + Slow 3G). "
     "Next mengirim ~6.4x lebih banyak JS ter-decode (650 KB vs 93 KB).")

# ---------- 2 Pendahuluan ----------
h1("2. Pendahuluan")
para("Proyek ini adalah tugas kelompok yang membandingkan dua model rendering di belakang satu "
     "backend: Astro SSR (MPA) dan Next.js SSG (SPA-style), keduanya dideploy ke Cloudflare "
     "Workers. Dokumen ini menyajikan hasil pengujian kinerja komprehensif: verifikasi "
     "arsitektur, jejak aset, integrasi API, Core Web Vitals baseline, perilaku di bawah "
     "beban konkuren, pembatasan CPU/network, serta interaksi cepat dan memori.")

# ---------- 3 Tujuan ----------
h1("3. Tujuan Pengujian")
bullets([
    "Memverifikasi arsitektur aktual kedua deployment (SSR vs SSG, MPA vs SPA).",
    "Mengukur jejak JavaScript/CSS dan biaya eksekusi main-thread.",
    "Memverifikasi integrasi API kedua frontend dengan backend bersama rweb-api.",
    "Mengukur Core Web Vitals (TTFB, FCP, LCP, CLS, TBT, INP) dalam kondisi cold/warm.",
    "Mengukur degradasi kinerja di bawah beban konkuren, throttle CPU, dan jaringan lambat.",
    "Mengukur perilaku interaksi cepat, memori (heap), dan pertumbuhan DOM.",
    "Menyediakan bukti terukur (trace, screenshot, JSON) yang dapat direproduksi.",
])

# ---------- 4 Arsitektur ----------
h1("4. Arsitektur Sistem")
para("Astro SSR (MPA) dan Next.js SSG (SPA-style) berbagi backend ElysiaJS di Cloudflare "
     "Workers (rweb-api: REST, auth, bisnis) dengan Cloudflare D1 (SQLite) dan R2 (binary "
     "lampiran).")
bullets([
    "Astro: https://web-astro.wanaask.workers.dev (Worker, @astrojs/cloudflare, SSR).",
    "Next: https://web-next.wanaask.workers.dev (static export out/, Worker assets, proxy /api/v1/*).",
    "Backend: https://rweb-api-production.wanaask.workers.dev (ElysiaJS, D1, R2, cookie sid HttpOnly).",
])

# ---------- 5 Perbandingan ----------
h1("5. Perbandingan Astro SSR/MPA dan Next.js SSG/SPA-style")
table(
    ["Karakteristik", "Astro", "Next.js"],
    [
        ["Server rendering", "Ya (SSR di Worker)", "Tidak (SSG statis)"],
        ["Static generation", "Tidak", "Ya (export statis)"],
        ["Isi HTML awal", "Lengkap (data dashboard sudah ada)", "Shell + skeleton; data via fetch"],
        ["Client hydration", "Minimal (script per komponen)", "Ya (React hydration penuh)"],
        ["Client-side navigation", "Tidak (MPA penuh)", "Ya (SPA, next/link)"],
        ["Full document navigation", "Ya (setiap pindah halaman)", "Tidak"],
        ["JavaScript footprint", "Kecil (31 KB transfer)", "Besar (198 KB transfer)"],
        ["Arsitektur terverifikasi", "SSR + MPA", "SSG + SPA-style"],
    ],
)

# ---------- 6 Lingkungan ----------
h1("6. Lingkungan Pengujian")
bullets([
    "Node.js v24.11.1, Chrome 158.0.0.0 (DevTools MCP).",
    "Viewport 1280x800, DPR 1, mode terang.",
    "Repetisi: 2 cold + 1 warm per app untuk dashboard; 1 cold per app untuk tasks.",
    "Akun: seeded bench.1795020781387@example.com (sama di kedua app; data sintetis).",
    "Kondisi: cold = ignoreCache + reload; warm = reload tanpa bypass cache.",
])

# ---------- 7 Konfigurasi MCP ----------
h1("7. Konfigurasi Chrome DevTools MCP")
bullets([
    "Server: chrome-devtools-mcp (browser Chrome, tanpa headless).",
    "Tools: navigate_page, take_snapshot, list_network_requests, get_network_request, evaluate_script, fill, click, press_key, performance_start_trace, performance_stop_trace, take_screenshot, emulate.",
    "Trace disimpan sebagai JSON dan dianalisis memakai scripts/trace_metrics.py (UKM PageLoadMetrics, LayoutShift, RunTask).",
])

# ---------- 8-9 Metodologi ----------
h1("8. Metodologi Benchmark")
bullets([
    "Navigasi ke halaman target (dashboard & tasks).",
    "Trace dimulai dengan autoStop + reload (cold: ignoreCache=true).",
    "Metric diambil dari trace: LCP (UKM candidate terakhir), FCP, TTFB, CLS, TBT.",
    "Footprint diambil dari performance.getEntriesByType('resource') (transfer/decoded/eval).",
    "INP diambil dari trace interaksi (lab), bukan CrUX.",
])
h1("9. Metodologi Stress Testing")
bullets([
    "E1 Konkuren: load generator Node (staged 10→20→30→50) ke edge doc dan API; browser trace direkam selama beban berjalan.",
    "E2 CPU/Network: emulasi Chrome: Normal, 4x+Slow4G, 6x+Slow4G, 4x+Slow3G.",
    "E3 Interaksi cepat: burst filter, pencarian, lightbox, load-more, dan 12 transisi rute; heap & DOM diukur sebelum/sesudah/after-idle.",
])

# ---------- 10 Verifikasi ----------
h1("10. Hasil Verifikasi Rendering")
h2("A1. Astro SSR/MPA - VERIFIED")
bullets([
    "Dokumen awal /app berisi konten bermakna (data dashboard) - ya.",
    "Konten dirender server - ya (tidak ada /api/v1/dashboard di Network browser).",
    "Konten dinamis tidak memerlukan eksekusi klien tambahan untuk tampil - ya.",
    "Navigasi internal = dokumen baru - ya (/tasks → /tasks?cursor=... full page).",
    "Tidak ada View Transitions / routing klien yang mengubah perilaku MPA - tidak ada.",
    "Output terverifikasi SSR (Worker index.ts + @astrojs/cloudflare) - ya.",
])
h2("A2. Next.js SSG/SPA-style - VERIFIED")
bullets([
    "HTML statis dibangun build-time - ya (assets out/, next.config output:'export').",
    "Setiap rute menerima HTML pre-rendered - ya (shell + skeleton).",
    "HTML awal mengandung konten bermakna - sebagian: shell + skeleton, data via fetch.",
    "Hydration + JS klien dieksekusi - ya (React).",
    "next/link melakukan navigasi client-side - ya (RSC payload, tanpa reload).",
    "Navigasi internal menghindari reload penuh - ya.",
    "Bukti build: static export + worker assets - ya.",
    "Bukan shell kosong: HTML berisi skeleton + konten statis (landing) - ya.",
])

# ---------- 11 Footprint ----------
h1("11. JavaScript dan Asset Footprint")
table(
    ["Metrik", "Astro", "Next.js"],
    [
        ["Jumlah request JS", "6", "9"],
        ["JS terkirim (transfer)", "31.0 KB", "198.3 KB"],
        ["JS ter-decode", "93.2 KB", "650.3 KB"],
        ["Evaluasi script (main-thread)", "~510 ms", "~713 ms"],
        ["Jumlah request CSS", "1", "3"],
        ["CSS terkirim", "6.5 KB", "9.0 KB"],
        ["CSS ter-decode", "26.8 KB", "33.1 KB"],
        ["Transfer halaman awal (resources)", "37.5 KB", "214.5 KB"],
        ["Dokumen ter-decode", "14.6 KB", "10.8 KB"],
        ["Legacy JS (insight)", "-", "~14.2-14.6 KB"],
    ],
)
chart("chart-js-decoded.png", "Gambar 5. JavaScript decoded (KB)")
para("Penyebab (root-cause): Next.js mengirim React + runtime Next (turbopack) + polyfill; "
     "Astro hanya mengirim JS per-komponen kecil. Evaluasi script Next ~1.4x lebih lama, "
     "membebani main-thread (berdampak saat throttle CPU).", italic=True)

# ---------- 12 API ----------
h1("12. Integrasi Backend API")
table(
    ["Metrik", "Astro SSR", "Next.js SSG/SPA"],
    [
        ["Lokasi eksekusi API", "Server-side (SSR Worker)", "Client-side (browser)"],
        ["Request terlihat di browser", "Tidak", "Ya (/api/v1/...)"],
        ["Status HTTP", "200 (via SSR)", "200"],
        ["Latensi API teramati", "Tidak teramati langsung (hanya TTFB doc)", "~62-127 ms (fetch)"],
        ["CORS errors", "Tidak ada", "Tidak ada (same-origin proxy)"],
        ["Runtime errors", "Tidak ada", "Tidak ada"],
        ["Konsistensi data", "Data sama (dataset seeded yang sama)", "Data sama"],
    ],
)
para("Detail request Next (get_network_request reqid 616): GET /api/v1/tasks?sort=-updated_at&limit=20 "
     "→ 200; content-encoding: zstd; cache-control: no-store; x-request-id ada; server: cloudflare. "
     "Sesi dikirim via cookie sid (HttpOnly).", italic=True)
para("Keterbatasan: latensi API server-side Astro tidak dapat diobservasi langsung (tidak ada "
     "Server-Timing); hanya TTFB dokumen yang terlihat. Ini eksplisit dilaporkan.", italic=True)

# ---------- 13 Baseline ----------
h1("13. Baseline Performance (Core Web Vitals)")
h2("Dashboard (cold)")
table(
    ["Metrik", "Astro run1", "Astro run2", "Next run1", "Next run2"],
    [
        ["TTFB", "199 ms", "322 ms", "45 ms", "48 ms"],
        ["FCP", "350 ms", "442 ms", "147 ms", "352 ms"],
        ["LCP", "350 ms", "442 ms", "464 ms", "635 ms"],
        ["CLS", "0.00", "0.00", "0.00", "0.00"],
        ["TBT", "0 ms", "0 ms", "0 ms", "0 ms"],
    ],
)
h2("Dashboard (warm) & Tasks (cold)")
table(
    ["Metrik", "Astro warm", "Next warm", "Astro tasks", "Next tasks"],
    [
        ["TTFB", "300 ms", "81 ms", "185 ms", "46 ms"],
        ["FCP", "392 ms", "183 ms", "328 ms", "163 ms"],
        ["LCP", "392 ms", "449 ms", "328 ms", "446 ms"],
        ["CLS", "0.00", "0.00", "0.00", "0.00"],
        ["TBT", "0 ms", "0 ms", "0 ms", "0 ms"],
    ],
)
chart("chart-ttfb-cold.png", "Gambar 3. TTFB dokumen - cold dashboard (ms)")
chart("chart-lcp-warm.png", "Gambar 4. LCP vs FCP - warm dashboard (ms)")
para("Analisis: Next TTFB jauh lebih cepat (static edge). Namun LCP Next lebih lambat: FCP awal "
     "cepat (skeleton), tapi LCP menunggu fetch dashboard + hydration. Astro langsung mengirim "
     "HTML lengkap → LCP = FCP.", italic=True)
shot("astro-baseline-cwv.png", "Gambar 1. Dashboard Astro (baseline)")
shot("next-baseline-cwv.png", "Gambar 2. Dashboard Next.js (baseline)")

# ---------- 14 Concurrent ----------
h1("14. Concurrent Load Stress")
h2("Edge/document (tanpa auth, beban 10-60)")
table(
    ["Metrik", "Astro landing", "Astro app (SSR)", "Next doc"],
    [
        ["rps agregat", "540.8", "191.7", "447.1"],
        ["p50", "61.1 ms", "141.2 ms", "53.6 ms"],
        ["p95", "103.8 ms", "290.7 ms", "105.4 ms"],
        ["p99", "238.1 ms", "446.9 ms", "157.4 ms"],
        ["Error rate", "0%", "0%", "0%"],
    ],
)
h2("Browser trace di bawah beban (warm)")
table(
    ["Metrik", "Astro (app)", "Next (doc)"],
    [
        ["LCP", "311 ms", "508 ms"],
        ["TTFB", "239 ms", "49 ms"],
        ["CLS", "0.00", "0.00"],
    ],
)
h2("API (dashboard) di bawah beban")
table(
    ["Stage", "rps", "p50", "p95", "p99", "Error"],
    [
        ["10 (10s)", "77.9", "114 ms", "193 ms", "244 ms", "0%"],
        ["20 (10s)", "142.9", "129 ms", "253 ms", "318 ms", "50.2%"],
        ["30 (10s)", "231.9", "113 ms", "211 ms", "297 ms", "100%"],
        ["50 (10s)", "276.3", "171 ms", "290 ms", "312 ms", "100%"],
        ["Agregat", "182.3", "134 ms", "278 ms", "308 ms", "79.6%"],
    ],
)
chart("chart-throughput-rps.png", "Gambar 6. Throughput dokumen (rps)")
para("Penyebab error tinggi: rate-limit per-user tasks-user (300 req/60 dtk) di backend. Setelah "
     "~300 request/user/window, semua request lanjutan mendapat 429. Ini adalah perilaku "
     "keamanan terverifikasi (bukan kegagalan jaringan).", italic=True)
shot("astro-stress-cwv.png", "Gambar 3. Astro pada stress (CWV)")
shot("next-stress-cwv.png", "Gambar 4. Next.js pada stress (CWV)")

# ---------- 15 CPU/Network ----------
h1("15. CPU and Network Stress")
table(
    ["Profil", "Astro LCP", "Next LCP", "Delta"],
    [
        ["Normal (warm)", "392 ms", "449 ms", "+15%"],
        ["4x + Slow 4G", "1342 ms", "3927 ms", "+193%"],
        ["6x + Slow 4G", "1413 ms", "4079 ms", "+189%"],
        ["4x + Slow 3G", "4559 ms", "12829 ms", "+181%"],
    ],
)
chart("chart-lcp-stress.png", "Gambar 7. LCP per profil stress (ms)")
para("Penyebab (root-cause): hydration React + eksekusi 650 KB JS + fetch client-side di Next "
     "menjadi sangat mahal di bawah throttle CPU; Astro hanya perlu mem-parse HTML SSR yang "
     "sudah lengkap (sedikit JS), sehingga degradasi jauh lebih landai.", italic=True)

# ---------- 16 Rapid ----------
h1("16. Rapid Interaction Stress")
table(
    ["Metrik", "Astro", "Next.js"],
    [
        ["INP (lab, burst)", "71 ms", "71 ms"],
        ["CLS (selama burst)", "0.00", "0.08"],
        ["Heap sebelum", "6.5 MB", "9.2 MB"],
        ["Heap setelah", "6.8 MB", "10.5 MB"],
        ["Heap after idle", "6.8 MB", "10.5 MB"],
        ["DOM sebelum", "519", "455"],
        ["DOM after idle", "328", "137"],
        ["Navigasi cepat", "12× dokumen penuh (MPA)", "12× rute klien (SPA)"],
        ["Load more", "Dokumen baru", "Client-side API fetch"],
    ],
)
para("Analisis: INP lab serupa. CLS 0.08 hanya muncul di Next saat pergantian rute (skeleton → "
     "konten). Heap Next +1.3 MB vs Astro +0.3 MB pasca-burst; tidak ada indikasi kebocoran "
     "dalam satu sesi (naik lalu stabil).", italic=True)

# ---------- 17-19 ----------
h1("17. Baseline vs Under Stress Comparison")
table(
    ["Metrik", "Astro baseline", "Astro stress (4x/3G)", "Next baseline", "Next stress (4x/3G)"],
    [
        ["TTFB", "300 ms", "2002 ms", "81 ms", "2002 ms"],
        ["FCP", "392 ms", "~4559 ms", "183 ms", "~12829 ms"],
        ["LCP", "392 ms", "4559 ms", "449 ms", "12829 ms"],
        ["CLS", "0.00", "0.00", "0.00", "0.00"],
        ["TBT", "0 ms", "0 ms", "0 ms", "0 ms"],
    ],
)
para("Degradasi: Astro LCP ×11.6; Next LCP ×28.6 (dari warm).")
chart("chart-lcp-degradation.png", "Gambar 8. Degradasi LCP: baseline vs stress (ms)")

h1("18. Analisis Core Web Vitals")
bullets([
    "TTFB: Next menang (static edge). Astro membayar SSR + API server-side.",
    "FCP: Next menang tipis (skeleton lebih cepat), tetapi itu FCP semu (belum data).",
    "LCP: Astro menang (HTML lengkap). Next menunggu hydration + fetch.",
    "CLS: keduanya 0 pada baseline; Next 0.08 saat transisi rute (skeleton → konten).",
    "TBT: keduanya 0 pada perangkat kuat (tidak ada task >50 ms).",
    "INP: sama 71 ms (lab) — keduanya responsif pada interaksi tunggal.",
])

h1("19. Analisis Memory")
bullets([
    "Heap baseline: Astro 6.5 MB < Next 9.2 MB (runtime React lebih berat).",
    "Setelah burst + idle: Astro +0.3 MB; Next +1.3 MB.",
    "Tidak ada bukti kebocoran persisten dalam satu sesi; Next menyimpan lebih banyak state.",
])

# ---------- 20-23 ----------
h1("20. Diskusi dan Interpretasi Hasil")
bullets([
    "Trade-off utama: Next unggul TTFB & throughput statis; Astro unggul LCP & ketahanan di perangkat lambat.",
    "Sumber perbedaan: SSR (Astro) vs SSG + hydration (Next); ukuran bundle; lokasi fetch API (server vs client); strategi navigasi (MPA vs SPA).",
    "Backend sebagai bottleneck: rate-limit per-user membatasi beban API; throughput edge frontend lebih tinggi daripada kapasitas API per-user.",
])

h1("21. Keterbatasan Penelitian")
bullets([
    "INP = lab (trace), bukan field/CrUX.",
    "Latensi API server-side Astro tidak teramati langsung.",
    "Rate-limit membatasi validasi API stress di bawah 429.",
    "Heap memakai performance.memory (Chrome), bukan profiler eksternal.",
    "Cold cache tetap melewati edge Cloudflare; cold start origin tidak terisolasi.",
])

h1("22. Kesimpulan")
bullets([
    "Arsitektur terverifikasi: Astro benar-benar SSR/MPA; Next benar-benar SSG/SPA-style.",
    "Next unggul di TTFB & throughput dokumen statis; Astro unggul di LCP & biaya JS.",
    "Di perangkat/profil lambat, Next terdegradasi jauh lebih parah (LCP 12.8s vs 4.6s).",
    "SPA navigation (Next) lebih halus untuk pindah tampilan; MPA (Astro) lebih ringan.",
    "Backend bersama berperilaku konsisten; rate-limit per-user adalah batas yang sah.",
])

h1("23. Rekomendasi")
bullets([
    "Gunakan Astro SSR jika target pengguna banyak di perangkat/network lambat dan SEO/konten awal penting.",
    "Gunakan Next.js SSG/SPA jika transisi antar-tampilan yang mulus dan TTFB edge lebih diutamakan, dan jika bundle JS bisa dioptimalkan (code-splitting, mengurangi polyfill ~14 KB).",
    "Optimalkan backend: naikkan atau perjelas batas rate-limit per-user; pertimbangkan cache untuk dashboard (jika aman).",
    "Lanjutkan dengan pengukuran field (CrUX) untuk validasi.",
])

# ---------- 24 Lampiran ----------
h1("24. Lampiran Bukti Pengujian")
bullets([
    "Trace: docs/evidence/*.trace.json (17 file).",
    "Screenshot: docs/screenshoot/astro-ui-home.png, astro-baseline-cwv.png, astro-stress-cwv.png, astro-network-api.png, next-ui-home.png, next-baseline-cwv.png, next-stress-cwv.png, next-network-api.png.",
    "JSON terstruktur: docs/evidence/cwv-stress-comparison.json.",
    "Load generator: scripts/loadgen.mjs; parser metric: scripts/trace_metrics.py.",
])

doc.save(OUT)
print("Wrote", OUT)
