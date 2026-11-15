'use client';

import { Suspense, useId, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, loginSchema, registerSchema, type ItemResponse, type SessionProbe } from '@taskapp/contracts';
import { requestJson } from '@/lib/api';
import styles from './AuthForm.module.css';

type Mode = 'login' | 'register';

function safeNextDestination(): string | null {
  const requested = new URLSearchParams(window.location.search).get('next');
  if (!requested) return null;
  try {
    const parsed = new URL(requested, window.location.origin);
    if (
      parsed.origin === window.location.origin &&
      parsed.pathname.startsWith('/b/app/') &&
      !parsed.username &&
      !parsed.password
    ) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
  } catch {
    // Nilai query tidak valid; gunakan dashboard standar.
  }
  return null;
}

/** Baca query string tanpa effect atau mutasi state saat render. */
function RegistrationNotice() {
  const search = useSearchParams();
  if (search.get('registered') !== '1') return null;
  return (
    <p className={styles.success} role="status">
      Akun berhasil dibuat. Silakan masuk dengan email dan kata sandi Anda.
    </p>
  );
}

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const emailHelpId = useId();
  const passwordHelpId = useId();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError('');

    const normalizedEmail = email.trim().toLowerCase();
    const values =
      mode === 'register'
        ? { email: normalizedEmail, password, displayName: name.trim() || undefined }
        : { email: normalizedEmail, password };
    const parsed = (mode === 'register' ? registerSchema : loginSchema).safeParse(values);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Periksa kembali data yang diisi.');
      return;
    }

    setBusy(true);
    try {
      await requestJson(mode === 'register' ? api.auth.register : api.auth.login, {
        method: 'POST',
        body: JSON.stringify(parsed.data),
      });

      if (mode === 'register') {
        // Registrasi tidak boleh diasumsikan otomatis membuat sesi autentikasi.
        router.replace('/login?registered=1');
        return;
      }

      // Pastikan cookie login benar-benar diterima oleh browser sebelum masuk ke halaman private.
      await requestJson<ItemResponse<SessionProbe>>(api.auth.me);
      const destination = safeNextDestination();
      if (destination) {
        window.location.assign(destination);
      } else {
        router.replace('/app/?view=dashboard');
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal memproses permintaan.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="center-page">
      <div className="panel auth-panel">
        <Link href="/" className="brand">◧ Task &amp; Notes</Link>
        <p className="eyebrow">Next.js SSG</p>
        <h1>{mode === 'login' ? 'Masuk ke akun' : 'Buat akun baru'}</h1>
        <p className="muted">
          {mode === 'login'
            ? 'Kelola tugas dan catatan Anda.'
            : 'Mulai menata pekerjaan dengan lebih mudah.'}
        </p>
        {mode === 'login' && (
          <Suspense fallback={null}>
            <RegistrationNotice />
          </Suspense>
        )}
        <form className="form" onSubmit={submit} aria-busy={busy}>
          {mode === 'register' && (
            <label>
              Nama tampilan
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={100}
                autoComplete="name"
                disabled={busy}
              />
            </label>
          )}
          <label>
            Email
            <input
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              aria-describedby={emailHelpId}
              disabled={busy}
            />
            <span id={emailHelpId} className={styles.formHelp}>Gunakan alamat email yang valid.</span>
          </label>
          <label>
            Kata sandi
            <span className={styles.passwordRow}>
              <input
                required
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                minLength={12}
                aria-describedby={passwordHelpId}
                disabled={busy}
              />
              <button
                type="button"
                className={styles.toggle}
                aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                aria-pressed={showPassword}
                disabled={busy}
                onClick={() => setShowPassword((previous) => !previous)}
              >
                {showPassword ? 'Sembunyikan' : 'Lihat'}
              </button>
            </span>
            <span id={passwordHelpId} className={styles.formHelp}>Minimal 12 karakter.</span>
          </label>
          {error && <p className={styles.error} role="alert">{error}</p>}
          <button type="submit" disabled={busy} className="button">
            {busy ? 'Memproses…' : mode === 'login' ? 'Masuk' : 'Daftar'}
          </button>
        </form>
        <p className="muted">
          {mode === 'login' ? (
            <>Belum punya akun? <Link href="/register">Daftar</Link></>
          ) : (
            <>Sudah punya akun? <Link href="/login">Masuk</Link></>
          )}
        </p>
      </div>
    </main>
  );
}
