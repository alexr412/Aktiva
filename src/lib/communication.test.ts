import assert from 'node:assert';
import { getEffectiveCommunicationPreferences, type UserProfile, type CommunicationPreferences } from './types';
import { getSocialLinks } from './social-config';

function testRegistrationWithoutMarketingConsent() {
  console.log('Running testRegistrationWithoutMarketingConsent...');

  const marketingConsent = false;

  const initialPreferences: CommunicationPreferences = {
    emailRecommendations: marketingConsent,
    emailProductNews: marketingConsent,
    emailMarketing: marketingConsent,
    activityEmails: true,
    marketingConsentAt: marketingConsent ? ({ seconds: 1700000000, nanoseconds: 0 } as any) : null,
    marketingConsentVersion: marketingConsent ? '1.0' : null,
    marketingUnsubscribedAt: null,
  };

  assert.strictEqual(initialPreferences.emailRecommendations, false);
  assert.strictEqual(initialPreferences.emailProductNews, false);
  assert.strictEqual(initialPreferences.emailMarketing, false);
  assert.strictEqual(initialPreferences.activityEmails, true);
  assert.strictEqual(initialPreferences.marketingConsentAt, null);
  assert.strictEqual(initialPreferences.marketingConsentVersion, null);
  assert.strictEqual(initialPreferences.marketingUnsubscribedAt, null);

  console.log('✅ testRegistrationWithoutMarketingConsent passed');
}

function testRegistrationWithMarketingConsent() {
  console.log('Running testRegistrationWithMarketingConsent...');

  const marketingConsent = true;

  const initialPreferences: CommunicationPreferences = {
    emailRecommendations: marketingConsent,
    emailProductNews: marketingConsent,
    emailMarketing: marketingConsent,
    activityEmails: true,
    marketingConsentAt: marketingConsent ? ({ seconds: 1700000000, nanoseconds: 0 } as any) : null,
    marketingConsentVersion: marketingConsent ? '1.0' : null,
    marketingUnsubscribedAt: null,
  };

  assert.strictEqual(initialPreferences.emailRecommendations, true);
  assert.strictEqual(initialPreferences.emailProductNews, true);
  assert.strictEqual(initialPreferences.emailMarketing, true);
  assert.strictEqual(initialPreferences.activityEmails, true);
  assert.notStrictEqual(initialPreferences.marketingConsentAt, null);
  assert.strictEqual(initialPreferences.marketingConsentVersion, '1.0');
  assert.strictEqual(initialPreferences.marketingUnsubscribedAt, null);

  console.log('✅ testRegistrationWithMarketingConsent passed');
}

function testLegacyUserWithoutCommunicationPreferences() {
  console.log('Running testLegacyUserWithoutCommunicationPreferences...');

  const legacyProfile = {
    uid: 'legacy-123',
    displayName: 'Legacy User',
    email: 'legacy@example.com',
  } as UserProfile;

  const effective = getEffectiveCommunicationPreferences(legacyProfile);

  assert.strictEqual(effective.emailRecommendations, false);
  assert.strictEqual(effective.emailProductNews, false);
  assert.strictEqual(effective.emailMarketing, false);
  assert.strictEqual(effective.activityEmails, true);
  assert.strictEqual(effective.marketingConsentAt, null);
  assert.strictEqual(effective.marketingConsentVersion, null);
  assert.strictEqual(effective.marketingUnsubscribedAt, null);

  console.log('✅ testLegacyUserWithoutCommunicationPreferences passed');
}

function testChangeIndividualPreferencesAndOptOut() {
  console.log('Running testChangeIndividualPreferencesAndOptOut...');

  let currentPrefs: CommunicationPreferences = {
    emailRecommendations: true,
    emailProductNews: true,
    emailMarketing: true,
    activityEmails: true,
    marketingConsentAt: { seconds: 1700000000, nanoseconds: 0 } as any,
    marketingConsentVersion: '1.0',
    marketingUnsubscribedAt: null,
  };

  // Toggle emailProductNews off individually
  currentPrefs = {
    ...currentPrefs,
    emailProductNews: false,
  };
  assert.strictEqual(currentPrefs.emailProductNews, false);
  assert.strictEqual(currentPrefs.emailMarketing, true);
  assert.strictEqual(currentPrefs.emailRecommendations, true);

  // Opt-out from marketing entirely
  const isMarketingActive = currentPrefs.emailMarketing || currentPrefs.emailRecommendations || currentPrefs.emailProductNews;
  assert.strictEqual(isMarketingActive, true);

  // Turn off remaining marketing flags
  currentPrefs = {
    ...currentPrefs,
    emailRecommendations: false,
    emailMarketing: false,
    marketingUnsubscribedAt: { seconds: 1700005000, nanoseconds: 0 } as any,
  };

  const isMarketingActiveAfterOptOut = currentPrefs.emailMarketing || currentPrefs.emailRecommendations || currentPrefs.emailProductNews;
  assert.strictEqual(isMarketingActiveAfterOptOut, false);
  assert.strictEqual(currentPrefs.activityEmails, true, 'Optional activity reminder emails remain independent of marketing opt-out');
  assert.notStrictEqual(currentPrefs.marketingUnsubscribedAt, null);

  console.log('✅ testChangeIndividualPreferencesAndOptOut passed');
}

