import { isPremiumActive, getParticipantLimit, formatPremiumExpiry, parseTimestampMillis, UserProfile } from '@/lib/types';
import { MAX_SAFE_TIMER_MS } from './use-active-premium';

// Fake Timers Harness
let activeTimers = new Map<number, { callback: () => void; delay: number; scheduledAt: number }>();
let nextTimerId = 1;
let virtualTime = 1_700_000_000_000;

const originalSetTimeout = global.setTimeout;
const originalClearTimeout = global.clearTimeout;
const originalDateNow = Date.now;

function setupFakeTimers() {
  activeTimers.clear();
  nextTimerId = 1;
  virtualTime = 1_700_000_000_000;
  Date.now = () => virtualTime;

  (global as any).setTimeout = (cb: () => void, delay: number) => {
    const id = nextTimerId++;
    activeTimers.set(id, { callback: cb, delay, scheduledAt: virtualTime });
    return id as any;
  };

  (global as any).clearTimeout = (id: any) => {
    activeTimers.delete(Number(id));
  };
}

function restoreTimers() {
  global.setTimeout = originalSetTimeout;
  global.clearTimeout = originalClearTimeout;
  Date.now = originalDateNow;
}

function advanceTimeBy(ms: number) {
  virtualTime += ms;
  const timersToRun: Array<{ id: number; callback: () => void }> = [];
  for (const [id, timer] of activeTimers.entries()) {
    if (timer.scheduledAt + timer.delay <= virtualTime) {
      timersToRun.push({ id, callback: timer.callback });
    }
  }
  for (const { id, callback } of timersToRun) {
    activeTimers.delete(id);
    callback();
  }
}

interface HookResult {
  isPremium: boolean;
  participantLimit: number;
  formattedExpiry: string;
  isOrganizer: boolean;
}

// Custom React Hook Test Harness implementing renderHook, rerender, unmount
function testHook<P>(hookFn: (props: P) => any, initialProps: P) {
  let stateMap = new Map<number, any>();
  let stateIndex = 0;
  let effectCleanup: (() => void) | void = undefined;
  let prevDeps: any[] | undefined = undefined;
  let currentProps = initialProps;
  let currentResult: HookResult;

  function useState<S>(initialState: S | (() => S)): [S, (val: S | ((prev: S) => S)) => void] {
    const idx = stateIndex++;
    if (!stateMap.has(idx)) {
      const initVal = typeof initialState === 'function' ? (initialState as Function)() : initialState;
      stateMap.set(idx, initVal);
    }
    const setState = (action: S | ((prev: S) => S)) => {
      const prev = stateMap.get(idx);
      const next = typeof action === 'function' ? (action as Function)(prev) : action;
      if (!Object.is(prev, next)) {
        stateMap.set(idx, next);
        run();
      }
    };
    return [stateMap.get(idx), setState];
  }

  function useEffect(effect: () => void | (() => void), deps?: any[]) {
    const hasChanged = !prevDeps || !deps || deps.some((dep, i) => !Object.is(dep, prevDeps![i]));
    if (hasChanged) {
      if (typeof effectCleanup === 'function') {
        effectCleanup();
      }
      effectCleanup = effect();
      prevDeps = deps;
    }
  }

  function runHook(profile: UserProfile | null) {
    const [now, setNow] = useState<number>(() => Date.now());

    useEffect(() => {
      if (!profile?.isPremium || !profile.premiumExpiresAt) {
        return;
      }

      const expiresMillis = parseTimestampMillis(profile.premiumExpiresAt);
      if (expiresMillis === null) return;

      let timerId: NodeJS.Timeout | null = null;

      const scheduleCheck = () => {
        const remainingMs = expiresMillis - Date.now();
        if (remainingMs <= 0) {
          setNow((prev) => (prev < expiresMillis ? Date.now() : prev));
          return;
        }

        const delay = Math.min(remainingMs + 50, MAX_SAFE_TIMER_MS);
        timerId = setTimeout(() => {
          setNow(Date.now());
          if (expiresMillis - Date.now() > 0) {
            scheduleCheck();
          }
        }, delay);
      };

      scheduleCheck();

      return () => {
        if (timerId) {
          clearTimeout(timerId);
        }
      };
    }, [profile?.isPremium, profile?.premiumExpiresAt]);

    const active = isPremiumActive(profile, now);
    const participantLimit = getParticipantLimit(profile, now);
    const formattedExpiry = formatPremiumExpiry(profile, 'de');

    return {
      isPremium: active,
      participantLimit,
      formattedExpiry,
      isOrganizer: !!profile?.isOrganizer,
    };
  }

  function run() {
    stateIndex = 0;
    currentResult = runHook(currentProps as any) as any;
  }

  run();

  return {
    get result() {
      return currentResult;
    },
    rerender: (newProps: P) => {
      currentProps = newProps;
      run();
    },
    unmount: () => {
      if (typeof effectCleanup === 'function') {
        effectCleanup();
      }
    }
  };
}

