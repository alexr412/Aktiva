
'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { db } from '@/lib/firebase/client';
import { doc, getDoc } from 'firebase/firestore';
import { verifyTicket } from '@/lib/firebase/firestore';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, CheckCircle2, XCircle, Camera, ShieldCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

/**
 * MODUL 15: Einlass-Scanner Route.
 * Exklusiv für den Host der Aktivität zur Entwertung der QR-Tickets.
 */
export default function ScannerPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const activityId = params.activityId as string;

  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    if (!activityId || !user || !db) return;

    const checkAuth = async () => {
      try {
        const activitySnap = await getDoc(doc(db, 'activities', activityId));
        if (activitySnap.exists() && activitySnap.data().creatorId === user.uid) {
          setIsAuthorized(true);
        } else {
          router.replace(`/activities/${activityId}`);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [activityId, user, router]);

  useEffect(() => {
    if (!isAuthorized) return;

    // QR Scanner initialisieren
    const scanner = new Html5QrcodeScanner(
      "qr-reader", 
      { 
        fps: 10, 
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
      }, 
      false
    );
    
    scannerRef.current = scanner;

    scanner.render(async (decodedText) => {
      setScanResult(decodedText);
      setStatus('processing');
      
      try {
        const [scannedActivityId, scannedUserId] = decodedText.split('_');
        
        if (scannedActivityId !== activityId) {
          throw new Error("Dieses Ticket gehört zu einem anderen Event.");
        }
        
        await verifyTicket(activityId, scannedUserId);
        setStatus('success');
        toast({ title: "Ticket entwertet", description: "Zutritt gewährt." });
      } catch (error: any) {
        console.error(error);
        setStatus('error');
        setErrorMessage(error.message || "Validierung fehlgeschlagen.");
      }
    }, (error) => {
      // Kamera-Fehler während Fokussierung ignorieren
    });

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(err => console.warn("Scanner cleanup failed", err));
      }
    };
  }, [isAuthorized, activityId, toast]);

  const resetScanner = () => {
    setScanResult(null);
    setStatus('idle');
    setErrorMessage('');
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthorized) return null;

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-white overflow-hidden">
      <header className="flex h-16 shrink-0 items-center justify-between px-4 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 sticky top-0 z-20">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full text-slate-400 hover:text-white hover:bg-slate-800">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <h1 className="font-black text-sm uppercase tracking-widest">Entry Scanner</h1>
        </div>
        <div className="w-10" /> {/* Spacer */}
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6 gap-8">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div className="bg-slate-800/50 p-2 rounded-[2rem] border border-slate-700 relative">
            <div id="qr-reader" className="overflow-hidden rounded-3xl" />
            
            {status !== 'idle' && (
              <div className={cn(
                "absolute inset-0 z-10 flex flex-col items-center justify-center rounded-3xl backdrop-blur-md transition-all p-8 text-center",
                status === 'processing' && "bg-slate-900/60",
                status === 'success' && "bg-emerald-500/90",
                status === 'error' && "bg-red-500/90"
              )}>
                {status === 'processing' && <Loader2 className="h-12 w-12 animate-spin text-white mb-4" />}
                {status === 'success' && <CheckCircle2 className="h-20 w-20 text-white mb-4 animate-in zoom-in-50 duration-300" />}
                {status === 'error' && <XCircle className="h-20 w-20 text-white mb-4 animate-in zoom-in-50 duration-300" />}
                
                <h3 className="text-2xl font-black mb-2">
                  {status === 'processing' ? 'Verarbeite...' : status === 'success' ? 'Ticket Gültig' : 'Zugriff verweigert'}
                </h3>
                
                {status !== 'processing' && (
                  <>
                    <p className="text-white/80 font-medium mb-8">
                      {status === 'success' ? 'Der Teilnehmer wurde erfolgreich eingecheckt.' : errorMessage}
                    </p>
                    <Button 
                      onClick={resetScanner} 
                      className="bg-white text-slate-900 hover:bg-slate-100 rounded-2xl font-black h-14 px-8 shadow-xl"
                    >
                      Nächster Scan
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-slate-400 text-sm font-medium">Positioniere den QR-Code innerhalb des Rahmens</p>
            <div className="flex items-center justify-center gap-2 text-primary font-bold text-[10px] uppercase tracking-widest bg-primary/10 py-2 px-4 rounded-full w-fit mx-auto">
              <Camera className="h-3 w-3" />
              Live Scanner Aktiv
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
