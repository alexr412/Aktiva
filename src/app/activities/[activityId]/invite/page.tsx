import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Users, Calendar, MapPin, ShieldAlert, ArrowRight } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Props = {
  params: Promise<{ activityId: string }>;
  searchParams: Promise<{ ref?: string }>;
};

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

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { activityId } = await params;
  if (!activityId) return { title: 'Aktivität Einladung | Aktiva' };

  try {
    const activity = await getActivityRest(activityId);
    if (!activity || activity.status === 'blacklisted') {
      return { title: 'Aktivität nicht gefunden | Aktiva' };
    }

    const isCancelled = activity.status === 'cancelled';
    const isTimeFlexible = !!activity.isTimeFlexible;
    const isDateFlexible = !!activity.isDateFlexible;

    const dateObj = activity.activityDate?.toDate ? activity.activityDate.toDate() : null;
    const endDateObj = activity.activityEndDate?.toDate ? activity.activityEndDate.toDate() : null;

    let isPast = false;
    if (activity.status === 'completed') {
      isPast = true;
    } else if (endDateObj) {
      isPast = endDateObj.getTime() < Date.now();
    } else if (isDateFlexible) {
      isPast = false;
    } else if (isTimeFlexible && dateObj) {
      const endOfDay = new Date(dateObj);
      endOfDay.setHours(23, 59, 59, 999);
      isPast = endOfDay.getTime() < Date.now();
    } else if (dateObj) {
      isPast = dateObj.getTime() < Date.now();
    }

    const isCompleted = activity.status === 'completed' || isPast;

    let statusPrefix = '';
    if (isCancelled) statusPrefix = '[Abgesagt] ';
    else if (isCompleted) statusPrefix = '[Beendet] ';

    const activityTitle = `${statusPrefix}${activity.title || 'Treffen'} | Aktiva`;

    const spotsLeft = (activity.maxParticipants || 0) - (activity.participantIds?.length || 0);
    const spotsStr = activity.maxParticipants ? `${spotsLeft} von ${activity.maxParticipants} Plätzen frei` : 'Plätze frei';

    let dateDisplayStr = '';
    if (isDateFlexible) {
      dateDisplayStr = 'Datum & Zeit flexibel';
    } else if (isTimeFlexible) {
      const dayStr = dateObj
        ? dateObj.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })
        : '';
      dateDisplayStr = dayStr ? `${dayStr}. (Zeit flexibel)` : 'Zeit flexibel';
    } else if (dateObj) {
      const hours = String(dateObj.getHours()).padStart(2, '0');
      const minutes = String(dateObj.getMinutes()).padStart(2, '0');
      const dayStr = dateObj.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
      dateDisplayStr = `${dayStr}. um ${hours}:${minutes} Uhr`;
    } else {
      dateDisplayStr = 'Zeitlich flexibel';
    }

    const activityDescription = `${dateDisplayStr} · ${activity.placeName || 'Ort'} · ${spotsStr} · Beitreten über Aktiva`;

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://aktiva-six.vercel.app';
    const inviteUrl = `${baseUrl}/activities/${activityId}/invite`;
    const imageUrl = `${baseUrl}/api/og/activity/${activityId}`;

    return {
      title: activityTitle,
      description: activityDescription,
      metadataBase: new URL(baseUrl),
      alternates: {
        canonical: inviteUrl,
      },
      openGraph: {
        type: 'website',
        siteName: 'Aktiva',
        locale: 'de_DE',
        url: inviteUrl,
        title: activityTitle,
        description: activityDescription,
        images: [
          {
            url: imageUrl,
            secureUrl: imageUrl,
            width: 1200,
            height: 630,
            type: 'image/png',
            alt: `${activityTitle} – Einladung über Aktiva`,
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title: activityTitle,
        description: activityDescription,
        images: [imageUrl],
      },
    };
  } catch (err) {
    return { title: 'Aktivität Einladung | Aktiva' };
  }
}

