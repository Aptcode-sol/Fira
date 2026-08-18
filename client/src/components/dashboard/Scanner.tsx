'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

interface ScannerProps {
    onScan: (data: string) => void;
    onError?: (error: string) => void;
    isActive?: boolean;
}

export default function Scanner({ onScan, onError, isActive = true }: ScannerProps) {
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const [isStarted, setIsStarted] = useState(false);
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);
    const lastScannedRef = useRef<string>('');
    const scanCooldownRef = useRef<boolean>(false);

    const startScanner = useCallback(async () => {
        if (scannerRef.current || isStarted) return;

        try {
            const html5QrCode = new Html5Qrcode('qr-reader');
            scannerRef.current = html5QrCode;

            await html5QrCode.start(
                { facingMode: 'environment' },
                {
                    fps: 10,
                    qrbox: { width: 250, height: 250 },
                    aspectRatio: 1,
                },
                (decodedText) => {
                    // Prevent duplicate scans
                    if (scanCooldownRef.current) return;
                    if (decodedText === lastScannedRef.current) return;

                    lastScannedRef.current = decodedText;
                    scanCooldownRef.current = true;
                    onScan(decodedText);

                    // Reset cooldown after 2 seconds
                    setTimeout(() => {
                        scanCooldownRef.current = false;
                    }, 2000);
                },
                () => { } // Ignore scan failures
            );

            setIsStarted(true);
            setHasPermission(true);
        } catch (err: any) {
            console.error('Scanner error:', err);
            setHasPermission(false);
            onError?.(err.message || 'Camera access denied');
        }
    }, [onScan, onError, isStarted]);

    const stopScanner = useCallback(async () => {
        if (scannerRef.current && isStarted) {
            try {
                await scannerRef.current.stop();
                scannerRef.current = null;
                setIsStarted(false);
            } catch (err) {
                console.error('Stop scanner error:', err);
            }
        }
    }, [isStarted]);

    useEffect(() => {
        if (isActive) {
            startScanner();
        } else {
            stopScanner();
        }

        return () => {
            stopScanner();
        };
    }, [isActive, startScanner, stopScanner]);

    // Reset last scanned when component becomes inactive
    useEffect(() => {
        if (!isActive) {
            lastScannedRef.current = '';
        }
    }, [isActive]);

    return (
        <div className="relative w-full max-w-sm mx-auto">
            <div
                id="qr-reader"
                className="w-full rounded-2xl overflow-hidden bg-black/50"
                style={{ minHeight: '300px' }}
            />

            {/* Scanning overlay */}
            {isStarted && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-64 h-64 border-2 border-white/30 rounded-2xl relative">
                        <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-violet-500 rounded-tl-lg" />
                        <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-violet-500 rounded-tr-lg" />
                        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-violet-500 rounded-bl-lg" />
                        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-violet-500 rounded-br-lg" />

                        {/* Scanning line animation */}
                        <div className="absolute inset-x-0 top-1/2 h-0.5 bg-gradient-to-r from-transparent via-violet-500 to-transparent animate-pulse" />
                    </div>
                </div>
            )}

            {hasPermission === false && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80 rounded-2xl">
                    <div className="text-center p-4">
                        <p className="text-red-400 mb-2">Camera access required</p>
                        <p className="text-gray-300 text-sm">Please allow camera access to scan tickets</p>
                    </div>
                </div>
            )}

            {!isStarted && hasPermission !== false && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80 rounded-2xl">
                    <div className="flex items-center gap-2 text-gray-300">
                        <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                        <span>Starting camera...</span>
                    </div>
                </div>
            )}
        </div>
    );
}
