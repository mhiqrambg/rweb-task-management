import styles from './AccountPanel.module.css';

export type AccountProfile = {
  displayName?: string | null;
  email: string;
};

type AccountPanelProps = {
  profile: AccountProfile;
  onLogout: () => void | Promise<void>;
  logoutBusy?: boolean;
  logoutError?: string;
};

/** Read-only profile: the source of truth is the authenticated /auth/me response. */
export function AccountPanel({
  profile,
  onLogout,
  logoutBusy = false,
  logoutError = '',
}: AccountPanelProps) {
  const displayName = profile.displayName?.trim() || 'Pengguna';
  const initial = displayName.slice(0, 1).toLocaleUpperCase('id-ID');

  return (
    <section className={styles.page} aria-labelledby="account-heading">
      <header className={styles.heading}>
        <p className="eyebrow">PENGATURAN AKUN</p>
        <h1 id="account-heading">Akun saya</h1>
        <p className="muted">Lihat identitas akun Anda dan kelola sesi masuk.</p>
      </header>

      <div className={`panel ${styles.profileCard}`}>
        <div className={styles.identity}>
          <span className={styles.avatar} aria-hidden="true">{initial}</span>
          <div className={styles.identityText}>
            <h2>{displayName}</h2>
            <p className="muted">Informasi profil</p>
          </div>
        </div>
        <dl className={styles.details}>
          <div className={styles.field}>
            <dt>Nama tampilan</dt>
            <dd>{displayName}</dd>
          </div>
          <div className={styles.field}>
            <dt>Alamat email</dt>
            <dd>{profile.email}</dd>
          </div>
        </dl>
        <p className={styles.readOnly}>
          Informasi akun hanya dapat dilihat pada versi ini.
        </p>
      </div>

      <section className={`panel ${styles.sessionCard}`} aria-labelledby="session-heading">
        <h2 id="session-heading">Sesi akun</h2>
        <p className="muted">Keluar untuk mengakhiri sesi pada perangkat ini.</p>
        {logoutError ? <p role="alert" className="error">{logoutError}</p> : null}
        <button
          type="button"
          className="button danger"
          disabled={logoutBusy}
          aria-busy={logoutBusy}
          onClick={() => void onLogout()}
        >
          {logoutBusy ? 'Sedang keluar…' : 'Keluar dari akun'}
        </button>
      </section>
    </section>
  );
}