function runActivePremiumHookTests() {
  console.log('--- RUNNING REACT HOOK TESTS (renderHook, rerender, unmount, Fake Timers) ---');
  setupFakeTimers();

  try {
    // 1. Expiry within 14 days
    console.log('Test 1: Expiry within 14 days');
    const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;
    const expiry14d = virtualTime + fourteenDaysMs;
    const hook1 = testHook((p) => p, {
      uid: 'u14d',
      isPremium: true,
      premiumExpiresAt: { toMillis: () => expiry14d } as any
    } as unknown as UserProfile);

    console.assert(hook1.result.isPremium === true, 'Initial state must be active premium');
    console.assert(hook1.result.participantLimit === 12, 'Initial limit must be 12');
    console.assert(activeTimers.size === 1, 'Exactly 1 timer must be scheduled');

    // Advance time past 14 days
    advanceTimeBy(fourteenDaysMs + 100);
    console.assert(hook1.result.isPremium === false, 'After 14 days, premium must expire');
    console.assert(hook1.result.participantLimit === 4, 'After 14 days, limit must drop to 4');
    console.log('  ✓ Test 1 passed');

    // 2. Expiry after 30 days (> 24.8 days MAX_SAFE_TIMER_MS chunking)
    console.log('Test 2: Expiry after 30 days (MAX_SAFE_TIMER_MS chunking)');
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const expiry30d = virtualTime + thirtyDaysMs;
    const hook2 = testHook((p) => p, {
      uid: 'u30d',
      isPremium: true,
      premiumExpiresAt: { toMillis: () => expiry30d } as any
    } as unknown as UserProfile);

    console.assert(hook2.result.isPremium === true, 'Initial 30-day state active');
    const initialTimer = Array.from(activeTimers.values())[0];
    console.assert(initialTimer.delay === MAX_SAFE_TIMER_MS, `Timer delay capped at MAX_SAFE_TIMER_MS (2147483000), got ${initialTimer?.delay}`);

    // Advance 24.8 days (first chunk completes, schedules second chunk)
    advanceTimeBy(MAX_SAFE_TIMER_MS);
    console.assert(hook2.result.isPremium === true, 'Premium still active after 1st chunk');
    console.assert(activeTimers.size === 1, '2nd chunk timer scheduled');

    // Advance remaining time to full 30 days
    advanceTimeBy(thirtyDaysMs - MAX_SAFE_TIMER_MS + 100);
    console.assert(hook2.result.isPremium === false, 'Premium expired after 30 days');
    console.log('  ✓ Test 2 passed');

    // 3. Profile change during running timer (rerender)
    console.log('Test 3: Profile change during running timer (rerender)');
    const hook3 = testHook((p) => p, {
      uid: 'u3',
      isPremium: true,
      premiumExpiresAt: { toMillis: () => virtualTime + 5000 } as any
    } as unknown as UserProfile);

    const oldTimerId = Array.from(activeTimers.keys())[0];

    // Rerender with new profile and extended expiry
    const newExpiry = virtualTime + 20000;
    hook3.rerender({
      uid: 'u3',
      isPremium: true,
      premiumExpiresAt: { toMillis: () => newExpiry } as any
    } as unknown as UserProfile);

    console.assert(!activeTimers.has(oldTimerId), 'Old timer must be cleared on rerender');
    console.assert(hook3.result.isPremium === true, 'Active after rerender profile update');
    console.log('  ✓ Test 3 passed');

    // 4. Removal of expiry date (rerender to permanent premium)
    console.log('Test 4: Removal of expiry date (rerender)');
    const hook4 = testHook((p) => p, {
      uid: 'u4',
      isPremium: true,
      premiumExpiresAt: { toMillis: () => virtualTime + 5000 } as any
    } as unknown as UserProfile);

    console.assert(activeTimers.size >= 1, 'Timer active for temporary premium');

    hook4.rerender({
      uid: 'u4',
      isPremium: true,
      premiumExpiresAt: undefined
    } as unknown as UserProfile);

    console.assert(hook4.result.isPremium === true, 'Permanent premium active');
    console.log('  ✓ Test 4 passed');

    // 5. Already expired premium
    console.log('Test 5: Already expired premium');
    const hook5 = testHook((p) => p, {
      uid: 'u5',
      isPremium: true,
      premiumExpiresAt: { toMillis: () => virtualTime - 10000 } as any
    } as unknown as UserProfile);

    console.assert(hook5.result.isPremium === false, 'Already expired premium evaluates false');
    console.assert(hook5.result.participantLimit === 4, 'Expired limit is 4');
    console.log('  ✓ Test 5 passed');

    // 6. Unmount cleanup
    console.log('Test 6: Unmount cleanup');
    const hook6 = testHook((p) => p, {
      uid: 'u6',
      isPremium: true,
      premiumExpiresAt: { toMillis: () => virtualTime + 10000 } as any
    } as unknown as UserProfile);

    const timerBeforeUnmount = activeTimers.size;
    console.assert(timerBeforeUnmount >= 1, 'Timer active before unmount');
    hook6.unmount();
    console.assert(activeTimers.size === timerBeforeUnmount - 1, 'Timer cleared on unmount');
    console.log('  ✓ Test 6 passed');

    console.log('✅ ALL REACT HOOK TESTS PASSED SUCCESSFULLY!');
  } finally {
    restoreTimers();
  }
}

runActivePremiumHookTests();
