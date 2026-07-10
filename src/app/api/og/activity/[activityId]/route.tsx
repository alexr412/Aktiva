import { ImageResponse } from 'next/og';
import { db } from '@/lib/firebase/server';
import { doc, getDoc } from 'firebase/firestore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ activityId: string }> }
) {
  let activityId = '';
  try {
    const resolvedParams = await params;
    activityId = resolvedParams.activityId;
    console.log(`[OG Image API] Parsing params for activityId: ${activityId}`);
  } catch (err) {
    console.error('[OG Image API] Failed to parse params:', err);
    return new Response('Invalid Request Params', { status: 400 });
  }

  if (!activityId) {
    console.warn('[OG Image API] Missing activityId in path');
    return new Response('Not Found', { status: 404 });
  }

  if (!db) {
    console.error('[OG Image API] Server Firestore database instance (db) is null');
    return new Response('Internal Server Error', { status: 500 });
  }

  try {
    console.log(`[OG Image API] Fetching document for activityId: ${activityId}`);
    const activityRef = doc(db, 'activities', activityId);
    
    // Safety fetch with a 4s timeout
    const fetchPromise = getDoc(activityRef);
    const timeoutPromise = new Promise<null>((_, reject) =>
      setTimeout(() => reject(new Error('Firestore Fetch Timeout')), 4000)
    );
    
    const activitySnap = await Promise.race([fetchPromise, timeoutPromise]) as any;

    if (!activitySnap || !activitySnap.exists()) {
      console.warn(`[OG Image API] Activity document not found: ${activityId}`);
      return new Response('Not Found', { status: 404 });
    }

    const activity = activitySnap.data();
    if (!activity) {
      console.warn(`[OG Image API] Activity document is empty: ${activityId}`);
      return new Response('Not Found', { status: 404 });
    }

    console.log(`[OG Image API] Found activity document: ${activity.title}, status: ${activity.status}`);

    // Check for blacklisted activities
    if (activity.status === 'blacklisted') {
      console.warn(`[OG Image API] Activity is blacklisted: ${activityId}`);
      return new Response('Unavailable', { status: 403 });
    }

    // Normalizing fields defensively to prevent undefined dereferences
    const title = String(activity.title || 'Treffen').substring(0, 80);
    const placeName = String(activity.placeName || 'Aktiva').substring(0, 80);
    const city = activity.city ? String(activity.city).substring(0, 50) : '';
    const place = city ? `${placeName}, ${city}` : placeName;
    const hostName = activity.hostName ? String(activity.hostName).substring(0, 40) : '';
    const category = String(activity.category || 'Sonstiges').toUpperCase();

    // Normalizing Date
    let dateStr = '';
    try {
      const isTimeFlexible = !!activity.isTimeFlexible;
      const isDateFlexible = !!activity.isDateFlexible;
      let dateObj: Date | null = null;
      if (activity.activityDate) {
        if (typeof activity.activityDate.toDate === 'function') {
          dateObj = activity.activityDate.toDate();
        } else if (activity.activityDate.seconds) {
          dateObj = new Date(activity.activityDate.seconds * 1000);
        } else {
          dateObj = new Date(activity.activityDate);
        }
      }

      if (isDateFlexible) {
        dateStr = 'DATUM & ZEIT FLEXIBEL';
      } else if (isTimeFlexible) {
        const dayStr = dateObj
          ? dateObj.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })
          : '';
        dateStr = dayStr ? `${dayStr}. (ZEIT FLEXIBEL)`.toUpperCase() : 'ZEIT FLEXIBEL';
      } else if (dateObj && !isNaN(dateObj.getTime())) {
        const hours = String(dateObj.getHours()).padStart(2, '0');
        const minutes = String(dateObj.getMinutes()).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        dateStr = `${day}.${month}. UM ${hours}:${minutes} UHR`;
      } else {
        dateStr = 'ZEITLICH FLEXIBEL';
      }
    } catch (e) {
      console.error('[OG Image API] Date parsing error:', e);
      dateStr = 'ZEITLICH FLEXIBEL';
    }

    // Normalizing Spots Left
    let spotsStr = 'PLÄTZE FREI';
    try {
      const maxParticipants = Number(activity.maxParticipants || 0);
      const participantIdsLength = Array.isArray(activity.participantIds) ? activity.participantIds.length : 0;
      if (maxParticipants > 0) {
        const spotsLeft = Math.max(0, maxParticipants - participantIdsLength);
        spotsStr = `${spotsLeft} VON ${maxParticipants} PLÄTZEN FREI`;
      }
    } catch (e) {
      console.error('[OG Image API] Spots calculation error:', e);
      spotsStr = 'PLÄTZE FREI';
    }

    console.log('[OG Image API] Field normalization complete, compiling JSX');

    // Generating ImageResponse with safe inline styles & no remote image tags
    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
            padding: '60px',
            fontFamily: 'sans-serif',
          }}
        >
          {/* Top Row: Brand Header */}
          <div
            style={{
              display: 'flex',
              width: '100%',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: '16px',
                }}
              >
                <span style={{ color: 'white', fontWeight: 'bold', fontSize: '22px' }}>A</span>
              </div>
              <span
                style={{
                  fontSize: '30px',
                  fontWeight: 900,
                  color: 'white',
                }}
              >
                AKTIVA
              </span>
            </div>

            <div
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                padding: '8px 20px',
                borderRadius: '100px',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: '18px', color: '#a78bfa', fontWeight: 'bold' }}>
                {spotsStr}
              </span>
            </div>
          </div>

          {/* Middle Row: Content & Info */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              marginTop: '20px',
            }}
          >
            <span
              style={{
                fontSize: '20px',
                color: '#8b5cf6',
                fontWeight: 'bold',
                marginBottom: '12px',
              }}
            >
              {category} • {dateStr}
            </span>
            <span
              style={{
                fontSize: '56px',
                fontWeight: 900,
                color: 'white',
                lineHeight: 1.1,
                marginBottom: '20px',
                maxWidth: '1000px',
              }}
            >
              {title}
            </span>
            <span
              style={{
                fontSize: '24px',
                color: '#94a3b8',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              Ort: {place}
            </span>
          </div>

          {/* Bottom Row: CTA & Host Profile Initials (No remote images) */}
          <div
            style={{
              display: 'flex',
              width: '100%',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              paddingTop: '28px',
            }}
          >
            {hostName ? (
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '24px',
                    background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                    marginRight: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontWeight: 'bold',
                    fontSize: '18px',
                  }}
                >
                  {hostName.substring(0, 1).toUpperCase()}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 'bold' }}>HOST</span>
                  <span style={{ fontSize: '18px', color: '#f1f5f9', fontWeight: 'bold' }}>{hostName}</span>
                </div>
              </div>
            ) : (
              <div style={{ width: '1px' }} />
            )}

            <div
              style={{
                background: '#10b981',
                padding: '12px 30px',
                borderRadius: '14px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <span style={{ color: 'white', fontSize: '18px', fontWeight: 'bold' }}>
                Beitreten über Aktiva
              </span>
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (err: any) {
    console.error('[OG Image API] Crash occurred during ImageResponse build:', err);
    // Safe fallback response (404)
    return new Response('Activity OG Render Error', { status: 404 });
  }
}
