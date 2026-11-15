import { Suspense } from 'react';
import { ClientShell } from '@/components/ClientShell';
import { ShellSkeleton } from '@/components/ShellSkeleton';
export default function Page(){ return <Suspense fallback={<ShellSkeleton/>}><ClientShell/></Suspense> }
