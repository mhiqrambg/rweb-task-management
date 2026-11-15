import styles from './FeedbackState.module.css';

/**
 * UI presentasional untuk empat keadaan respons API.
 * Tidak mengambil data, tidak memalsukan autentikasi, dan aman bagi static export.
 * Perilaku 401 (redirect ke login) tetap ditangani pada requestJson + ClientShell.
 */
export type FeedbackKind = 'loading' | 'empty' | 'error' | 'unauthorized';

const defaults: Record<FeedbackKind, { title: string; description: string; icon: string }> = {
  loading: {
    title: 'Memuat data…',
    description: 'Sedang mengambil informasi terbaru.',
    icon: '◌',
  },
  empty: {
    title: 'Belum ada data',
    description: 'Konten akan ditampilkan setelah tersedia.',
    icon: '▤',
  },
  error: {
    title: 'Data belum dapat dimuat',
    description: 'Terjadi kesalahan saat menghubungi layanan.',
    icon: '!',
  },
  unauthorized: {
    title: 'Sesi telah berakhir',
    description: 'Silakan masuk kembali untuk melanjutkan.',
    icon: '🔒',
  },
};

export function FeedbackState({
  kind,
  title,
  description,
  actionLabel,
  onAction,
}: {
  kind: FeedbackKind;
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const config = defaults[kind];
  const isLoading = kind === 'loading';
  const isError = kind === 'error' || kind === 'unauthorized';
  const buttonLabel = actionLabel ?? (kind === 'unauthorized' ? 'Masuk kembali' : kind === 'error' ? 'Coba lagi' : 'Mulai sekarang');

  return (
    <section
      className={`${styles.card} ${isError ? styles.danger : ''}`}
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      aria-busy={isLoading}
      data-feedback-kind={kind}
    >
      <div className={styles.heading}>
        <span className={styles.symbol} aria-hidden="true">{config.icon}</span>
        <div>
          <h2 className={styles.title}>{title ?? config.title}</h2>
          <p className={styles.description}>{description ?? config.description}</p>
        </div>
      </div>
      {isLoading && (
        <div className={styles.skeletonList} aria-hidden="true">
          <span className={styles.skeleton} />
          <span className={styles.skeleton} />
          <span className={styles.skeletonShort} />
        </div>
      )}
      {!isLoading && onAction && (
        <button className={styles.action} type="button" onClick={onAction}>
          {buttonLabel}
        </button>
      )}
    </section>
  );
}
