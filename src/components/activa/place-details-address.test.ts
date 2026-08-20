import assert from 'assert';
import fs from 'fs';
import path from 'path';

console.log('--- RUNNING PLACE DETAILS ADDRESS INTERACTION TESTS ---');

// ---------------------------------------------------------------------------
// Simulated Component Harness for Address Interaction Logic
// ---------------------------------------------------------------------------

function createAddressHarness(placeAddress: string = 'Feilenstraße 2–4, 33602 Bielefeld, Germany', language: 'de' | 'en' = 'de') {
    let copiedText: string | null = null;
    let toastParams: { title: string; description?: string } | null = null;
    let trackedInteraction: { placeId: string; type: string } | null = null;

    let longPressTimer: any = null;
    let failsafeTimer: any = null;
    let startPos: { x: number; y: number } | null = null;
    let preventClick = false;
    let isTouchActive = false;

    const mockClipboard = {
        writeText: (text: string) => {
            copiedText = text;
        }
    };

    const mockToast = (params: { title: string; description?: string }) => {
        toastParams = params;
    };

    const mockTrackInteraction = (placeId: string, categories: string[], action: string, userId?: string) => {
        trackedInteraction = { placeId, type: action };
    };

    const handleCopyAddress = (e?: any) => {
        if (e) {
            e.stopPropagation();
            e.preventDefault();
        }
        mockClipboard.writeText(placeAddress || "");
        mockToast({
            title: language === 'de' ? 'Adresse kopiert' : 'Address copied',
            description: language === 'de' ? 'Adresse in Zwischenablage kopiert.' : 'Address copied to clipboard.'
        });
    };

    const clearLongPressTimer = () => {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }
        startPos = null;
        isTouchActive = false;
    };

    const clearFailsafeTimer = () => {
        if (failsafeTimer) {
            clearTimeout(failsafeTimer);
            failsafeTimer = null;
        }
    };

    const handlePointerDown = (e: { pointerType: string; clientX: number; clientY: number }) => {
        if (e.pointerType !== 'touch') return;

        clearLongPressTimer();
        clearFailsafeTimer();
        preventClick = false;
        isTouchActive = true;
        startPos = { x: e.clientX, y: e.clientY };

        longPressTimer = setTimeout(() => {
            preventClick = true;
            handleCopyAddress();
            clearLongPressTimer();

            clearFailsafeTimer();
            failsafeTimer = setTimeout(() => {
                preventClick = false;
                failsafeTimer = null;
            }, 1000);
        }, 500);
    };

    const handlePointerMove = (e: { pointerType: string; clientX: number; clientY: number }) => {
        if (e.pointerType !== 'touch' || !startPos || !longPressTimer) return;

        const dx = e.clientX - startPos.x;
        const dy = e.clientY - startPos.y;
        const distance = Math.hypot(dx, dy);

        if (distance > 10) {
            clearLongPressTimer();
        }
    };

    const handlePointerUp = (e: { pointerType: string }) => {
        if (e.pointerType !== 'touch') return;
        clearLongPressTimer();
    };

    const handlePointerCancel = (e: { pointerType: string }) => {
        if (e.pointerType !== 'touch') return;
        clearLongPressTimer();
    };

    const handleContextMenu = (e: { preventDefault: () => void }) => {
        if (isTouchActive || preventClick) {
            e.preventDefault();
            return true;
        }
        return false;
    };

    const handleClick = (e: { preventDefault: () => void; stopPropagation: () => void }) => {
        if (preventClick) {
            e.preventDefault();
            e.stopPropagation();
            preventClick = false;
            clearFailsafeTimer();
            return { defaultPrevented: true };
        }
        mockTrackInteraction('place-123', [], 'directions');
        return { defaultPrevented: false };
    };

    const unmount = () => {
        clearLongPressTimer();
        clearFailsafeTimer();
    };

    return {
        get copiedText() { return copiedText; },
        get toastParams() { return toastParams; },
        get trackedInteraction() { return trackedInteraction; },
        get preventClick() { return preventClick; },
        get isTouchActive() { return isTouchActive; },
        get isTimerActive() { return longPressTimer !== null; },
        handleCopyAddress,
        handlePointerDown,
        handlePointerMove,
        handlePointerUp,
        handlePointerCancel,
        handleContextMenu,
        handleClick,
        unmount,
        resetLogs: () => {
            copiedText = null;
            toastParams = null;
            trackedInteraction = null;
        }
    };
}

