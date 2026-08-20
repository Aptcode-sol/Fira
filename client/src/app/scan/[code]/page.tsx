'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Scanner from '@/components/dashboard/Scanner';
import { API_BASE_URL } from '@/lib/siteConfig';

interface CodeInfo {
    valid: boolean;
    eventName: string | null;
    eventId: string | null;
    label: string;
}

interface CheckinResult {
    success: boolean;
    message?: string;
    ticket?: {
        ticketId: string;
        ticketType: string;
        quantity: number;
        user: { name: string; email: string };
    };
    error?: string;
}

type PageState = 'loading' | 'error' | 'scanning';

export default function ScanPage() {
    const params = useParams();
    const code = params.code as string;

    const [pageState, setPageState] = useState<PageState>('loading');
    const [errorMessage, setErrorMessage] = useState('');
    const [codeInfo, setCodeInfo] = useState<CodeInfo | null>(null);
    const [scanResult, setScanResult] = useState<CheckinResult | null>(null);
    const [isScanning, setIsScanning] = useState(true);
    const [showManualInput, setShowManualInput] = useState(false);
    const [manualTicketId, setManualTicketId] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Validate access code on mount
    useEffect(() => {
        async function validate() {
            try {
                const res = await fetch(`${API_BASE_URL}/scan/${code}`);
                const data = await res.json();
                if (!res.ok) {
                    setErrorMessage(data.error || 'Invalid access code');
                    setPageState('error');
                    return;
                }
                setCodeInfo(data);
                setPageState('scanning');
            } catch {
                setErrorMessage('Unable to connect to server');
                setPageState('error');
            }
        }
        validate();
    }, [code]);

    const handleCheckin = useCallback(async (ticketId: string) => {
        try {
            const res = await fetch(`${API_BASE_URL}/scan/${code}/checkin`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ticketId }),
            });
            const data = await res.json();

            if (res.ok && data.success) {
                setScanResult({ success: true, ticket: data.ticket });
            } else {
                setScanResult({ success: false, error: data.error || 'Check-in failed' });
            }
        } catch {
            setScanResult({ success: false, error: 'Network error — try again' });
        }
    }, [code]);

    const handleScan = useCallback(async (scannedValue: string) => {
        setIsScanning(false);
        await handleCheckin(scannedValue);

        // Auto-resume after 4 seconds
        timeoutRef.current = setTimeout(() => {
            setScanResult(null);
            setIsScanning(true);
        }, 4000);
    }, [handleCheckin]);

    const handleManualSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = manualTicketId.trim();
        if (!trimmed) return;

        setIsSubmitting(true);
        await handleCheckin(trimmed);
        setIsSubmitting(false);
        setManualTicketId('');
    };

    const resetScanner = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setScanResult(null);
        setIsScanning(true);
    };

    // Loading state
    if (pageState === 'loading') {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-gray-300">Validating access code…</p>
                </div>
            </div>
        );
    }

    // Error state (invalid / deactivated code)
    if (pageState === 'error') {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
                <div className="text-center max-w-sm">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
                        <svg className="w-8 h-8 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                    </div>
                    <h1 className="text-xl font-bold text-white mb-2">Access Denied</h1>
                    <p className="text-gray-400">{errorMessage}</p>
                </div>
            </div>
        );
    }

    // Scanning state
    return (
        <div className="min-h-screen bg-gray-950 px-4 py-6">
            <div className="max-w-sm mx-auto">
                {/* Header */}
                <div className="text-center mb-6">
                    <h1 className="text-lg font-bold text-white">{codeInfo?.eventName ?? 'Event'}</h1>
                    {codeInfo?.label && (
                        <p className="text-sm text-gray-400 mt-1">{codeInfo.label}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">Ticket Scanner</p>
                </div>

                {/* Scanner */}
                {!showManualInput && (
                    <div className="relative mb-6">
                        <Scanner onScan={handleScan} isActive={isScanning} />

                        {/* Result overlay */}
                        {scanResult && (
                            <div
                                className={`absolute inset-0 flex items-center justify-center rounded-2xl ${
                                    scanResult.success ? 'bg-green-500/90' : 'bg-red-500/90'
                                }`}
                            >
                                <div className="text-center p-6">
                                    {scanResult.success ? (
                                        <>
                                            <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-white/20 flex items-center justify-center">
                                                <svg className="w-10 h-10 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                                    <path d="M20 6L9 17l-5-5" />
                                                </svg>
                                            </div>
                                            <h3 className="text-lg font-bold text-white mb-1">Checked In</h3>
                                            {scanResult.ticket && (
                                                <>
                                                    <p className="text-white/80 font-medium">{scanResult.ticket.user.name}</p>
                                                    <p className="text-white/60 text-sm">
                                                        {scanResult.ticket.ticketType}
                                                        {scanResult.ticket.quantity > 1 && ` × ${scanResult.ticket.quantity}`}
                                                    </p>
                                                </>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-white/20 flex items-center justify-center">
                                                <svg className="w-10 h-10 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                                    <path d="M18 6L6 18M6 6l12 12" />
                                                </svg>
                                            </div>
                                            <h3 className="text-base font-bold text-white">{scanResult.error}</h3>
                                        </>
                                    )}

                                    <button
                                        onClick={resetScanner}
                                        className="mt-4 px-4 py-2 bg-white/20 rounded-lg text-white text-sm hover:bg-white/30 transition-colors"
                                    >
                                        Scan Next
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Manual input fallback */}
                {showManualInput && (
                    <div className="mb-6">
                        <form onSubmit={handleManualSubmit} className="space-y-3">
                            <input
                                type="text"
                                placeholder="Enter ticket ID"
                                value={manualTicketId}
                                onChange={(e) => setManualTicketId(e.target.value)}
                                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-violet-500"
                                autoFocus
                            />
                            <button
                                type="submit"
                                disabled={isSubmitting || !manualTicketId.trim()}
                                className="w-full py-3 bg-violet-600 text-white rounded-xl font-medium hover:bg-violet-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSubmitting ? 'Checking in…' : 'Check In'}
                            </button>
                        </form>

                        {/* Manual input result */}
                        {scanResult && (
                            <div
                                className={`mt-4 p-4 rounded-xl ${
                                    scanResult.success ? 'bg-green-500/20 border border-green-500/30' : 'bg-red-500/20 border border-red-500/30'
                                }`}
                            >
                                {scanResult.success ? (
                                    <div className="text-center">
                                        <p className="text-green-400 font-medium">✓ Checked In</p>
                                        {scanResult.ticket && (
                                            <p className="text-green-300/80 text-sm mt-1">
                                                {scanResult.ticket.user.name} — {scanResult.ticket.ticketType}
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-red-400 text-center">{scanResult.error}</p>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Toggle between camera and manual */}
                <button
                    onClick={() => {
                        setShowManualInput(!showManualInput);
                        setScanResult(null);
                    }}
                    className="w-full py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
                >
                    {showManualInput ? '← Back to camera scanner' : 'Enter ticket ID manually'}
                </button>

                {/* Instructions */}
                {!showManualInput && (
                    <p className="text-center text-gray-400 text-sm mt-4">
                        Point camera at ticket QR code to check in
                    </p>
                )}
            </div>
        </div>
    );
}
