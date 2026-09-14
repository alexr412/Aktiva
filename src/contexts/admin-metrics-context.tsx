'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '@/lib/firebase/client';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useAuth } from '@/hooks/use-auth';
import type { Report, Refund, CreatorApplication } from '@/lib/types';
import { ACTIVE_REPORT_STATUSES } from '@/lib/types';
import { canModerateContent, canManagePayments, canApproveCreators } from '@/lib/permissions';

export interface PayoutRequest {
  id: string;
  userId: string;
  amount: number;
  status: string;
  createdAt?: any;
  processedAt?: any;
  [key: string]: any;
}

interface AdminMetricsContextType {
  openReportsCount: number;
  criticalReportsCount: number;
  pendingPayoutsCount: number;
  pendingPayoutsAmount: number;
  pendingRefundsCount: number;
  pendingRefundsAmount: number;
  pendingCreatorAppsCount: number;
  reportsList: Report[];
  payoutsList: PayoutRequest[];
  refundsList: Refund[];
  creatorAppsList: CreatorApplication[];
  loading: boolean;
}

const AdminMetricsContext = createContext<AdminMetricsContextType>({
  openReportsCount: 0,
  criticalReportsCount: 0,
  pendingPayoutsCount: 0,
  pendingPayoutsAmount: 0,
  pendingRefundsCount: 0,
  pendingRefundsAmount: 0,
  pendingCreatorAppsCount: 0,
  reportsList: [],
  payoutsList: [],
  refundsList: [],
  creatorAppsList: [],
  loading: true,
});

export const useAdminMetrics = () => useContext(AdminMetricsContext);

export function AdminMetricsProvider({ children }: { children: React.ReactNode }) {
  const { userProfile, loading: authLoading } = useAuth();
  const role = userProfile?.role;

  const [reportsList, setReportsList] = useState<Report[]>([]);
  const [payoutsList, setPayoutsList] = useState<PayoutRequest[]>([]);
  const [refundsList, setRefundsList] = useState<Refund[]>([]);
  const [creatorAppsList, setCreatorAppsList] = useState<CreatorApplication[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (authLoading || !db) {
      setLoading(false);
      return;
    }

    const allowReports = canModerateContent(role);
    const allowPayments = canManagePayments(role);
    const allowCreators = canApproveCreators(role);

    // If user has no permissions for any metric collection, stop loading immediately
    if (!allowReports && !allowPayments && !allowCreators) {
      setReportsList([]);
      setPayoutsList([]);
      setRefundsList([]);
      setCreatorAppsList([]);
      setLoading(false);
      return;
    }

    const unsubs: Array<() => void> = [];

    // 1. Reports Subscription (Only if role canModerateContent)
    if (allowReports) {
      const qReports = query(collection(db, 'reports'), where('status', 'in', ACTIVE_REPORT_STATUSES));
      const unsubReports = onSnapshot(qReports, (snap) => {
        setReportsList(snap.docs.map(d => ({ id: d.id, ...d.data() } as Report)));
      }, (err) => {
        console.warn('AdminMetrics: Reports snapshot error:', err);
      });
      unsubs.push(unsubReports);
    } else {
      setReportsList([]);
    }

    // 2. Payout Requests Subscription (Only if role canManagePayments)
    if (allowPayments) {
      const qPayouts = query(collection(db, 'payoutRequests'), where('status', '==', 'pending'));
      const unsubPayouts = onSnapshot(qPayouts, (snap) => {
        setPayoutsList(snap.docs.map(d => ({ id: d.id, ...d.data() } as PayoutRequest)));
      }, (err) => {
        console.warn('AdminMetrics: Payouts snapshot error:', err);
      });
      unsubs.push(unsubPayouts);

      // 3. Refunds Subscription (Only if role canManagePayments)
      const qRefunds = query(collection(db, 'refunds'), where('status', '==', 'pending'));
      const unsubRefunds = onSnapshot(qRefunds, (snap) => {
        setRefundsList(snap.docs.map(d => ({ id: d.id, ...d.data() } as Refund)));
      }, (err) => {
        console.warn('AdminMetrics: Refunds snapshot error:', err);
      });
      unsubs.push(unsubRefunds);
    } else {
      setPayoutsList([]);
      setRefundsList([]);
    }

    // 4. Creator Applications Subscription (Only if role canApproveCreators)
    if (allowCreators) {
      const qApps = query(collection(db, 'creator_applications'), where('status', '==', 'pending'));
      const unsubApps = onSnapshot(qApps, (snap) => {
        setCreatorAppsList(snap.docs.map(d => ({ id: d.id, ...d.data() } as CreatorApplication)));
      }, (err) => {
        console.warn('AdminMetrics: Creator apps snapshot error:', err);
      });
      unsubs.push(unsubApps);
    } else {
      setCreatorAppsList([]);
    }

    setLoading(false);

    return () => {
      unsubs.forEach(unsub => unsub());
    };
  }, [authLoading, role]);

  const openReportsCount = reportsList.length;
  const criticalReportsCount = reportsList.filter(
    r => r.status === 'moderation_review' || r.reason?.toLowerCase().includes('safety') || r.reason?.toLowerCase().includes('gefährdung')
  ).length;

  const pendingPayoutsCount = payoutsList.length;
  const pendingPayoutsAmount = payoutsList.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  const pendingRefundsCount = refundsList.length;
  const pendingRefundsAmount = refundsList.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

  const pendingCreatorAppsCount = creatorAppsList.length;

  return (
    <AdminMetricsContext.Provider
      value={{
        openReportsCount,
        criticalReportsCount,
        pendingPayoutsCount,
        pendingPayoutsAmount,
        pendingRefundsCount,
        pendingRefundsAmount,
        pendingCreatorAppsCount,
        reportsList,
        payoutsList,
        refundsList,
        creatorAppsList,
        loading,
      }}
    >
      {children}
    </AdminMetricsContext.Provider>
  );
}