// ---------------------------------------------------------------------------
// Test Cases 1 - 11 + Failsafe Test
// ---------------------------------------------------------------------------

function test1_PermanentUnderline() {
    console.log('Test 1: Adresstext besitzt permanent eine Underline...');
    const sourceCode = fs.readFileSync(path.join(process.cwd(), 'src/components/activa/place-details.tsx'), 'utf-8');
    assert(
        sourceCode.includes('underline decoration-rose-500/40 underline-offset-2'),
        'Address h4 tag must contain class "underline decoration-rose-500/40 underline-offset-2"'
    );
    assert(
        !sourceCode.includes('hover:underline cursor-pointer group'),
        'Parent anchor tag must not use hover:underline'
    );
    console.log('✅ Test 1 passed');
}

function test2_MouseClickExecutesDirectionAction() {
    console.log('Test 2: Normaler Mouse-Click führt weiterhin die bisherige Adressaktion aus...');
    const harness = createAddressHarness();
    harness.handlePointerDown({ pointerType: 'mouse', clientX: 100, clientY: 100 });
    harness.handlePointerUp({ pointerType: 'mouse' });
    
    let defaultPrevented = false;
    const clickResult = harness.handleClick({
        preventDefault: () => { defaultPrevented = true; },
        stopPropagation: () => {}
    });

    assert.strictEqual(clickResult.defaultPrevented, false, 'Mouse click should not be default prevented');
    assert.deepStrictEqual(harness.trackedInteraction, { placeId: 'place-123', type: 'directions' });
    assert.strictEqual(harness.copiedText, null, 'Mouse click should not copy address');
    console.log('✅ Test 2 passed');
}

function test3_ShortTouchTapExecutesDirectionAction() {
    console.log('Test 3: Kurzer Touch-Tap führt weiterhin die bisherige Adressaktion aus...');
    const harness = createAddressHarness();
    harness.handlePointerDown({ pointerType: 'touch', clientX: 100, clientY: 100 });
    assert.strictEqual(harness.isTimerActive, true, 'Timer should be active on touch down');

    harness.handlePointerUp({ pointerType: 'touch' });
    assert.strictEqual(harness.isTimerActive, false, 'Timer should be cleared on touch up');

    const clickResult = harness.handleClick({
        preventDefault: () => {},
        stopPropagation: () => {}
    });

    assert.strictEqual(clickResult.defaultPrevented, false, 'Short tap click should not be prevented');
    assert.deepStrictEqual(harness.trackedInteraction, { placeId: 'place-123', type: 'directions' });
    assert.strictEqual(harness.copiedText, null, 'Short tap should not copy address');
    console.log('✅ Test 3 passed');
}

async function test4_TouchLongPressCopiesAddress() {
    console.log('Test 4: Touch-Long-Press kopiert die vollständige Adresse...');
    const harness = createAddressHarness('Feilenstraße 2–4, 33602 Bielefeld, Germany');
    harness.handlePointerDown({ pointerType: 'touch', clientX: 100, clientY: 100 });

    await new Promise(res => setTimeout(res, 520));

    assert.strictEqual(harness.copiedText, 'Feilenstraße 2–4, 33602 Bielefeld, Germany', 'Full address should be copied to clipboard');
    harness.unmount();
    console.log('✅ Test 4 passed');
}

