'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, User, ShieldAlert, ArrowRight, Loader2, FileText, CreditCard } from 'lucide-react';
import { db } from '@/lib/firebase/client';
import { collection, query, where, getDocs, limit, doc, getDoc } from 'firebase/firestore';

interface SearchResultItem {
  id: string;
  type: 'user' | 'report' | 'payout' | 'refund';
  title: string;
  subtitle: string;
  href: string;
}

interface AdminGlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AdminGlobalSearch({ open, onOpenChange }: AdminGlobalSearchProps) {
  const router = useRouter();
  const [term, setTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResultItem[]>([]);

  useEffect(() => {
    if (!term.trim() || !db) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      if (!db) return;
      setLoading(true);
      const queryStr = term.trim();
      const items: SearchResultItem[] = [];

      try {
        // 1. Direct UID or Username match on Users
        if (queryStr.length >= 3) {
          const qUid = query(collection(db, 'users'), where('uid', '==', queryStr), limit(3));
          const snapUid = await getDocs(qUid);
          snapUid.forEach(d => {
            const u = d.data();
            items.push({
              id: d.id,
              type: 'user',
              title: u.displayName || u.username || 'User',
              subtitle: `UID: ${d.id} • ${u.email || u.role || 'user'}`,
              href: `/admin/users`,
            });
          });

          // Check exact email
          if (queryStr.includes('@')) {
            const qEmail = query(collection(db, 'users'), where('email', '==', queryStr.toLowerCase()), limit(3));
            const snapEmail = await getDocs(qEmail);
            snapEmail.forEach(d => {
              if (!items.some(i => i.id === d.id)) {
                const u = d.data();
                items.push({
                  id: d.id,
                  type: 'user',
                  title: u.displayName || u.username || 'User',
                  subtitle: `Email: ${u.email}`,
                  href: `/admin/users`,
                });
              }
            });
          }
        }

        // 2. Direct Report ID or Entity ID match
        if (queryStr.length >= 5) {
          const reportDocRef = doc(db, 'reports', queryStr);
          const reportSnap = await getDoc(reportDocRef);
          if (reportSnap.exists()) {
            const r = reportSnap.data();
            items.push({
              id: reportSnap.id,
              type: 'report',
              title: `Report: ${r.reason || 'Meldung'}`,
              subtitle: `ID: ${reportSnap.id} • Target: ${r.reportedEntityId || r.activityId || 'Unknown'}`,
              href: `/admin/reports`,
            });
          }
        }

        // 3. Payout ID match
        if (queryStr.length >= 5) {
          const payoutDocRef = doc(db, 'payoutRequests', queryStr);
          const payoutSnap = await getDoc(payoutDocRef);
          if (payoutSnap.exists()) {
            const p = payoutSnap.data();
            items.push({
              id: payoutSnap.id,
              type: 'payout',
              title: `Payout Request: €${p.amount}`,
              subtitle: `Host ID: ${p.userId} • Status: ${p.status}`,
              href: `/admin/payouts`,
            });
          }
        }

        // 4. Refund ID match
        if (queryStr.length >= 5) {
          const refundDocRef = doc(db, 'refunds', queryStr);
          const refundSnap = await getDoc(refundDocRef);
          if (refundSnap.exists()) {
            const ref = refundSnap.data();
            items.push({
              id: refundSnap.id,
              type: 'refund',
              title: `Refund: €${ref.amount}`,
              subtitle: `User ID: ${ref.userId} • Activity: ${ref.activityId}`,
              href: `/admin/refunds`,
            });
          }
        }
      } catch (err) {
        console.warn('AdminGlobalSearch error:', err);
      } finally {
        setResults(items);
        setLoading(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [term]);

  const handleSelect = (item: SearchResultItem) => {
    onOpenChange(false);
    router.push(item.href);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 bg-white dark:bg-neutral-900 border-slate-200 dark:border-neutral-800 rounded-3xl overflow-hidden shadow-2xl">
        <DialogHeader className="p-4 border-b border-slate-100 dark:border-neutral-800 pb-3">
          <DialogTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Search className="w-4 h-4 text-primary" />
            Admin Schnellsuche
          </DialogTitle>
        </DialogHeader>

        <div className="p-4 space-y-4">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="UID, E-Mail, Username oder Report-/Transaktions-ID..."
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              className="pl-10 h-11 bg-slate-50 dark:bg-neutral-950 border-slate-200 dark:border-neutral-800 rounded-2xl text-sm"
              autoFocus
            />
            {loading && (
              <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-primary animate-spin" />
            )}
          </div>

          <div className="max-h-[320px] overflow-y-auto space-y-1">
            {results.length > 0 ? (
              results.map((item) => {
                const Icon =
                  item.type === 'user'
                    ? User
                    : item.type === 'report'
                    ? ShieldAlert
                    : item.type === 'payout'
                    ? CreditCard
                    : FileText;

                return (
                  <button
                    key={`${item.type}-${item.id}`}
                    onClick={() => handleSelect(item)}
                    className="w-full text-left p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-neutral-800/60 flex items-center justify-between transition-colors group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 rounded-xl bg-slate-100 dark:bg-neutral-800 text-slate-500 shrink-0">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {item.title}
                        </p>
                        <p className="text-xs text-slate-400 font-mono truncate">
                          {item.subtitle}
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-primary transition-transform group-hover:translate-x-1 shrink-0" />
                  </button>
                );
              })
            ) : term.trim() ? (
              !loading && (
                <div className="text-center py-8 text-xs text-slate-400">
                  Keine exakten Treffer für „{term}“ gefunden.
                </div>
              )
            ) : (
              <div className="text-center py-8 text-xs text-slate-400 font-medium">
                Suche nach exakter UID, E-Mail, Username, Report-ID oder Transaktions-ID.
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
