
'use client';

import { QRCodeSVG } from 'qrcode.react';

interface TicketQRProps {
  activityId: string;
  userId: string;
}

/**
 * MODUL 15: QR-Ticket Komponente.
 * Kodiert Aktivitäts- und Nutzer-ID für den physischen Check-In.
 */
export function TicketQR({ activityId, userId }: TicketQRProps) {
  // Payload-Struktur für den Scanner
  const payload = `${activityId}_${userId}`;
  
  return (
    <div className="p-6 bg-white rounded-3xl border-2 border-slate-100 flex flex-col items-center shadow-sm">
      <div className="bg-slate-50 p-4 rounded-2xl mb-4">
        <QRCodeSVG 
          value={payload} 
          size={180} 
          level="H" 
          includeMargin={false}
          className="dark:invert"
        />
      </div>
      <div className="text-center space-y-1">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Scan to Verify</p>
        <p className="text-[8px] font-mono text-slate-300 uppercase tracking-tighter truncate max-w-[120px]">{activityId.slice(0,8)}</p>
      </div>
    </div>
  );
}
