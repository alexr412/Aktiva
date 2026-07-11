import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parseFirestoreRestDoc(fields: any): any {
  if (!fields) return {};
  const result: any = {};
  for (const key in fields) {
    const valObj = fields[key];
    const type = Object.keys(valObj)[0];
    const value = valObj[type];
    
    if (type === 'integerValue' || type === 'doubleValue') {
      result[key] = Number(value);
    } else if (type === 'booleanValue') {
      result[key] = value === 'true' || value === true;
    } else if (type === 'timestampValue') {
      result[key] = {
        toDate: () => new Date(value),
        seconds: Math.floor(new Date(value).getTime() / 1000)
      };
    } else if (type === 'arrayValue') {
      const values = valObj.arrayValue.values || [];
      result[key] = values.map((v: any) => {
        const t = Object.keys(v)[0];
        const val = v[t];
        if (t === 'mapValue') {
          return parseFirestoreRestDoc(v.mapValue.fields);
        }
        return val;
      });
    } else if (type === 'mapValue') {
      result[key] = parseFirestoreRestDoc(valObj.mapValue.fields);
    } else {
      result[key] = value;
    }
  }
  return result;
}

async function getActivityRest(activityId: string) {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'activa-444220';
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/activities/${activityId}`;
  
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) {
    return null;
  }
  const data = await res.json() as any;
  return parseFirestoreRestDoc(data.fields);
}

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

  try {
    console.log(`[OG Image API] Fetching document via REST for activityId: ${activityId}`);
    const activity = await getActivityRest(activityId);

    if (!activity) {
      console.warn(`[OG Image API] Activity document not found: ${activityId}`);
      return new Response('Not Found', { status: 404 });
    }

    console.log(`[OG Image API] Found activity document via REST: ${activity.title}, status: ${activity.status}`);

    // Check for blacklisted activities
    if (activity.status === 'blacklisted') {
      console.warn(`[OG Image API] Activity is blacklisted: ${activityId}`);
      return new Response('Unavailable', { status: 403 });
    }

    // Normalizing fields defensively to prevent undefined dereferences
    const title = String(activity.title || 'Treffen').substring(0, 80);
    const placeName = String(activity.placeName || 'Wird noch bekanntgegeben').substring(0, 80);
    const city = activity.city ? String(activity.city).substring(0, 50) : '';
    const place = city ? `${placeName}, ${city}` : placeName;
    const hostUsernameRaw = activity.hostUsername ? String(activity.hostUsername) : '';
    const hostName = hostUsernameRaw ? `@${hostUsernameRaw.replace(/^@/, '')}` : 'Aktiva-Nutzer';
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
        dateStr = 'Datum & Zeit flexibel';
      } else if (isTimeFlexible) {
        const dayStr = dateObj
          ? dateObj.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })
          : '';
        dateStr = dayStr ? `${dayStr}. (Zeit flexibel)` : 'Zeit flexibel';
      } else if (dateObj && !isNaN(dateObj.getTime())) {
        const hours = String(dateObj.getHours()).padStart(2, '0');
        const minutes = String(dateObj.getMinutes()).padStart(2, '0');
        const dayStr = dateObj.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
        dateStr = `${dayStr}. um ${hours}:${minutes} Uhr`;
      } else {
        dateStr = 'Zeitlich flexibel';
      }
    } catch (e) {
      console.error('[OG Image API] Date parsing error:', e);
      dateStr = 'Zeitlich flexibel';
    }

    // Normalizing Spots Left
    let spotsStr = 'Plätze frei';
    try {
      const maxParticipants = Number(activity.maxParticipants || 0);
      const participantIdsLength = Array.isArray(activity.participantIds) ? activity.participantIds.length : 0;
      if (maxParticipants > 0) {
        const spotsLeft = Math.max(0, maxParticipants - participantIdsLength);
        spotsStr = `${spotsLeft} von ${maxParticipants} Plätzen frei`;
      }
    } catch (e) {
      console.error('[OG Image API] Spots calculation error:', e);
      spotsStr = 'Plätze frei';
    }

    console.log('[OG Image API] Field normalization complete, compiling JSX for ImageResponse');

    // Generating ImageResponse with centered card design
    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#0f172a',
            padding: '40px',
            fontFamily: 'sans-serif',
            position: 'relative',
          }}
        >
          {/* Ambient background glow/blobs */}
          <div
            style={{
              position: 'absolute',
              top: '-10%',
              left: '-10%',
              width: '500px',
              height: '500px',
              borderRadius: '250px',
              background: 'rgba(124, 58, 237, 0.15)',
              filter: 'blur(100px)',
              display: 'flex',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: '-10%',
              right: '-10%',
              width: '500px',
              height: '500px',
              borderRadius: '250px',
              background: 'rgba(16, 185, 129, 0.1)',
              filter: 'blur(100px)',
              display: 'flex',
            }}
          />

          {/* Card Container */}
          <div
            style={{
              width: '900px',
              height: '500px',
              background: 'rgba(30, 41, 59, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '36px',
              padding: '48px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            }}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                paddingBottom: '20px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: '12px',
                  }}
                >
                  <span style={{ color: 'white', fontWeight: 'bold', fontSize: '18px' }}>A</span>
                </div>
                <span style={{ fontSize: '24px', fontWeight: 900, color: 'white', letterSpacing: '2px' }}>
                  AKTIVA
                </span>
              </div>
              <div
                style={{
                  background: 'rgba(139, 92, 246, 0.15)',
                  padding: '6px 18px',
                  borderRadius: '100px',
                  border: '1px solid rgba(139, 92, 246, 0.3)',
                  display: 'flex',
                }}
              >
                <span style={{ fontSize: '12px', color: '#c084fc', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Einladung
                </span>
              </div>
            </div>

            {/* Body */}
            <div style={{ display: 'flex', flexDirection: 'column', margin: '24px 0' }}>
              <span style={{ fontSize: '16px', color: '#a78bfa', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>
                {category}
              </span>
              <span
                style={{
                  fontSize: '44px',
                  fontWeight: 900,
                  color: 'white',
                  lineHeight: 1.2,
                  margin: '8px 0 20px 0',
                  maxHeight: '110px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: 'flex',
                }}
              >
                {title}
              </span>

              {/* Detail Badges Row */}
              <div style={{ display: 'flex', gap: '16px' }}>
                {/* Date / Time */}
                <div
                  style={{
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '16px',
                    padding: '12px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 'bold', textTransform: 'uppercase' }}>Datum & Uhrzeit</span>
                  <span style={{ fontSize: '16px', color: 'white', fontWeight: 'bold', marginTop: '4px' }}>{dateStr}</span>
                </div>

                {/* Place */}
                <div
                  style={{
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '16px',
                    padding: '12px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    maxWidth: '300px',
                  }}
                >
                  <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 'bold', textTransform: 'uppercase' }}>Ort</span>
                  <span style={{ fontSize: '16px', color: 'white', fontWeight: 'bold', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{place}</span>
                </div>

                {/* Availability */}
                <div
                  style={{
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '16px',
                    padding: '12px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 'bold', textTransform: 'uppercase' }}>Verfügbarkeit</span>
                  <span style={{ fontSize: '16px', color: 'white', fontWeight: 'bold', marginTop: '4px' }}>{spotsStr}</span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                paddingTop: '20px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '20px',
                    background: 'rgba(139, 92, 246, 0.2)',
                    border: '1px solid rgba(139, 92, 246, 0.3)',
                    marginRight: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#a78bfa',
                    fontWeight: 'bold',
                    fontSize: '16px',
                  }}
                >
                  {hostName.replace(/^@/, '').substring(0, 1).toUpperCase()}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 'bold', textTransform: 'uppercase' }}>Veranstalter</span>
                  <span style={{ fontSize: '16px', color: 'white', fontWeight: 'bold' }}>{hostName}</span>
                </div>
              </div>

              <div
                style={{
                  background: '#10b981',
                  padding: '14px 28px',
                  borderRadius: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  boxShadow: '0 10px 15px -3px rgba(16, 185, 129, 0.3)',
                }}
              >
                <span style={{ color: 'white', fontSize: '16px', fontWeight: 'bold' }}>
                  Beitreten über Aktiva
                </span>
              </div>
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        headers: {
          'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
        },
      }
    );
  } catch (err: any) {
    console.error('[OG Image API] Crash occurred during ImageResponse build:', err);
    // Safe fallback response (404)
    return new Response('Activity OG Render Error', { status: 404 });
  }
}
