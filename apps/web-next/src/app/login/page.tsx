import type { Metadata } from 'next';
import { copy } from '@taskapp/contracts';
import { AuthForm } from '@/components/AuthForm';
import '../auth.css';

export const metadata: Metadata = { title: `${copy.auth.login.title} · ${copy.brand.name}` };

export default function Page() {
  return <AuthForm mode="login" />;
}
