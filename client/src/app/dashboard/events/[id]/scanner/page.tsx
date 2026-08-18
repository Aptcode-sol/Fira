'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import Scanner from '@/components/dashboard/Scanner';
import { Button } from '@/components/ui';
import { eventsApi, ticketsApi } from '@/lib/api';

interface ScanResult {
    success: boolean;
    message: string;
    ticket?: {
        ticketId: string;
        ticketType: string;
        quantity: number;
        user: {
            name: string;
            email: string;
            phone?: string;
        };
        scannedAt: string;
    };
    error?: string;
}

interface ScanHistory {
    ticketId: string;
    userName: string;
    quantity: number;
    time: string;
    success: boolean;
}

export default function ScannerPage() {
    const params = useParams();
    const router = useRouter();
    const { user } = useAuth();
    const eventId = params.id as string;

    const [event, setEvent] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [scanResult, setScanResult] = useState<ScanResult | null>(null);
    const [scanHistory, setScanHistory] = useState<ScanHistory[]>([]);
    const [stats, setStats] = useState({ totalTickets: 0, scannedTickets: 0, totalAttendees: 0, scannedAttendees: 0 });
    const [isScanning, setIsScanning] = useState(true);

    useEffect(() => {
        if (eventId) {
            fetchEventAndStats();
        }
    }, [eventId]);

    const fetchEventAndStats = async () => {
        try {
            const [eventData, statsData] = await Promise.all([
                eventsApi.getById(eventId),
                fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/tickets/event/${eventId}/stats`).then(r => r.json())
            ]);
            setEvent(eventData);
            setStats(statsData);
        } catch (err) {
            console.error('Failed to fetch event:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleScan = useCallback(async (qrData: string) => {
        if (!user) return;

        // Pause scanning temporarily
        setIsScanning(false);

        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/tickets/scan`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    qrData,
                    scannerId: user._id,
                    eventId
                })
            });

            const result = await response.json();

            if (response.ok && result.success) {
                setScanResult({
                    success: true,
                    message: result.message,
                    ticket: result.ticket
                });

                // Add to history
                setScanHistory(prev => [{
                    ticketId: result.ticket.ticketId,
                    userName: result.ticket.user.name,
                    quantity: result.ticket.quantity,
                    time: new Date().toLocaleTimeString(),
                    success: true
                }, ...prev].slice(0, 20)); // Keep last 20

                // Refresh stats
                fetchEventAndStats();
            } else {
                setScanResult({
                    success: false,
                    message: result.error || 'Scan failed',
                    error: result.error
                });

                // Add failed scan to history
                setScanHistory(prev => [{
                    ticketId: 'Unknown',
                    userName: 'Failed scan',
                    quantity: 0,
                    time: new Date().toLocaleTimeString(),
                    success: false
                }, ...prev].slice(0, 20));
            }
        } catch (err: any) {
            setScanResult({
                success: false,
                message: err.message || 'Network error',
                error: err.message
            });
        }

        // Auto-resume scanning after 3 seconds
        setTimeout(() => {
            setScanResult(null);
            setIsScanning(true);
        }, 3000);
    }, [user, eventId]);

    const handleScanError = useCallback((error: string) => {
        console.error('Scanner error:', error);
    }, []);

    if (loading) {
        return (
            <DashboardLayout>
                <div className="flex items-center justify-center min-h-[400px]">
                    <div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="max-w-2xl mx-auto px-4 py-6">
                {/* Header */}
                <div className="flex items-center gap-4 mb-6">
                    <Link href="/dashboard/events">
                        <Button variant="secondary" className="!p-2">
                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M15 18l-6-6 6-6" />
                            </svg>
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold text-white">{event?.name}</h1>
                        <p className="text-sm text-gray-300">Ticket Scanner</p>
                    </div>
                </div>

                {/* Stats Bar */}
                <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-4 mb-6">
                    <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                            <p className="text-2xl font-bold text-white">{stats.scannedAttendees}</p>
                            <p className="text-xs text-gray-300">Checked In</p>
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-violet-400">{stats.totalAttendees - stats.scannedAttendees}</p>
                            <p className="text-xs text-gray-300">Remaining</p>
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-300">{stats.totalAttendees}</p>
                            <p className="text-xs text-gray-300">Total</p>
                        </div>
                    </div>
                    {/* Progress bar */}
                    <div className="mt-3 h-2 bg-white/10 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-violet-500 to-pink-500 transition-all duration-500"
                            style={{ width: `${stats.totalAttendees > 0 ? (stats.scannedAttendees / stats.totalAttendees) * 100 : 0}%` }}
                        />
                    </div>
                </div>

                {/* Scanner */}
                <div className="relative mb-6">
                    <Scanner
                        onScan={handleScan}
                        onError={handleScanError}
                        isActive={isScanning}
                    />

                    {/* Scan Result Overlay */}
                    {scanResult && (
                        <div className={`absolute inset-0 flex items-center justify-center rounded-2xl ${scanResult.success ? 'bg-green-500/90' : 'bg-red-500/90'
                            }`}>
                            <div className="text-center p-6">
                                {scanResult.success ? (
                                    <>
                                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/20 flex items-center justify-center">
                                            <svg className="w-10 h-10 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                                <path d="M20 6L9 17l-5-5" />
                                            </svg>
                                        </div>
                                        <h3 className="text-xl font-bold text-white mb-1">{scanResult.message}</h3>
                                        {scanResult.ticket && (
                                            <>
                                                <p className="text-white/80 font-medium">{scanResult.ticket.user.name}</p>
                                                <p className="text-white/60 text-sm">
                                                    {scanResult.ticket.quantity} {scanResult.ticket.quantity > 1 ? 'people' : 'person'} • {scanResult.ticket.ticketType}
                                                </p>
                                            </>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/20 flex items-center justify-center">
                                            <svg className="w-10 h-10 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                                <path d="M18 6L6 18M6 6l12 12" />
                                            </svg>
                                        </div>
                                        <h3 className="text-lg font-bold text-white">{scanResult.message}</h3>
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Instructions */}
                <div className="text-center mb-6">
                    <p className="text-gray-300 text-sm">
                        Point camera at ticket QR code to scan
                    </p>
                </div>

                {/* Recent Scans */}
                {scanHistory.length > 0 && (
                    <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-4">
                        <h3 className="font-semibold text-white mb-3">Recent Scans</h3>
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                            {scanHistory.map((scan, i) => (
                                <div key={i} className={`flex items-center justify-between p-2 rounded-lg ${scan.success ? 'bg-green-500/10' : 'bg-red-500/10'
                                    }`}>
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${scan.success ? 'bg-green-500' : 'bg-red-500'}`} />
                                        <span className="text-white text-sm">{scan.userName}</span>
                                        {scan.quantity > 1 && (
                                            <span className="text-gray-300 text-xs">({scan.quantity})</span>
                                        )}
                                    </div>
                                    <span className="text-gray-300 text-xs">{scan.time}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
