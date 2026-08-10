'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { PasswordResetUI } from '@/components/auth/password-reset-ui';
import { Loader2 } from 'lucide-react';

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 min-h-0 w-full flex items-center justify-center bg-white dark:bg-neutral-950">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const mode = searchParams.get('mode') || 'resetPassword';
  const oobCode = searchParams.get('oobCode');

  return <PasswordResetUI oobCode={oobCode} mode={mode} />;
}
