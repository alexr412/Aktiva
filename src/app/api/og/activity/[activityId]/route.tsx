import { ImageResponse } from 'next/og';
import { db } from '@/lib/firebase/client';
import { doc, getDoc } from 'firebase/firestore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ activityId: string }> }
) {
  const { activityId } = await params;

  if (!db || !activityId) {
    return new Response('Not Found', { status: 404 });
  }

  try {
    const activityRef = doc(db, 'activities', activityId);
    const activitySnap = await getDoc(activityRef);
    if (!activitySnap.exists()) {
      return new Response('Not Found', { status: 404 });
    }

    const activity = activitySnap.data()!;

    // Don't show blacklisted activities
    if (activity.status === 'blacklisted') {
      return new Response('Unavailable', { status: 403 });
    }

    const title = activity.title || 'Treffen';
    const place = activity.placeName || 'Aktiva';

    const dateObj = activity.activityDate && typeof activity.activityDate.toDate === 'function'
      ? activity.activityDate.toDate()
      : activity.activityDate?.seconds
        ? new Date(activity.activityDate.seconds * 1000)
        : new Date(activity.activityDate);

    const hours = String(dateObj.getHours()).padStart(2, '0');
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
    const dateStr = dateObj ? `${dateObj.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })} ${hours}:${minutes}` : '';

    const spotsLeft = (activity.maxParticipants || 0) - (activity.participantIds?.length || 0);
    const spotsStr = activity.maxParticipants ? `${spotsLeft} von ${activity.maxParticipants} Plätzen frei` : 'Plätze frei';

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
          {/* Top Row: Brand & Status */}
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
                  width: '40px',
                  height: '40px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: '15px',
                }}
              >
                <span style={{ color: 'white', fontWeight: 'bold', fontSize: '20px' }}>A</span>
              </div>
              <span
                style={{
                  fontSize: '28px',
                  fontWeight: 900,
                  color: 'white',
                  letterSpacing: '1px',
                }}
              >
                AKTIVA
              </span>
            </div>

            <div
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                padding: '8px 20px',
                borderRadius: '100px',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: '18px', color: '#a78bfa', fontWeight: 'bold' }}>
                {spotsStr}
              </span>
            </div>
          </div>

          {/* Middle Row: Title & Details */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              marginTop: '40px',
            }}
          >
            <span
              style={{
                fontSize: '22px',
                color: '#a78bfa',
                fontWeight: 'bold',
                textTransform: 'uppercase',
                letterSpacing: '1.5px',
                marginBottom: '10px',
              }}
            >
              {dateStr}
            </span>
            <span
              style={{
                fontSize: '60px',
                fontWeight: 900,
                color: 'white',
                lineHeight: 1.1,
                marginBottom: '20px',
                maxWidth: '900px',
              }}
            >
              {title}
            </span>
            <span
              style={{
                fontSize: '26px',
                color: '#94a3b8',
                fontWeight: 600,
              }}
            >
              📍 {place}
            </span>
          </div>

          {/* Bottom Row: CTA & Host */}
          <div
            style={{
              display: 'flex',
              width: '100%',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '40px',
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
              paddingTop: '30px',
            }}
          >
            {activity.hostName ? (
              <div style={{ display: 'flex', alignItems: 'center' }}>
                {activity.hostPhotoURL ? (
                  <img
                    src={activity.hostPhotoURL}
                    style={{
                      width: '50px',
                      height: '50px',
                      borderRadius: '50px',
                      marginRight: '15px',
                      border: '2px solid rgba(255, 255, 255, 0.2)',
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: '50px',
                      height: '50px',
                      borderRadius: '50px',
                      background: 'rgba(255, 255, 255, 0.2)',
                      marginRight: '15px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontWeight: 'bold',
                    }}
                  >
                    {activity.hostName.substring(0, 1).toUpperCase()}
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '14px', color: '#64748b', fontWeight: 'bold' }}>HOST</span>
                  <span style={{ fontSize: '18px', color: '#e2e8f0', fontWeight: 'bold' }}>{activity.hostName}</span>
                </div>
              </div>
            ) : (
              <div style={{ width: '1px' }} />
            )}

            <div
              style={{
                background: '#10b981',
                padding: '14px 35px',
                borderRadius: '16px',
                display: 'flex',
                alignItems: 'center',
                boxShadow: '0 10px 25px -5px rgba(16, 185, 129, 0.4)',
              }}
            >
              <span style={{ color: 'white', fontSize: '20px', fontWeight: 900 }}>
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
    console.error('Error generating OG image:', err);
    return new Response('Internal Server Error', { status: 500 });
  }
}