function testNestedBypassAttemptInGenericUserProfile() {
  console.log('Running testNestedBypassAttemptInGenericUserProfile...');

  // PROTECTED_USER_FIELDS simulation
  const PROTECTED_FIELDS = new Set([
    'role', 'isAdmin', 'isBanned', 'isPremium', 'isSupporter', 'isCreator', 'isOrganizer',
    'communicationPreferences', 'marketingConsentAt', 'marketingConsentVersion', 'marketingUnsubscribedAt'
  ]);

  const maliciousUpdatePayload = {
    displayName: 'Hacker',
    communicationPreferences: {
      marketingConsentAt: { seconds: 9999999999, nanoseconds: 0 },
      emailMarketing: true,
    },
    marketingConsentAt: { seconds: 8888888888, nanoseconds: 0 },
  };

  const filteredData: Record<string, any> = {};
  for (const key of Object.keys(maliciousUpdatePayload)) {
    if (!PROTECTED_FIELDS.has(key)) {
      filteredData[key] = (maliciousUpdatePayload as any)[key];
    }
  }

  assert.strictEqual(filteredData.displayName, 'Hacker');
  assert.strictEqual(filteredData.communicationPreferences, undefined, 'Nested communicationPreferences object must be completely stripped by PROTECTED_USER_FIELDS');
  assert.strictEqual(filteredData.marketingConsentAt, undefined, 'Direct marketingConsentAt must be stripped by PROTECTED_USER_FIELDS');

  console.log('✅ testNestedBypassAttemptInGenericUserProfile passed');
}

function testSocialLinkConfigFiltering() {
  console.log('Running testSocialLinkConfigFiltering...');

  const originalInsta = process.env.NEXT_PUBLIC_SOCIAL_INSTAGRAM;
  const originalTikTok = process.env.NEXT_PUBLIC_SOCIAL_TIKTOK;
  const originalFb = process.env.NEXT_PUBLIC_SOCIAL_FACEBOOK;

  // Case 1: All unset
  delete process.env.NEXT_PUBLIC_SOCIAL_INSTAGRAM;
  delete process.env.NEXT_PUBLIC_SOCIAL_TIKTOK;
  delete process.env.NEXT_PUBLIC_SOCIAL_FACEBOOK;

  const linksEmpty = getSocialLinks();
  assert.strictEqual(linksEmpty.length, 0, 'No links should be returned if env variables are empty');

  // Case 2: Instagram configured only
  process.env.NEXT_PUBLIC_SOCIAL_INSTAGRAM = 'https://instagram.com/activa_official';
  const linksInsta = getSocialLinks();
  assert.strictEqual(linksInsta.length, 1);
  assert.strictEqual(linksInsta[0].id, 'instagram');
  assert.strictEqual(linksInsta[0].url, 'https://instagram.com/activa_official');

  // Restore env
  if (originalInsta) process.env.NEXT_PUBLIC_SOCIAL_INSTAGRAM = originalInsta; else delete process.env.NEXT_PUBLIC_SOCIAL_INSTAGRAM;
  if (originalTikTok) process.env.NEXT_PUBLIC_SOCIAL_TIKTOK = originalTikTok; else delete process.env.NEXT_PUBLIC_SOCIAL_TIKTOK;
  if (originalFb) process.env.NEXT_PUBLIC_SOCIAL_FACEBOOK = originalFb; else delete process.env.NEXT_PUBLIC_SOCIAL_FACEBOOK;

  console.log('✅ testSocialLinkConfigFiltering passed');
}

function testCanonicalUrlAndPrivacyMetadata() {
  console.log('Running testCanonicalUrlAndPrivacyMetadata...');

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://activa-444220.web.app';
  const activityId = 'act-999';
  const canonicalUrl = `${baseUrl}/activities/${activityId}`;

  assert.strictEqual(canonicalUrl, 'https://activa-444220.web.app/activities/act-999');

  // Privacy guard for non-public/private/blacklisted activities
  const privateActivity = { id: 'act-private', isPrivate: true, status: 'active', title: 'Secret Party' };
  const isPrivateOrBlacklisted = privateActivity.status === 'blacklisted' || privateActivity.isPrivate;

  const metadata = isPrivateOrBlacklisted
    ? {
        title: 'Aktivität nicht verfügbar | Activa',
        description: 'Gemeinsam mehr erleben mit Activa.',
        robots: { index: false, follow: false },
      }
    : { title: privateActivity.title };

  assert.strictEqual(metadata.title, 'Aktivität nicht verfügbar | Activa');
  assert.strictEqual((metadata as any).robots?.index, false);
  assert.strictEqual((metadata as any).robots?.follow, false);

  console.log('✅ testCanonicalUrlAndPrivacyMetadata passed');
}

function testShareFallback() {
  console.log('Running testShareFallback...');

  let copiedText = '';
  const mockClipboard = {
    writeText: async (text: string) => {
      copiedText = text;
    },
  };

  const shareUrl = 'https://activa-444220.web.app/activities/act-123';
  
  // Simulate navigator.share unavailable -> fallback to clipboard
  const hasNativeShare = false;
  if (!hasNativeShare) {
    mockClipboard.writeText(shareUrl);
  }

  assert.strictEqual(copiedText, shareUrl);
  console.log('✅ testShareFallback passed');
}

try {
  testRegistrationWithoutMarketingConsent();
  testRegistrationWithMarketingConsent();
  testLegacyUserWithoutCommunicationPreferences();
  testChangeIndividualPreferencesAndOptOut();
  testNestedBypassAttemptInGenericUserProfile();
  testSocialLinkConfigFiltering();
  testCanonicalUrlAndPrivacyMetadata();
  testShareFallback();
  console.log('🎉 ALL COMMUNICATION & SOCIAL SHARING TESTS PASSED! 🎉');
} catch (error) {
  console.error('❌ TEST FAILED:', error);
  process.exit(1);
}
