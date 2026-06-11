'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Shield, FileText } from 'lucide-react';
import { 
  AGBText, 
  TermsOfUseText, 
  PrivacyPolicyText, 
  CookiePolicyText,
  LegalPlaceholderNotice
} from './LegalTexts';

interface LegalConsentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccept: () => void;
  onDecline: () => void;
  language?: 'de' | 'en';
}

interface LegalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  closeText: string;
}

function LocalLegalDialog({
  open,
  onOpenChange,
  title,
  subtitle,
  icon,
  children,
  closeText
}: LegalDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80vh] w-[calc(100vw-2rem)] max-w-2xl flex-col overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white p-0 shadow-2xl dark:border-white/10 dark:bg-neutral-900 z-[9999]">
        <div className="shrink-0 border-b border-slate-200 px-6 py-5 dark:border-white/10">
          <DialogHeader className="text-left">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                {icon}
              </div>
              <DialogTitle className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white">
                {title}
              </DialogTitle>
            </div>
            <DialogDescription className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">
              {subtitle}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 scrollbar-thin">
          <div className="space-y-6 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {children}
          </div>
        </div>

        <div className="shrink-0 border-t border-slate-200 bg-white px-6 py-4 dark:border-white/10 dark:bg-neutral-900">
          <Button
            type="button"
            onClick={() => onOpenChange(false)}
            className="w-full h-12 rounded-full font-black uppercase tracking-widest transition-all"
          >
            {closeText}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function LegalConsentDialog({
  open,
  onOpenChange,
  onAccept,
  onDecline,
  language = 'de'
}: LegalConsentDialogProps) {
  // 1. Log render
  

  // 2. Component mount / unmount
  React.useEffect(() => {
    
    return () => {
      console.warn("[LEGAL DEBUG] LegalConsentDialog UNMOUNTED", {
        open,
        timestamp: Date.now(),
      });
    };
  }, []);

  // 3. Open prop watch
  React.useEffect(() => {
    
  }, [open]);

  const [termsAccepted, setTermsAccepted] = useState(false);
  const [useTermsAccepted, setUseTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [cookiesAccepted, setCookiesAccepted] = useState(false);

  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const [isUseTermsOpen, setIsUseTermsOpen] = useState(false);
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
  const [isCookiesOpen, setIsCookiesOpen] = useState(false);

  const allAccepted = termsAccepted && useTermsAccepted && privacyAccepted && cookiesAccepted;

  return (
    <>
      <Dialog 
        open={open} 
        onOpenChange={(nextOpen) => {
          
          if (!nextOpen) {
            console.warn("[LEGAL DEBUG] Dialog requested close via onOpenChange(false)", {
              ignored: true,
              timestamp: Date.now(),
            });
          }
          if (nextOpen) {
            onOpenChange?.(nextOpen);
          }
        }}
      >
        <DialogContent 
          className="sm:max-w-md rounded-[2.5rem] border-none shadow-2xl p-8 bg-white dark:bg-neutral-950 z-[999]"
          hideCloseButton={true}
          onPointerDownOutside={(e) => {
            
            e.preventDefault();
          }}
          onInteractOutside={(e) => {
            
            e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            
            e.preventDefault();
          }}
        >
          <DialogHeader className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                <Shield className="w-6 h-6 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                  {language === 'de' ? 'Rechtliches' : 'Legal Consent'}
                </DialogTitle>
                <DialogDescription className="text-xs font-bold text-slate-400 mt-1">
                  {language === 'de' 
                    ? 'Bitte bestätige deine Zustimmung zu unseren Richtlinien, um fortzufahren.' 
                    : 'Please confirm your agreement to our policies to continue.'}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 my-6">
            <div className="flex items-center space-x-3 space-y-0">
              <input 
                type="checkbox" 
                id="modal-terms"
                checked={termsAccepted} 
                onChange={(e) => {
                  
                  setTermsAccepted(e.target.checked);
                }} 
                className="w-5 h-5 rounded border-none bg-zinc-200 checked:bg-primary cursor-pointer" 
              />
              <label htmlFor="modal-terms" className="text-[11px] font-bold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                {language === 'de' ? 'Ich akzeptiere die' : 'I agree to the'}{' '}
                <button 
                  type="button"
                  onClick={() => setIsTermsOpen(true)}
                  className="text-primary hover:underline font-bold"
                >
                  {language === 'de' ? 'Allgemeinen Geschäftsbedingungen (AGB)' : 'Terms of Service'}
                </button>
              </label>
            </div>

            <div className="flex items-center space-x-3 space-y-0">
              <input 
                type="checkbox" 
                id="modal-useterms"
                checked={useTermsAccepted} 
                onChange={(e) => {
                  
                  setUseTermsAccepted(e.target.checked);
                }} 
                className="w-5 h-5 rounded border-none bg-zinc-200 checked:bg-primary cursor-pointer" 
              />
              <label htmlFor="modal-useterms" className="text-[11px] font-bold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                {language === 'de' ? 'Ich akzeptiere die' : 'I agree to the'}{' '}
                <button 
                  type="button"
                  onClick={() => setIsUseTermsOpen(true)}
                  className="text-primary hover:underline font-bold"
                >
                  {language === 'de' ? 'Nutzungsbedingungen' : 'Terms of Use'}
                </button>
              </label>
            </div>

            <div className="flex items-center space-x-3 space-y-0">
              <input 
                type="checkbox" 
                id="modal-privacy"
                checked={privacyAccepted} 
                onChange={(e) => {
                  
                  setPrivacyAccepted(e.target.checked);
                }} 
                className="w-5 h-5 rounded border-none bg-zinc-200 checked:bg-primary cursor-pointer" 
              />
              <label htmlFor="modal-privacy" className="text-[11px] font-bold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                {language === 'de' ? 'Ich akzeptiere die' : 'I agree to the'}{' '}
                <button 
                  type="button"
                  onClick={() => setIsPrivacyOpen(true)}
                  className="text-primary hover:underline font-bold"
                >
                  {language === 'de' ? 'Datenschutzerklärung' : 'Privacy Policy'}
                </button>
              </label>
            </div>

            <div className="flex items-center space-x-3 space-y-0">
              <input 
                type="checkbox" 
                id="modal-cookies"
                checked={cookiesAccepted} 
                onChange={(e) => {
                  
                  setCookiesAccepted(e.target.checked);
                }} 
                className="w-5 h-5 rounded border-none bg-zinc-200 checked:bg-primary cursor-pointer" 
              />
              <label htmlFor="modal-cookies" className="text-[11px] font-bold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                {language === 'de' ? 'Ich akzeptiere die' : 'I agree to the'}{' '}
                <button 
                  type="button"
                  onClick={() => setIsCookiesOpen(true)}
                  className="text-primary hover:underline font-bold"
                >
                  {language === 'de' ? 'Cookie-Richtlinie' : 'Cookie Policy'}
                </button>
              </label>
            </div>
          </div>

          <div className="flex flex-col gap-3 mt-6">
            <Button
              type="button"
              onClick={() => {
                
                onAccept();
              }}
              disabled={!allAccepted}
              className="w-full h-14 rounded-full font-black uppercase tracking-widest transition-all"
            >
              {language === 'de' ? 'Zustimmen und Weiter' : 'Agree and Continue'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                
                onDecline();
              }}
              className="w-full h-14 rounded-full text-slate-500 font-black uppercase tracking-widest hover:bg-slate-100 transition-all"
            >
              {language === 'de' ? 'Ablehnen' : 'Decline'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Subdialogs */}
      <LocalLegalDialog
        open={isTermsOpen}
        onOpenChange={setIsTermsOpen}
        title="AGB / Terms of Service"
        subtitle={language === 'de' ? "Vertragliche Grundlagen für die Nutzung von Aktiva." : "Contractual framework for using Aktiva."}
        icon={<FileText className="w-5 h-5 text-primary" />}
        closeText={language === 'de' ? "Schließen" : "Close"}
      >
        <LegalPlaceholderNotice />
        <AGBText language={language} />
      </LocalLegalDialog>

      <LocalLegalDialog
        open={isUseTermsOpen}
        onOpenChange={setIsUseTermsOpen}
        title={language === 'de' ? "Nutzungsbedingungen" : "Terms of Use"}
        subtitle={language === 'de' ? "Regeln für ein sicheres und respektvolles Miteinander auf Aktiva." : "Rules for a safe and respectful community on Aktiva."}
        icon={<FileText className="w-5 h-5 text-primary" />}
        closeText={language === 'de' ? "Schließen" : "Close"}
      >
        <LegalPlaceholderNotice />
        <TermsOfUseText language={language} />
      </LocalLegalDialog>

      <LocalLegalDialog
        open={isPrivacyOpen}
        onOpenChange={setIsPrivacyOpen}
        title="Datenschutzerklärung / Privacy Policy"
        subtitle={language === 'de' ? "Informationen darüber, wie Aktiva personenbezogene Daten verarbeitet." : "Information on how Aktiva processes personal data."}
        icon={<Shield className="w-5 h-5 text-primary" />}
        closeText={language === 'de' ? "Schließen" : "Close"}
      >
        <LegalPlaceholderNotice />
        <PrivacyPolicyText language={language} />
      </LocalLegalDialog>

      <LocalLegalDialog
        open={isCookiesOpen}
        onOpenChange={setIsCookiesOpen}
        title={language === 'de' ? "Cookie-Richtlinie" : "Cookie Policy"}
        subtitle={language === 'de' ? "Informationen zu Cookies, lokaler Speicherung und ähnlichen Technologien." : "Information about cookies, local storage and similar technologies."}
        icon={<Shield className="w-5 h-5 text-primary" />}
        closeText={language === 'de' ? "Schließen" : "Close"}
      >
        <LegalPlaceholderNotice />
        <CookiePolicyText language={language} />
      </LocalLegalDialog>
    </>
  );
}
