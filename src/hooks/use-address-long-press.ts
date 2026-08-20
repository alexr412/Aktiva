'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

export interface UseAddressLongPressOptions {
    address: string;
    placeName?: string;
    language?: 'de' | 'en';
    onDirectionsClick?: (e: React.MouseEvent) => void;
}

export function getMapsUrl(address: string, placeName?: string): string {
    const query = placeName && !address.toLowerCase().includes(placeName.toLowerCase())
        ? `${placeName}, ${address}`
        : address;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query || '')}`;
}

export function useAddressLongPress({
    address,
    placeName,
    language = 'de',
    onDirectionsClick,
}: UseAddressLongPressOptions) {
    const { toast } = useToast();
    const [copied, setCopied] = useState(false);

    const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
    const failsafeTimerRef = useRef<NodeJS.Timeout | null>(null);
    const startPosRef = useRef<{ x: number; y: number } | null>(null);
    const preventClickRef = useRef(false);
    const isTouchActiveRef = useRef(false);

    const mapsUrl = getMapsUrl(address, placeName);

    const clearLongPressTimer = useCallback(() => {
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
        startPosRef.current = null;
        isTouchActiveRef.current = false;
    }, []);

    const clearFailsafeTimer = useCallback(() => {
        if (failsafeTimerRef.current) {
            clearTimeout(failsafeTimerRef.current);
            failsafeTimerRef.current = null;
        }
    }, []);

    useEffect(() => {
        return () => {
            clearLongPressTimer();
            clearFailsafeTimer();
        };
    }, [clearLongPressTimer, clearFailsafeTimer]);

    const copyAddressLink = useCallback((e?: React.MouseEvent) => {
        if (e) {
            e.stopPropagation();
            e.preventDefault();
        }

        const textToCopy = address || mapsUrl;
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
            navigator.clipboard.writeText(textToCopy);
        }

        setCopied(true);
        toast({
            title: language === 'de' ? 'Adresse kopiert' : 'Address copied',
            description: language === 'de' ? 'Adresse in Zwischenablage kopiert.' : 'Address copied to clipboard.'
        });

        setTimeout(() => setCopied(false), 2000);
    }, [address, mapsUrl, language, toast]);

    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        if (e.pointerType !== 'touch') return;

        clearLongPressTimer();
        clearFailsafeTimer();
        preventClickRef.current = false;
        isTouchActiveRef.current = true;
        startPosRef.current = { x: e.clientX, y: e.clientY };

        longPressTimerRef.current = setTimeout(() => {
            preventClickRef.current = true;
            copyAddressLink();
            clearLongPressTimer();

            clearFailsafeTimer();
            failsafeTimerRef.current = setTimeout(() => {
                preventClickRef.current = false;
                failsafeTimerRef.current = null;
            }, 1000);
        }, 500);
    }, [clearLongPressTimer, clearFailsafeTimer, copyAddressLink]);

    const handlePointerMove = useCallback((e: React.PointerEvent) => {
        if (e.pointerType !== 'touch' || !startPosRef.current || !longPressTimerRef.current) return;

        const dx = e.clientX - startPosRef.current.x;
        const dy = e.clientY - startPosRef.current.y;
        const distance = Math.hypot(dx, dy);

        if (distance > 10) {
            clearLongPressTimer();
        }
    }, [clearLongPressTimer]);

    const handlePointerUp = useCallback((e: React.PointerEvent) => {
        if (e.pointerType !== 'touch') return;
        clearLongPressTimer();
    }, [clearLongPressTimer]);

    const handlePointerCancel = useCallback((e: React.PointerEvent) => {
        if (e.pointerType !== 'touch') return;
        clearLongPressTimer();
    }, [clearLongPressTimer]);

    const handleContextMenu = useCallback((e: React.SyntheticEvent) => {
        if (isTouchActiveRef.current || preventClickRef.current) {
            e.preventDefault();
        }
    }, []);

    const handleClick = useCallback((e: React.MouseEvent) => {
        if (preventClickRef.current) {
            e.preventDefault();
            e.stopPropagation();
            preventClickRef.current = false;
            clearFailsafeTimer();
            return;
        }

        if (onDirectionsClick) {
            onDirectionsClick(e);
        }
    }, [clearFailsafeTimer, onDirectionsClick]);

    return {
        mapsUrl,
        copied,
        copyAddressLink,
        handlers: {
            onPointerDown: handlePointerDown,
            onPointerMove: handlePointerMove,
            onPointerUp: handlePointerUp,
            onPointerCancel: handlePointerCancel,
            onContextMenu: handleContextMenu,
            onClick: handleClick,
        }
    };
}
