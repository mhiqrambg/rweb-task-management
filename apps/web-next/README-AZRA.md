# Azra — Frontend Next.js SSG (Starter)

Lokasi yang benar di repository induk: `apps/web-next/`.

**Status:** starter implementasi tahap 1–2 dan pembacaan dasar tahap 3. BUKAN fitur lengkap atau hasil benchmark. File ini tidak dimasukkan ke repository pengguna secara otomatis.

## Cara memasang

1. `git clone https://github.com/mhiqrambg/rweb-task-management.git`
2. `cd rweb-task-management`
3. `git checkout -b feat/next-static-shell`
4. Ekstrak isi starter ke `apps/web-next/` (jangan timpa file yang telah dikerjakan orang lain).
5. `cp apps/web-next/.env.example apps/web-next/.env.local` atau salin manual di Windows. Sesuaikan origin API.
6. Instal Node sesuai `.nvmrc` repo (root butuh >=22.23.4), aktifkan Corepack dan PNPM versi repo; `pnpm install` di root.
7. `pnpm --filter web-next dev` lalu buka `http://localhost:3000/b/`.
8. Jika Iqram sudah menyediakan API di port 8787 (`wrangler dev`), uji login dan `http://localhost:3000/b/app/?view=tasks`.
9. `pnpm --filter web-next typecheck`, `pnpm --filter web-next lint`, `pnpm --filter web-next test`, `pnpm --filter web-next build`.
10. Pastikan `apps/web-next/out/` berisi halaman statis. Periksa bahwa HTML tidak berisi email, data catatan, atau informasi pribadi.

## Yang sudah menjadi fondasi dalam starter

- Konfigurasi `output: 'export'`, `basePath: '/b'`, `images.unoptimized`, `trailingSlash`.
- Landing, login, register, static app shell, 404.
- Auth via `/api/v1/auth/me` dan cookie credentials include; logout.
- Dashboard menampilkan statistik dari API.
- Daftar tugas: tampil, cari judul, tambah, detail, ubah status, hapus.
- Daftar catatan: tampil, tambah, detail, sematkan, hapus.
- Loading skeleton, error dan retry dasar, CSS berbasis `@taskapp/design-tokens`.

## Yang belum lengkap — pekerjaan Azra berikutnya

- Form edit tugas lengkap (judul, deskripsi, prioritas, tanggal, status), form edit catatan.
- Filter status, prioritas, tenggat, sortir, cursor pagination URL-authoritative dan tombol Load more.
- Attachment: file dropzone, validasi 5 MB/10 berkas/mime, progress upload, thumbnail 4:3, lightbox keyboard dan penghapusan.
- Toast, modal konfirmasi aksesibel, focus trap, optimistik pin + rollback.
- Penyempurnaan UI paritas berdasarkan `design/` dan perbandingan screenshot mobile/desktop dengan Astro.
- E2E Playwright, benchmark build produksi, guardrail kebocoran informasi pribadi.

## API yang harus tersedia dari Iqram

Kontrak memakai `@taskapp/contracts` (rute sudah diawali `/api/v1`, jangan digandakan):
`POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `GET /api/v1/auth/me`, `POST /api/v1/auth/logout`,
`GET /api/v1/dashboard`, `GET/POST /api/v1/tasks`, `GET/PATCH/DELETE /api/v1/tasks/:id`,
`GET/POST /api/v1/notes`, `GET/PATCH/DELETE /api/v1/notes/:id`.

Response `ItemResponse<T> = {data:T}`, daftar `{data:T[],page:{limit,nextCursor}}`. API helper mendukung response 204 tanpa body.

**PENTING:** Produk final harus dijalankan melalui satu origin/reverse proxy sesuai rencana benchmarking; saat lokal origin Next 3000 dan API 8787 memerlukan CORS credentials, cookies yang sesuai, dan validasi Origin di API. `NEXT_PUBLIC_API_ORIGIN` adalah origin saja, bukan path `/api/v1`. Nilai `NEXT_PUBLIC_*` dibekukan saat build.

## Catatan perbaikan sebelum integrasi

- Sesuaikan status code/login response bila Iqram mengubah kontrak.
- Tambahkan safety redirect global setiap permintaan yang menerima 401.
- Jangan gunakan Pages API Routes, middleware/proxy SSR, `cookies()` server atau `getServerSideProps` dalam static export.
- Perbaiki data mock atau placeholder hanya untuk development, bukan untuk benchmark.
- Jangan ubah struktur repo tanpa persetujuan tim; dokumen repo sudah mengacu ElysiaJS + Cloudflare Workers + D1 + R2. Jangan kembali ke Hono, Fastify, atau PostgreSQL.

## Rujukan

- `.planning/13-team-responsibility-matrix.md` — peran Azra
- `.planning/14-ui-ux-specification.md` — 11 layar dan states
- `design/07-parity-checklist.md` — matriks pembuktian parity
- `packages/contracts/src` — bentuk request/response
- https://nextjs.org/docs/app/guides/static-exports
