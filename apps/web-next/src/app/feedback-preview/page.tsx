'use client';

import { useState } from 'react';
import { FeedbackState, type FeedbackKind } from '@/components/FeedbackState';

const scenarios: Array<{ kind: FeedbackKind; label: string }> = [
  { kind: 'loading', label: 'Loading' },
  { kind: 'empty', label: 'Data kosong' },
  { kind: 'error', label: 'Error API' },
  { kind: 'unauthorized', label: 'Sesi 401' },
];

export default function FeedbackPreview() {
  const [kind, setKind] = useState<FeedbackKind>('loading');
  const [actions, setActions] = useState(0);
  return (
    <main style={{ maxWidth: 860, margin: '0 auto', padding: 'clamp(1rem, 4vw, 3rem)' }}>
      <p className="eyebrow">SUPERTHREAD · FE-NEXT</p>
      <h1>Preview loading, empty & error states</h1>
      <p className="muted">
        Data ini hanya simulasi komponen antarmuka. Tidak ada API yang dipanggil, dan tidak ada sesi autentikasi yang dibuat.
      </p>
      <fieldset style={{ border: '1px solid #d6dde3', borderRadius: 10, padding: 16, marginBottom: 22 }}>
        <legend style={{ fontWeight: 700 }}>Pilih skenario</legend>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {scenarios.map(({ kind: value, label }) => (
            <label key={value} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="radio"
                name="feedback-scenario"
                value={value}
                checked={kind === value}
                onChange={() => setKind(value)}
                style={{ width: 'auto', minHeight: 20, accentColor: '#087353' }}
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <FeedbackState
        kind={kind}
        description={kind === 'error' ? 'Simulasi: koneksi ke API ElysiaJS terputus.' : undefined}
        actionLabel={kind === 'unauthorized' ? 'Simulasikan login' : kind === 'empty' ? 'Buat data contoh' : 'Coba lagi'}
        onAction={kind === 'loading' ? undefined : () => {
          setActions((n) => n + 1);
          setKind('loading');
        }}
      />
      <p role="status" style={{ marginTop: 16, color: 'var(--color-ink-muted, #536170)' }}>
        Aksi simulasi dijalankan: {actions} kali
      </p>
      <section style={{ marginTop: 28 }} aria-label="Panduan aksesibilitas">
        <h2>Uji keyboard dan reduced motion</h2>
        <p>Tekan Tab untuk berpindah pilihan, Space untuk memilih, dan Tab menuju tombol aksi. Coba pengaturan Reduce Motion pada Windows untuk menonaktifkan animasi skeleton.</p>
        <p><strong>Catatan:</strong> untuk aplikasi sebenarnya, respons HTTP 401 ditangani oleh lapisan API dan App Shell, bukan oleh halaman pratinjau ini.</p>
      </section>
    </main>
  );
}
