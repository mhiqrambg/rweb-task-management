import Link from 'next/link';
export default function LandingPage() {
 return <div className="landing">
   <header className="marketing-header"><Link href="/" className="brand">◧ Task & Notes</Link><nav><Link href="/login">Masuk</Link><Link href="/register" className="button">Daftar</Link></nav></header>
   <main className="hero"><p className="eyebrow">TASK MANAGEMENT • NEXT.JS SSG</p><h1>Atur tugas, simpan ide, dan fokus pada hal penting.</h1><p>Satu tempat untuk daftar tugas, prioritas, tenggat waktu, dan catatan pribadi.</p><div className="actions"><Link href="/register" className="button">Mulai sekarang</Link><Link href="/login" className="button secondary">Sudah punya akun?</Link></div><div className="hero-cards"><div className="panel"><strong>Kelola tugas</strong><p>Status, prioritas dan tenggat waktu.</p></div><div className="panel"><strong>Simpan catatan</strong><p>Ide dan informasi mudah ditemukan.</p></div><div className="panel"><strong>Ringkasan</strong><p>Pantau pekerjaan yang sudah selesai.</p></div></div></main>
   <footer className="footer">Task & Notes — Versi Next.js SSG</footer>
 </div>
}
