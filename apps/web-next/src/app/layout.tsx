import type { Metadata } from 'next';
import '@taskapp/design-tokens/tokens.css';
import './globals.css';
export const metadata: Metadata = {
  title: 'Task & Notes | Next.js SSG',
  description: 'Aplikasi daftar tugas dan catatan — static export',
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id"><body>{children}</body></html>;
}