export default async function ActivityInvitePage({ params, searchParams }: Props) {
  const { activityId } = await params;
  const sParams = await searchParams;
  const referralCode = sParams.ref || '';

  if (!activityId) {
    notFound();
  }

  const activity = await getActivityRest(activityId);

  if (!activity) {
    notFound();
  }

  // Guard: Blacklisted
  if (activity.status === 'blacklisted') {
    notFound();
  }

  const isCancelled = activity.status === 'cancelled';

  const isTimeFlexible = !!activity.isTimeFlexible;
  const isDateFlexible = !!activity.isDateFlexible;

  const dateObj = activity.activityDate?.toDate ? activity.activityDate.toDate() : null;
  const endDateObj = activity.activityEndDate?.toDate ? activity.activityEndDate.toDate() : null;

  let isPast = false;
  if (activity.status === 'completed') {
    isPast = true;
  } else if (endDateObj) {
    isPast = endDateObj.getTime() < Date.now();
  } else if (isDateFlexible) {
    isPast = false;
  } else if (isTimeFlexible && dateObj) {
    const endOfDay = new Date(dateObj);
    endOfDay.setHours(23, 59, 59, 999);
    isPast = endOfDay.getTime() < Date.now();
  } else if (dateObj) {
    isPast = dateObj.getTime() < Date.now();
  }

  const isCompleted = activity.status === 'completed' || isPast;

  const timeStr = dateObj
    ? dateObj.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    : '';

  let dateDisplayStr = '';
  if (isDateFlexible) {
    dateDisplayStr = 'Datum & Zeit flexibel';
  } else if (isTimeFlexible) {
    const dayStr = dateObj
      ? dateObj.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })
      : '';
    dateDisplayStr = dayStr ? `${dayStr} (Zeit flexibel)` : 'Zeit flexibel';
  } else {
    const dayStr = dateObj
      ? dateObj.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })
      : '';
    dateDisplayStr = dayStr ? `${dayStr} um ${timeStr} Uhr` : '';
  }

  const spotsLeft = (activity.maxParticipants || 0) - (activity.participantIds?.length || 0);
  const spotsStr = activity.maxParticipants
    ? `${spotsLeft} von ${activity.maxParticipants} Plätzen frei`
    : 'Plätze frei';

  const categoryName = activity.category || 'Sonstiges';

  // Construct redirection URL back to main activity view (passing referral code)
  const joinUrl = `/activities/${activityId}${referralCode ? `?ref=${referralCode}` : ''}`;

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden select-none">
      {/* Background blobs for rich aesthetics */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-violet-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-emerald-600/10 blur-[120px] pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-md bg-white/5 dark:bg-neutral-900/50 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-6 sm:p-8 shadow-2xl flex flex-col relative z-10">
        
        {/* Header Branding */}
        <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-6">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-violet-500 to-indigo-600 flex items-center justify-center shadow-md shadow-violet-500/20">
              <span className="text-white font-black text-sm">A</span>
            </div>
            <span className="font-black text-base tracking-widest text-white">AKTIVA</span>
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-violet-400 bg-violet-500/10 px-3 py-1 rounded-full border border-violet-500/20">
            Einladung
          </span>
        </div>

        {/* Cancelled Warning */}
        {isCancelled && (
          <div className="mb-6 p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-3 text-rose-400 text-xs font-semibold">
            <ShieldAlert className="h-5 w-5 shrink-0" />
            <span>Diese Aktivität wurde vom Host abgesagt.</span>
          </div>
        )}

        {/* Completed Warning */}
        {!isCancelled && isCompleted && (
          <div className="mb-6 p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center gap-3 text-amber-400 text-xs font-semibold">
            <ShieldAlert className="h-5 w-5 shrink-0" />
            <span>Diese Aktivität ist bereits beendet.</span>
          </div>
        )}

        {/* Activity Details Card */}
        <div className="flex flex-col gap-5">
          <div>
            <span className="text-xs font-black uppercase tracking-wider text-violet-400">
              {categoryName}
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-white mt-1 leading-snug break-words">
              {activity.title || 'Unbenanntes Treffen'}
            </h1>
          </div>

          <div className="space-y-3.5">
            {/* Time */}
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-350 shrink-0">
                <Calendar className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-400">Datum & Uhrzeit</div>
                <div className="text-sm font-black text-white mt-0.5">
                  {dateDisplayStr || 'Zeitlich flexibel'}
                </div>
              </div>
            </div>

            {/* Place */}
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-350 shrink-0">
                <MapPin className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-400">Ort</div>
                <div className="text-sm font-black text-white mt-0.5">
                  {activity.placeName || 'Wird noch bekanntgegeben'}
                </div>
                {activity.city && (
                  <div className="text-xs font-semibold text-slate-450 mt-0.5">
                    {activity.city}
                  </div>
                )}
              </div>
            </div>

            {/* Spots availability */}
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-350 shrink-0">
                <Users className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-slate-400">Verfügbarkeit</div>
                <div className="text-sm font-black text-white mt-0.5">
                  {spotsStr}
                </div>
                {activity.maxParticipants && (
                  <div className="w-full bg-white/5 rounded-full h-1.5 mt-2 overflow-hidden border border-white/5">
                    <div 
                      className="bg-gradient-to-r from-violet-500 to-indigo-500 h-1.5 rounded-full transition-all duration-550"
                      style={{ width: `${Math.min(100, Math.max(0, (activity.participantIds?.length || 0) / activity.maxParticipants * 100))}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Host Profile Info */}
          {(() => {
            const hostUsernameRaw = activity.hostUsername || null;
            const hostUsernameFormatted = hostUsernameRaw ? `@${hostUsernameRaw.replace(/^@/, '')}` : "Aktiva-Nutzer";
            return (
              <div className="flex items-center gap-3 p-4 bg-white/5 border border-white/10 rounded-2xl mt-2">
                {activity.hostPhotoURL ? (
                  <img 
                    src={activity.hostPhotoURL} 
                    alt="Host Avatar"
                    className="h-10 w-10 rounded-full object-cover border border-white/20 shadow-sm"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-violet-500/20 text-violet-400 border border-violet-500/20 flex items-center justify-center font-black text-sm">
                    {hostUsernameFormatted.replace(/^@/, '').charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Veranstaltet von</div>
                  <div className="text-sm font-black text-white truncate">{hostUsernameFormatted}</div>
                </div>
              </div>
            );
          })()}

          {/* Call to Action button */}
          <Link href={joinUrl} className="mt-4 w-full">
            <button 
              disabled={isCancelled}
              className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-700 disabled:text-slate-400 text-white rounded-2xl font-black flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/20 active:scale-[0.98] transition-all outline-none"
            >
              <span>{isCompleted ? 'Aktivität ansehen' : 'Beitreten über Aktiva'}</span>
              <ArrowRight className="h-5 w-5" />
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
