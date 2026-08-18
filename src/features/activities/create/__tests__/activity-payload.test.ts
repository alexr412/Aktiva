import assert from 'node:assert/strict';
import {
  buildActivityPayload,
  isCreateActivityDisabled,
  computeOpeningHoursWarning,
  BuildActivityPayloadOptions,
} from '../activity-payload';
import type { Place } from '@/lib/types';

const mockPlace: Place = {
  id: 'place_boulder',
  name: 'Kletterhalle Boulderwelt',
  category: 'Sport',
  categories: ['sport.climbing'],
  address: 'Münchener Str. 10',
  lat: 48.137,
  lon: 11.575,
  openingHours: 'Mo-Fr 10:00-22:00',
};

function runActivityPayloadTests() {
  console.log('--- RUNNING ACTIVITY PAYLOAD & VALIDATION TESTS ---');

  // Test 1: Disabled state validation
  console.log('Running testIsCreateActivityDisabled...');
  assert.equal(
    isCreateActivityDisabled({
      isCreating: false,
      isUnauthenticated: true,
      isOnboardingIncomplete: false,
      isBanned: false,
      selectedLocation: mockPlace,
      isSpecificPlaceMode: false,
      activityTitle: 'Bouldern gehen',
      isDateFlexible: false,
      selectedRange: {},
      selectedDate: new Date(),
    }),
    true,
    'Should be disabled when unauthenticated'
  );

  assert.equal(
    isCreateActivityDisabled({
      isCreating: false,
      isUnauthenticated: false,
      isOnboardingIncomplete: false,
      isBanned: false,
      selectedLocation: mockPlace,
      isSpecificPlaceMode: false,
      activityTitle: '',
      isDateFlexible: false,
      selectedRange: {},
      selectedDate: new Date(),
    }),
    true,
    'Should be disabled when title is empty in custom place mode'
  );

  assert.equal(
    isCreateActivityDisabled({
      isCreating: false,
      isUnauthenticated: false,
      isOnboardingIncomplete: false,
      isBanned: false,
      selectedLocation: mockPlace,
      isSpecificPlaceMode: true,
      activityTitle: '',
      isDateFlexible: false,
      selectedRange: {},
      selectedDate: new Date(),
    }),
    false,
    'Should NOT be disabled when in specific place mode even with empty title input'
  );
  console.log('✅ testIsCreateActivityDisabled passed');

  // Test 2: Payload building in custom place mode
  console.log('Running testBuildActivityPayloadCustomMode...');
  const dateObj = new Date(2026, 7, 20, 0, 0, 0); // 2026-08-20
  const options: BuildActivityPayloadOptions = {
    selectedLocation: mockPlace,
    activityTitle: 'Gemeinsam Bouldern',
    description: 'Wir suchen noch 2 Leute',
    selectedCategory: 'Sonstiges',
    selectedDate: dateObj,
    selectedRange: {},
    selectedTime: '18:30',
    isTimeFlexible: false,
    isDateFlexible: false,
    maxParticipants: 4,
    isBoosted: false,
    isPaid: false,
    price: 0,
    isSpecificPlaceMode: false,
    minAge: 20,
    maxAge: 40,
    allowedGenders: ['male', 'female'],
    requireProfilePicture: true,
    requireVerification: false,
    minimumRating: 4,
    joinMode: 'request',
    language: 'de',
  };

  const payload = buildActivityPayload(options);
  assert.ok(payload !== null, 'Payload should not be null');
  assert.equal(payload.title, 'Gemeinsam Bouldern');
  assert.equal(payload.category, 'Sonstiges');
  assert.equal(payload.startDate.getHours(), 18);
  assert.equal(payload.startDate.getMinutes(), 30);
  assert.equal(payload.timeIsFlexible, false);
  assert.deepStrictEqual(payload.requirements, {
    ageRange: { min: 20, max: 40 },
    gender: ['male', 'female'],
    requireProfilePicture: true,
    minimumRating: 4,
  });
  console.log('✅ testBuildActivityPayloadCustomMode passed');

  // Test 3: Auto category override in specific place mode
  console.log('Running testCategoryAutoOverride...');
  const optionsSpecific: BuildActivityPayloadOptions = {
    ...options,
    isSpecificPlaceMode: true,
  };
  const payloadSpecific = buildActivityPayload(optionsSpecific);
  assert.ok(payloadSpecific !== null);
  assert.equal(payloadSpecific.category, 'Sport', 'Category should auto-override to Sport');
  assert.equal(payloadSpecific.title, 'Kletterhalle Boulderwelt', 'Title should take place name in specific place mode');
  console.log('✅ testCategoryAutoOverride passed');

  // Test 4: Opening Hours Warning
  console.log('Running testOpeningHoursWarning...');
  const mondayDate = new Date(2026, 7, 17); // Aug 17, 2026 is Monday
  const warningOutside = computeOpeningHoursWarning(mockPlace, mondayDate, '08:00', false, 'de');
  assert.ok(warningOutside !== null && warningOutside.includes('ausßerhalb') || warningOutside?.includes('geöffnet'), 'Should return warning for time outside 10:00-22:00');

  const warningInside = computeOpeningHoursWarning(mockPlace, mondayDate, '14:00', false, 'de');
  assert.equal(warningInside, null, 'Should return null for time inside 10:00-22:00');
  console.log('✅ testOpeningHoursWarning passed');

  console.log('🎉 ALL ACTIVITY PAYLOAD TESTS PASSED SUCCESSFULLY! 🎉');
}

runActivityPayloadTests();
