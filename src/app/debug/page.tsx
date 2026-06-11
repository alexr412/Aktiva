import { notFound } from 'next/navigation';
import DebugClient from './debug-client';

export const dynamic = 'force-dynamic';

export default function DebugPage() {
  if (process.env.NODE_ENV !== 'development') {
    notFound();
  }
  return <DebugClient />;
}
