import { Suspense } from 'react';
import { ClientShell } from '@/components/ClientShell';
import { ShellSkeleton } from '@/components/ShellSkeleton';
import '../app.css';
export default function Page(){ return <Suspense fallback={<ShellSkeleton/>}><ClientShell/></Suspense> }