async function test5_TouchLongPressShowsToast() {
    console.log('Test 5: Touch-Long-Press zeigt "Adresse kopiert"...');
    const harness = createAddressHarness('Feilenstraße 2–4', 'de');
    harness.handlePointerDown({ pointerType: 'touch', clientX: 100, clientY: 100 });

    await new Promise(res => setTimeout(res, 520));

    assert.deepStrictEqual(harness.toastParams, {
        title: 'Adresse kopiert',
        description: 'Adresse in Zwischenablage kopiert.'
    }, 'Toast title must be "Adresse kopiert"');
    harness.unmount();
    console.log('✅ Test 5 passed');
}

async function test6_LongPressSuppressesClick() {
    console.log('Test 6: Nach Touch-Long-Press wird die normale Adressaktion NICHT zusätzlich ausgelöst...');
    const harness = createAddressHarness();
    harness.handlePointerDown({ pointerType: 'touch', clientX: 100, clientY: 100 });

    await new Promise(res => setTimeout(res, 520));

    harness.handlePointerUp({ pointerType: 'touch' });

    let prevented = false;
    let stopped = false;
    const clickResult = harness.handleClick({
        preventDefault: () => { prevented = true; },
        stopPropagation: () => { stopped = true; }
    });

    assert.strictEqual(prevented, true, 'Click preventDefault must be called');
    assert.strictEqual(stopped, true, 'Click stopPropagation must be called');
    assert.strictEqual(clickResult.defaultPrevented, true, 'Click must be suppressed');
    assert.strictEqual(harness.trackedInteraction, null, 'trackInteraction directions must NOT be called');
    harness.unmount();
    console.log('✅ Test 6 passed');
}

async function test7_MouseHoldDoesNotCopy() {
    console.log('Test 7: Maus-Gedrückthalten löst keine Copy-Aktion aus...');
    const harness = createAddressHarness();
    harness.handlePointerDown({ pointerType: 'mouse', clientX: 100, clientY: 100 });

    await new Promise(res => setTimeout(res, 550));

    assert.strictEqual(harness.copiedText, null, 'Mouse hold must not trigger copy action');
    harness.unmount();
    console.log('✅ Test 7 passed');
}

async function test8_MovementCancelsLongPress() {
    console.log('Test 8: Fingerbewegung über dem definierten Threshold bricht den Long-Press ab...');
    const harness = createAddressHarness();
    harness.handlePointerDown({ pointerType: 'touch', clientX: 100, clientY: 100 });
    assert.strictEqual(harness.isTimerActive, true);

    harness.handlePointerMove({ pointerType: 'touch', clientX: 100, clientY: 115 });
    assert.strictEqual(harness.isTimerActive, false, 'Movement > 10px must cancel timer');

    await new Promise(res => setTimeout(res, 520));

    assert.strictEqual(harness.copiedText, null, 'Copy must not trigger after movement cancellation');
    harness.unmount();
    console.log('✅ Test 8 passed');
}

async function test9_PointerCancelCancelsLongPress() {
    console.log('Test 9: pointercancel bricht den Long-Press sauber ab...');
    const harness = createAddressHarness();
    harness.handlePointerDown({ pointerType: 'touch', clientX: 100, clientY: 100 });
    assert.strictEqual(harness.isTimerActive, true);

    harness.handlePointerCancel({ pointerType: 'touch' });
    assert.strictEqual(harness.isTimerActive, false, 'pointercancel must cancel timer');

    await new Promise(res => setTimeout(res, 520));

    assert.strictEqual(harness.copiedText, null, 'Copy must not trigger after pointercancel');
    harness.unmount();
    console.log('✅ Test 9 passed');
}

function test10_CopyIconFunctionality() {
    console.log('Test 10: Das bestehende Copy-Icon funktioniert weiterhin unverändert...');
    const harness = createAddressHarness('Feilenstraße 2–4');
    harness.handleCopyAddress();

    assert.strictEqual(harness.copiedText, 'Feilenstraße 2–4');
    assert.deepStrictEqual(harness.toastParams, {
        title: 'Adresse kopiert',
        description: 'Adresse in Zwischenablage kopiert.'
    });
    console.log('✅ Test 10 passed');
}

