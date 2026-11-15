'use client';

import { useState } from 'react';
import { AccountPanel } from '@/components/AccountPanel';

const demoProfile = {
  displayName: 'Pengguna Demo',
  email: 'demo@example.com',
};

export default function AccountPreviewPage() {
  const [showError, setShowError] = useState(false);
  const [loggedOut, setLoggedOut] = useState(false);
  return (
    <main style={{ maxWidth: 940, margin: '0 auto', padding: '32px 18px' }}>
      <p className="eyebrow">PRATINJAU UI • DATA CONTOH • TANPA BACKEND</p>
      <p className="muted">
        Halaman ini hanya memeriksa tampilan Akun. Logout di sini adalah simulasi lokal;
        pada aplikasi sebenarnya logout menggunakan API Fastify.
      </p>
      <div className="actions" style={{ marginBottom: 20 }}>
        <button type="button" className="button secondary" onClick={() => { setLoggedOut(false); setShowError(false); }}>Reset preview</button>
        <button type="button" className="button secondary" onClick={() => { setShowError(true); setLoggedOut(false); }}>Simulasikan error logout</button>
      </div>
      {loggedOut ? (
        <section className="panel" role="status">
          <h1>Simulasi logout berhasil</h1>
          <p className="muted">Tidak ada sesi sungguhan yang diubah. Klik Reset preview untuk kembali.</p>
        </section>
      ) : (
        <AccountPanel
          profile={demoProfile}
          logoutError={showError ? 'Contoh: koneksi terputus. Silakan coba lagi.' : ''}
          onLogout={() => { setLoggedOut(true); setShowError(false); }}
        />
      )}
    </main>
  );
}
