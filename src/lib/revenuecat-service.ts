'use client';

export interface PurchasePackage {
  identifier: string;
  packageType: 'MONTHLY' | 'ANNUAL';
  product: {
    identifier: string;
    priceString: string;
    price: number;
    currencyCode: string;
  };
}

export interface PurchaseOffering {
  identifier: string;
  packages: PurchasePackage[];
}

/**
 * Service to handle RevenueCat Purchases across Web and Mobile.
 */
export class RevenueCatService {
  private static isInitialized = false;

  public static async initialize(userId: string): Promise<void> {
    if (this.isInitialized) return;
    try {
      console.log(`[RevenueCat] Initializing Purchases SDK for User: ${userId}`);
      // In mobile build with @revenuecat/purchases-capacitor:
      // await Purchases.configure({ apiKey: process.env.NEXT_PUBLIC_REVENUECAT_KEY || '', appUserID: userId });
      this.isInitialized = true;
    } catch (err) {
      console.error('[RevenueCat] Failed to initialize:', err);
    }
  }

  public static async getOfferings(): Promise<Record<string, { monthlyPrice: string; annualPrice: string }>> {
    // Fallback/Mock prices aligned with user specification
    return {
      tier1: { monthlyPrice: '4,99 €', annualPrice: '50,88 €' },
      tier2: { monthlyPrice: '7,99 €', annualPrice: '71,88 €' },
      tier3: { monthlyPrice: '19,99 €', annualPrice: '160,68 €' },
    };
  }

  public static async purchaseTier(tier: 'tier1' | 'tier2' | 'tier3', isAnnual: boolean): Promise<boolean> {
    console.log(`[RevenueCat] Initiating purchase for ${tier} (annual: ${isAnnual})`);
    
    // Web / Stripe Fallback or Native Purchases Trigger
    if (typeof window !== 'undefined') {
      alert(`[RevenueCat Payment Sheet]\n\nGewähltes Paket: Activa ${tier.toUpperCase()}\nAbrechnung: ${isAnnual ? 'Jährlich' : 'Monatlich'}\n\nHier öffnet sich in Produktion der native App Store / Play Store oder Stripe Checkout.`);
      return true;
    }
    return false;
  }
}
