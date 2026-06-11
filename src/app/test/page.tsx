import { notFound } from 'next/navigation';
import TestClient from './test-client';

export const dynamic = 'force-dynamic';

export default function TestPage() {
  if (process.env.NODE_ENV !== 'development') {
    notFound();
  }
  return <TestClient />;
}
