'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { PasswordResetUI } from '@/components/auth/password-reset-ui';
import Image from 'next/image';

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 min-h-0 w-full flex items-center justify-center bg-white dark:bg-neutral-950">
        <div className="relative w-12 h-12 animate-pulse">
          <Image src="/assets/logo-heart.png" alt="Activa" fill sizes="48px" className="object-contain" />
        </div>
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
