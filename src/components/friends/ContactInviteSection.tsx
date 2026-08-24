'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/hooks/use-language';
import { ProfileAvatar } from '@/components/ui/profile-avatar';
import { Button } from '@/components/ui/button';
import { formatFirstName } from '@/lib/utils';
import { sendFriendRequest } from '@/lib/firebase/firestore';
import {
  hasContactPickerSupport,
  pickDeviceContacts,
  matchContactsWithServer,
  buildContactInviteUrls,
  ContactMatchResultItem,
} from '@/lib/contact-matching';
import { shareOrCopyReferralLink } from '@/lib/referral';
import {
  Users,
  UserPlus,
  Check,
  Loader2,
  Share2,
  Mail,
  MessageSquare,
  Copy,
  Sparkles,
  Smartphone,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';

interface ContactInviteSectionProps {
  onFriendRequestSent?: () => void;
}

export function ContactInviteSection({ onFriendRequestSent }: ContactInviteSectionProps) {
  const { user, userProfile } = useAuth();
  const { toast } = useToast();
  const language = useLanguage();

  const [isLoading, setIsLoading] = useState(false);
  const [contactsResults, setContactsResults] = useState<ContactMatchResultItem[] | null>(null);
  const [sentRequestsLocally, setSentRequestsLocally] = useState<Record<string, boolean>>({});

  const hasSupport = hasContactPickerSupport();
  const referralCode = userProfile?.referralCode || user?.uid || '';
  const inviteUrls = buildContactInviteUrls(referralCode, language);

  const handlePickContacts = async () => {
    setIsLoading(true);
    try {
      const rawContacts = await pickDeviceContacts();
      if (rawContacts.length === 0) {
        setIsLoading(false);
        return;
      }

      const matched = await matchContactsWithServer(rawContacts);
      setContactsResults(matched);
    } catch (err: any) {
      console.error('Contact picker error:', err);
      toast({
        variant: 'destructive',
        title: language === 'de' ? 'Fehler' : 'Error',
        description:
          err?.message === 'CONTACT_PICKER_UNSUPPORTED'
            ? language === 'de'
              ? 'Kontakt-Auswahl wird von diesem Browser nicht unterstützt.'
              : 'Contact picker is not supported on this browser.'
            : language === 'de'
            ? 'Kontakte konnten nicht geladen werden.'
            : 'Could not load contacts.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendFriendRequest = async (targetUid: string) => {
    if (!user) return;
    setSentRequestsLocally((prev) => ({ ...prev, [targetUid]: true }));

    try {
      await sendFriendRequest(user.uid, targetUid);
      toast({
        title: language === 'de' ? 'Anfrage gesendet!' : 'Request Sent!',
        description:
          language === 'de'
            ? 'Freundschaftsanfrage wurde erfolgreich gesendet.'
            : 'Friend request was sent successfully.',
      });
      if (onFriendRequestSent) onFriendRequestSent();
    } catch (err: any) {
      setSentRequestsLocally((prev) => ({ ...prev, [targetUid]: false }));
      toast({
        variant: 'destructive',
        title: language === 'de' ? 'Fehler' : 'Error',
        description: err.message || (language === 'de' ? 'Konnte Anfrage nicht senden.' : 'Could not send request.'),
      });
    }
  };

  const handleShareLink = async () => {
    if (!referralCode) return;
    const res = await shareOrCopyReferralLink({ referralCode, language });
    if (res.success) {
      toast({
        title: res.action === 'copy' ? (language === 'de' ? 'Link kopiert!' : 'Link copied!') : (language === 'de' ? 'Erfolgreich geteilt!' : 'Shared successfully!'),
        description: language === 'de' ? 'Dein persönlicher Einladungslink wurde kopiert.' : 'Your referral link was copied.',
      });
    }
  };

  const matchedOnActiva = contactsResults?.filter((c) => !!c.matchedUser) || [];
  const inviteContacts = contactsResults?.filter((c) => !c.matchedUser) || [];

  return (
    <div className="space-y-5 w-full">
      {/* 1. Header / Action Trigger */}
      {hasSupport && (
        <div className="p-5 rounded-3xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 flex flex-col gap-3.5 shadow-sm">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-500/20 mt-0.5">
              <Smartphone className="w-5 h-5" />
            </div>
            <div className="flex flex-col min-w-0">
              <h4 className="font-black text-slate-900 dark:text-neutral-100 text-sm tracking-tight">
                {language === 'de' ? 'Freunde aus Kontakten finden' : 'Find Friends from Contacts'}
              </h4>
              <p className="text-xs font-medium text-slate-500 dark:text-neutral-400 leading-snug mt-0.5">
                {language === 'de'
                  ? 'Wähle Kontakte aus deinem Adressbuch, um zu sehen, wer bereits auf Activa ist.'
                  : 'Select contacts from your address book to see who is already on Activa.'}
              </p>
            </div>
          </div>

          <Button
            onClick={handlePickContacts}
            disabled={isLoading}
            className="w-full h-11 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs sm:text-sm shadow-md shadow-emerald-500/20 active:scale-98 transition-all flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{language === 'de' ? 'Kontakte werden abgeglichen...' : 'Matching contacts...'}</span>
              </>
            ) : (
              <>
                <Users className="w-4 h-4" />
                <span>{contactsResults ? (language === 'de' ? 'Weitere Kontakte auswählen' : 'Select more contacts') : (language === 'de' ? 'Kontakte auswählen' : 'Select contacts')}</span>
              </>
            )}
          </Button>

          <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400 dark:text-neutral-500 px-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span>
              {language === 'de'
                ? 'Du entscheidest, welche Kontakte du auswählst. Keine dauerhafte Speicherung.'
                : 'You choose which contacts to select. No permanent storage.'}
            </span>
          </div>
        </div>
      )}

      {/* 2. Results Section (if contacts loaded) */}
      {contactsResults && (
        <div className="space-y-5 animate-in fade-in-50">
          {/* A. Auf Activa */}
          {matchedOnActiva.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-neutral-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                  {language === 'de' ? 'Auf Activa' : 'On Activa'}
                </span>
                <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full text-[11px] font-bold">
                  {matchedOnActiva.length}
                </span>
              </div>

              <div className="space-y-2">
                {matchedOnActiva.map((item) => {
                  const mUser = item.matchedUser!;
                  const isSent = sentRequestsLocally[mUser.uid] || mUser.friendState === 'sent';
                  const isFriend = mUser.friendState === 'friend';

                  return (
                    <div
                      key={item.contactKey}
                      className="flex items-center justify-between p-3 bg-slate-50 dark:bg-neutral-900 border border-slate-100 dark:border-neutral-800 rounded-2xl gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <ProfileAvatar
                          className="w-10 h-10 shrink-0"
                          photoURL={mUser.photoURL}
                          displayName={mUser.displayName}
                        />
                        <div className="flex flex-col min-w-0">
                          <span className="font-bold text-sm text-slate-900 dark:text-neutral-100 truncate">
                            {formatFirstName(mUser.displayName, item.contactName)}
                          </span>
                          <span className="text-[11px] font-medium text-slate-400 truncate">
                            {mUser.username ? `@${mUser.username.replace(/^@/, '')}` : item.contactName}
                          </span>
                        </div>
                      </div>

                      {isFriend ? (
                        <div className="px-3 py-1.5 bg-slate-200/70 dark:bg-neutral-800 text-slate-600 dark:text-neutral-300 font-bold text-xs rounded-xl shrink-0">
                          {language === 'de' ? 'Freunde' : 'Friends'}
                        </div>
                      ) : isSent ? (
                        <div className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-bold text-xs rounded-xl flex items-center gap-1 shrink-0 border border-emerald-100 dark:border-emerald-900/30">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                          <span>{language === 'de' ? 'Gesendet' : 'Sent'}</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleSendFriendRequest(mUser.uid)}
                          className="bg-emerald-500 hover:bg-emerald-600 text-white px-3.5 py-1.5 rounded-xl font-bold text-xs shadow-sm shadow-emerald-500/20 active:scale-95 transition-all flex items-center gap-1.5 shrink-0"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>{language === 'de' ? 'Hinzufügen' : 'Add'}</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* B. Kontakte einladen */}
          {inviteContacts.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-neutral-400">
                  {language === 'de' ? 'Kontakte einladen' : 'Invite Contacts'}
                </span>
                <span className="bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-400 px-2 py-0.5 rounded-full text-[11px] font-bold">
                  {inviteContacts.length}
                </span>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {inviteContacts.map((item) => {
                  const hasEmail = item.emails.length > 0;
                  const hasPhone = item.phones.length > 0;

                  return (
                    <div
                      key={item.contactKey}
                      className="flex items-center justify-between p-3 bg-slate-50/70 dark:bg-neutral-900/70 border border-slate-100 dark:border-neutral-800 rounded-2xl gap-3"
                    >
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-neutral-100 truncate">
                          {item.contactName}
                        </span>
                        <span className="text-[11px] font-medium text-slate-400 truncate">
                          {item.emails[0] || item.phones[0] || (language === 'de' ? 'Kontakt' : 'Contact')}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {hasPhone && (
                          <a
                            href={inviteUrls.whatsappUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition-all"
                            title="Via WhatsApp einladen"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </a>
                        )}
                        {hasPhone && (
                          <a
                            href={inviteUrls.smsUrl}
                            className="p-2 rounded-xl bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 transition-all"
                            title="Via SMS einladen"
                          >
                            <Smartphone className="w-4 h-4" />
                          </a>
                        )}
                        {hasEmail && (
                          <a
                            href={inviteUrls.mailtoUrl}
                            className="p-2 rounded-xl bg-purple-500/10 text-purple-600 hover:bg-purple-500/20 transition-all"
                            title="Via E-Mail einladen"
                          >
                            <Mail className="w-4 h-4" />
                          </a>
                        )}
                        {!hasPhone && !hasEmail && (
                          <button
                            onClick={handleShareLink}
                            className="p-2 rounded-xl bg-slate-200 dark:bg-neutral-800 text-slate-700 dark:text-neutral-300 hover:bg-slate-300 transition-all"
                            title="Einladungslink teilen"
                          >
                            <Share2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. General Invite Hub (for platforms without Contact Picker or quick sharing) */}
      <div className="p-4 rounded-3xl bg-slate-50 dark:bg-neutral-900 border border-slate-100 dark:border-neutral-800 space-y-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-neutral-300">
            {language === 'de' ? 'Freunde einladen' : 'Invite Friends'}
          </span>
          <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-100 dark:border-emerald-900/30">
            {language === 'de' ? 'Referral-Code' : 'Referral Code'}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <a
            href={inviteUrls.whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white dark:bg-neutral-800 border border-slate-100 dark:border-neutral-700/60 hover:border-emerald-500/40 transition-all text-center group"
          >
            <MessageSquare className="w-5 h-5 text-emerald-500 mb-1 group-hover:scale-110 transition-transform" />
            <span className="text-[11px] font-bold text-slate-700 dark:text-neutral-200">WhatsApp</span>
          </a>

          <a
            href={inviteUrls.smsUrl}
            className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white dark:bg-neutral-800 border border-slate-100 dark:border-neutral-700/60 hover:border-blue-500/40 transition-all text-center group"
          >
            <Smartphone className="w-5 h-5 text-blue-500 mb-1 group-hover:scale-110 transition-transform" />
            <span className="text-[11px] font-bold text-slate-700 dark:text-neutral-200">SMS</span>
          </a>

          <a
            href={inviteUrls.mailtoUrl}
            className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white dark:bg-neutral-800 border border-slate-100 dark:border-neutral-700/60 hover:border-purple-500/40 transition-all text-center group"
          >
            <Mail className="w-5 h-5 text-purple-500 mb-1 group-hover:scale-110 transition-transform" />
            <span className="text-[11px] font-bold text-slate-700 dark:text-neutral-200">E-Mail</span>
          </a>

          <button
            onClick={handleShareLink}
            className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white dark:bg-neutral-800 border border-slate-100 dark:border-neutral-700/60 hover:border-emerald-500/40 transition-all text-center group"
          >
            <Share2 className="w-5 h-5 text-slate-600 dark:text-neutral-400 mb-1 group-hover:scale-110 transition-transform" />
            <span className="text-[11px] font-bold text-slate-700 dark:text-neutral-200">
              {language === 'de' ? 'Link Teilen' : 'Share Link'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
