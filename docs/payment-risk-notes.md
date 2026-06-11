# Financial Risk Note: Host Escrow Deficit & Soft-Capping in secureCancelActivity

This document details the observed financial risk, accounting implications, and future hardening recommendations regarding host escrow deficit behavior in the cancellation workflow.

---

## 1. Observed Behavior
During Phase 2B regression testing of `secureCancelActivity`, we verified that when a host cancels a paid activity, the transaction performs a "soft-cap" on the host's escrow balance deduction:
```typescript
const finalEscrow = Math.max(0, hostBalances.escrowBalanceCents - escrowDeductionCents);
```
If the host has an escrow balance lower than the total net refund amount required for all paying participants, the host's escrow balance is simply reduced to `0`. 
* The transaction completes successfully without throwing an exception.
* Full-price refund documents are still written to the `refunds` collection for all paying participants.
* **Accounting Gap:** No deficit logs, user debt records, or platform reserve ledger entries are recorded to track the financial difference.

---

## 2. Invariant Safety
This implementation is **safe from runtime invariant violations**:
* The host escrow is clamped to a lower bound of `0` using `Math.max(0, ...)`.
* The `assertBalanceInvariants` check verifies that both fiat and escrow balances are non-negative.
* Since the updated escrow balance is mathematically guaranteed to be `>= 0`, the invariant checks pass, preventing transaction aborts or runtime internal errors during cancellation.

---

## 3. Financial & Accounting Risks
Although safe from database invariant crashes, this soft-cap behavior introduces major financial risks:

1. **Untracked Platform Deficits (Float Exposure):**
   When the host's escrow account has insufficient funds to cover the cancellation, the platform is still obligated to refund participants the full amount. The remaining deficit is paid out from the platform's general float pool.
2. **Deficit Reclamation Gaps:**
   Since the deficit amount (the difference between the required net refund and the host's actual escrow balance) is not written to any collection, there is no automated record of how much the host owes the platform. The platform cannot automatically claw back these funds from the host's future payouts or fiat earnings.
3. **Exploitation Potential:**
   A malicious host could receive slot payments, wait for funds to clear (e.g. completed activities moving funds out of escrow), and then cancel active pending activities. The host retains their prior earnings while the platform absorbs the entire cost of the refunds.

---

## 4. Database Entities Affected
* **`users` (host document):** `escrowBalance` is set to `0`. No negative balance, debt flags, or deficit fields are updated.
* **`refunds`:** Refund documents are created with the full slot price and a `pending` status. No `deficit` or `platformCovered` flags are written.
* **`financial_ledger`:** Immutably logs `refund_created` entries for the full slot price per participant, but does not record the host's escrow contribution deficit.

---

## 5. Recommendations for Future Hardening
To eliminate this risk in future payment iterations, the following structures should be implemented:

1. **Introduce a User Debt / Negative Fiat Allocation:**
   Instead of clamping the escrow deduction at `0`, deduct the full required amount. If the escrow is exhausted, convert the remaining deficit into a negative `fiatBalance` or a new `pendingDebtCents` field on the host's profile:
   ```typescript
   const deficitCents = escrowDeductionCents - hostBalances.escrowBalanceCents;
   if (deficitCents > 0) {
     transaction.update(hostRef, {
       escrowBalance: 0,
       fiatBalance: hostBalances.fiatBalanceCents - deficitCents // host carries a negative balance
     });
   }
   ```
2. **Automated Deficit Ledger Logging:**
   Record an explicit `"escrow_deficit_recorded"` entry in the `financial_ledger` whenever a cancellation encounters a soft-cap event, enabling automated accounting audits to flag host profiles.
3. **Payout Hold Period:**
   Keep completed activity payouts in a temporary hold state on the platform for a set duration (e.g. 7 days post-completion) to cover potential dispute windows and cancellation liabilities before allowing fiat withdrawals.
