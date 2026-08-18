'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';

/**
 * SSE client hook — connects to the notifications stream when authenticated.
 *
 * Uses fetch + ReadableStream instead of EventSource because EventSource
 * doesn't support custom headers (we need Authorization: Bearer <token>).
 *
 * Reconnects with exponential backoff: 1s → 2s → 4s → … → 60s max.
 *
 * ponytail: single-instance approach, no abstraction beyond what's needed.
 * Ceiling: if we need shared notification state (badge count, list), lift
 * into a context. For now, toast-on-receive is sufficient.
 */
export function useSSENotifications() {
    const { token, isAuthenticated } = useAuth();
    const { showToast } = useToast();
    const abortRef = useRef<AbortController | null>(null);
    const retryDelayRef = useRef(1000); // start at 1s
    const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const mountedRef = useRef(true);

    const connect = useCallback(async () => {
        if (!token || !mountedRef.current) return;

        // Abort any existing connection
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
        // The server mounts notifications at /api/v1/notifications/stream
        // NEXT_PUBLIC_API_URL is typically http://localhost:5000/api — replace /api with /api/v1
        const baseUrl = apiUrl.replace(/\/api\/?$/, '/api/v1');
        const url = `${baseUrl}/notifications/stream`;

        try {
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'text/event-stream',
                },
                signal: controller.signal,
            });

            if (!response.ok || !response.body) {
                throw new Error(`SSE connect failed: ${response.status}`);
            }

            // Connection succeeded — reset backoff
            retryDelayRef.current = 1000;

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (mountedRef.current) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });

                // Process complete SSE frames (double newline separated)
                const frames = buffer.split('\n\n');
                // Last element is incomplete — keep in buffer
                buffer = frames.pop() || '';

                for (const frame of frames) {
                    if (!frame.trim()) continue;
                    // Skip comments (heartbeats like ":heartbeat" or ":connected")
                    if (frame.startsWith(':')) continue;

                    // Extract data lines
                    const dataLines = frame
                        .split('\n')
                        .filter(line => line.startsWith('data: '))
                        .map(line => line.slice(6));

                    if (dataLines.length === 0) continue;

                    try {
                        const payload = JSON.parse(dataLines.join('\n'));
                        // Show a toast with the notification message
                        const message = payload.message || payload.title || 'New notification';
                        showToast(message, 'info');
                    } catch {
                        // Non-JSON data line — ignore
                    }
                }
            }
        } catch (err: unknown) {
            // AbortError means intentional disconnect — don't reconnect
            if (err instanceof DOMException && err.name === 'AbortError') return;
            if (!mountedRef.current) return;
        }

        // Connection dropped — schedule reconnect with exponential backoff
        if (mountedRef.current && token) {
            const delay = retryDelayRef.current;
            retryDelayRef.current = Math.min(delay * 2, 60_000); // cap at 60s
            retryTimeoutRef.current = setTimeout(() => {
                if (mountedRef.current) connect();
            }, delay);
        }
    }, [token, showToast]);

    useEffect(() => {
        mountedRef.current = true;

        if (isAuthenticated && token) {
            connect();
        }

        return () => {
            mountedRef.current = false;
            abortRef.current?.abort();
            if (retryTimeoutRef.current) {
                clearTimeout(retryTimeoutRef.current);
                retryTimeoutRef.current = null;
            }
        };
    }, [isAuthenticated, token, connect]);
}
