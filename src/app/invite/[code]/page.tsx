import type { Metadata } from 'next';
import { ACTIVA_APP_URL, extractReferralCode } from '@/lib/referral';
import InviteLandingClient from './InviteLandingClient';

type Props = {
  params: Promise<{ code: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const resolvedParams = await params;
  const rawCode = resolvedParams?.code || '';
  const code = extractReferralCode(rawCode) || rawCode.toUpperCase();

  const title = 'Du wurdest zu Activa eingeladen';
  const description = 'Entdecke Aktivitäten, Orte und neue Leute in deiner Nähe – mit Activa.';
  const url = `${ACTIVA_APP_URL}/invite/${encodeURIComponent(code)}`;

  return {
    title,
    description,
    metadataBase: new URL(ACTIVA_APP_URL),
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      url,
      siteName: 'Activa',
      type: 'website',
      locale: 'de_DE',
      images: [
        {
          url: `${ACTIVA_APP_URL}/icon-512.png`,
          width: 512,
          height: 512,
          alt: 'Activa Logo',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`${ACTIVA_APP_URL}/icon-512.png`],
    },
  };
}

export default async function InvitePage({ params }: Props) {
  const resolvedParams = await params;
  const rawCode = resolvedParams?.code || '';
  const code = extractReferralCode(rawCode) || rawCode.toUpperCase();

  return <InviteLandingClient code={code} />;
}