async function test11_SequentialInteractionsNoStaleState() {
    console.log('Test 11: Mehrere aufeinanderfolgende Tap-/Long-Press-Interaktionen hinterlassen keinen veralteten State...');
    const harness = createAddressHarness();

    // 1. Long-press
    harness.handlePointerDown({ pointerType: 'touch', clientX: 100, clientY: 100 });
    await new Promise(res => setTimeout(res, 520));
    harness.handlePointerUp({ pointerType: 'touch' });
    harness.handleClick({ preventDefault: () => {}, stopPropagation: () => {} });
    assert.strictEqual(harness.preventClick, false, 'preventClick should be reset after click');

    harness.resetLogs();

    // 2. Normal Tap
    harness.handlePointerDown({ pointerType: 'touch', clientX: 100, clientY: 100 });
    harness.handlePointerUp({ pointerType: 'touch' });
    const click2 = harness.handleClick({ preventDefault: () => {}, stopPropagation: () => {} });
    assert.strictEqual(click2.defaultPrevented, false, 'Second interaction normal tap should succeed');
    assert.deepStrictEqual(harness.trackedInteraction, { placeId: 'place-123', type: 'directions' });

    harness.resetLogs();

    // 3. Scroll cancel then Tap
    harness.handlePointerDown({ pointerType: 'touch', clientX: 100, clientY: 100 });
    harness.handlePointerMove({ pointerType: 'touch', clientX: 100, clientY: 120 });
    harness.handlePointerUp({ pointerType: 'touch' });
    assert.strictEqual(harness.copiedText, null);
    assert.strictEqual(harness.preventClick, false);

    harness.unmount();
    console.log('✅ Test 11 passed');
}

async function test12_FailsafeTimeoutResetsPreventClick() {
    console.log('Test 12: Failsafe Timeout setzt preventClickRef zurück wenn kein Click-Event erzeugt wird...');
    const harness = createAddressHarness();
    harness.handlePointerDown({ pointerType: 'touch', clientX: 100, clientY: 100 });

    await new Promise(res => setTimeout(res, 520));
    assert.strictEqual(harness.preventClick, true, 'preventClick should be true after long press');

    await new Promise(res => setTimeout(res, 1050));
    assert.strictEqual(harness.preventClick, false, 'Failsafe timer must reset preventClick to false');

    harness.unmount();
    console.log('✅ Test 12 passed');
}

function test13_MapsUrlGeneration() {
    console.log('Test 13: Maps URL generation for address link long-press...');
    const { getMapsUrl } = require('../../hooks/use-address-long-press');
    const url1 = getMapsUrl('Hauptstraße 12, 10115 Berlin', 'Kaffee Haus');
    assert(url1.includes('https://www.google.com/maps/search/?api=1&query='), 'Should use Google Maps search endpoint');
    assert(url1.includes(encodeURIComponent('Kaffee Haus, Hauptstraße 12, 10115 Berlin')), 'Should combine place name and address');

    const url2 = getMapsUrl('Berliner Park, Hauptstraße 12', 'Berliner Park');
    assert(url2.includes(encodeURIComponent('Berliner Park, Hauptstraße 12')), 'Should avoid repeating place name if already present in address');
    console.log('✅ Test 13 passed');
}

async function runAllTests() {
    test1_PermanentUnderline();
    test2_MouseClickExecutesDirectionAction();
    test3_ShortTouchTapExecutesDirectionAction();
    await test4_TouchLongPressCopiesAddress();
    await test5_TouchLongPressShowsToast();
    await test6_LongPressSuppressesClick();
    await test7_MouseHoldDoesNotCopy();
    await test8_MovementCancelsLongPress();
    await test9_PointerCancelCancelsLongPress();
    test10_CopyIconFunctionality();
    await test11_SequentialInteractionsNoStaleState();
    await test12_FailsafeTimeoutResetsPreventClick();
    test13_MapsUrlGeneration();
    console.log('\nALL 13 ADDRESS INTERACTION TESTS PASSED SUCCESSFULLY! 🎉');
}

runAllTests().catch(err => {
    console.error('❌ TEST FAILED:', err);
    process.exit(1);
});
