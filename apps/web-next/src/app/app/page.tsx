import { Suspense } from 'react';
import { ClientShell } from '@/components/ClientShell';
import { ShellSkeleton } from '@/components/ShellSkeleton';
import '../account.css';
export default function Page(){ return <Suspense fallback={<ShellSkeleton/>}><ClientShell/></Suspense> }
