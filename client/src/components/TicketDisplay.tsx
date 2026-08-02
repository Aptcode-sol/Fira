'use client';

import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui';
import { toPng } from 'html-to-image';

interface TicketDisplayProps {
    ticket: any;
    event: any;
    onClose: () => void;
}

export default function TicketDisplay({ ticket, event, onClose }: TicketDisplayProps) {
    const ticketRef = useRef<HTMLDivElement>(null);
    const [downloading, setDownloading] = useState(false);

    if (!ticket || !event) return null;

    const dateObj = event.startDateTime ? new Date(event.startDateTime) : (event.date ? new Date(event.date) : null);
    const formattedDate = dateObj ? dateObj.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
    }) : 'TBA';
    
    const formattedTime = event.startDateTime 
        ? new Date(event.startDateTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) 
        : (event.startTime || 'TBA');

    const handleDownload = async () => {
        if (!ticketRef.current) return;

        setDownloading(true);
        try {
            const dataUrl = await toPng(ticketRef.current, {
                quality: 0.95,
                pixelRatio: 2,
                cacheBust: true,
            });

            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = `ticket-${ticket.ticketId}.png`;
            link.click();
        } catch (err) {
            console.error('Download error:', err);
            alert('Failed to save image.');
        } finally {
            setDownloading(false);
        }
    };

    return (
        <div className="flex flex-col items-center w-full">
            <div
                ref={ticketRef}
                style={{ backgroundColor: '#0f0f0f', padding: '8px 16px', borderRadius: '12px' }}
            >
                <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', overflow: 'visible', width: '260px', boxShadow: '0 8px 20px rgba(0,0,0,0.3)', position: 'relative' }}>
                    {/* Header - Event Image */}
                    <div style={{ position: 'relative', height: '130px', width: '100%', backgroundColor: '#1f2937', borderRadius: '10px 10px 0 0', overflow: 'hidden' }}>
                        {event.images && event.images[0] ? (
                            <img src={event.images[0]} alt={event.name} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.9 }} />
                        ) : (
                            <div style={{ width: '100%', height: '100%', background: 'linear-gradient(to bottom right, #7c3aed, #4338ca)' }} />
                        )}
                        <div style={{ position: 'absolute', top: '8px', left: '0', width: '100%', display: 'flex', justifyContent: 'center' }}>
                            <img src="/logo white.png" alt="FIRA" style={{ height: '20px', objectFit: 'contain' }} />
                        </div>
                        <div style={{ position: 'absolute', bottom: '10px', left: '12px', right: '12px' }}>
                            <h2 style={{ color: '#fff', fontSize: '17px', fontWeight: 'bold', textShadow: '0 2px 4px rgba(0,0,0,0.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{event.name}</h2>
                        </div>
                    </div>

                    {/* Ticket cutout - Left (positioned in true middle) */}
                    <div style={{ position: 'absolute', left: '-8px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', backgroundColor: '#0f0f0f', borderRadius: '50%' }} />

                    {/* Ticket cutout - Right */}
                    <div style={{ position: 'absolute', right: '-8px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', backgroundColor: '#0f0f0f', borderRadius: '50%' }} />

                    {/* Body */}
                    <div style={{ padding: '12px', backgroundColor: '#ffffff' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 10px', marginBottom: '10px', fontSize: '11px' }}>
                            <div>
                                <p style={{ color: '#9ca3af', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>Date</p>
                                <p style={{ color: '#111827', fontWeight: '600' }}>{formattedDate}</p>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <p style={{ color: '#9ca3af', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>Time</p>
                                <p style={{ color: '#111827', fontWeight: '600' }}>{formattedTime}</p>
                            </div>
                            <div style={{ gridColumn: 'span 2' }}>
                                <p style={{ color: '#9ca3af', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>Venue</p>
                                <p style={{ color: '#111827', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{event.venue?.name || 'TBA'}</p>
                            </div>
                        </div>

                        {/* Dashed line in the middle */}
                        <div style={{ margin: '10px 0', borderTop: '2px dashed #e5e7eb' }} />

                        <div style={{ textAlign: 'center' }}>
                            <div style={{ backgroundColor: '#fff', padding: '4px', borderRadius: '6px', display: 'inline-block', border: '1px solid #f3f4f6' }}>
                                {ticket.qrCode && <img src={ticket.qrCode} alt="QR" style={{ width: '100px', height: '100px', objectFit: 'contain' }} />}
                            </div>

                            <div style={{ marginTop: '8px' }}>
                                <p style={{ color: '#9ca3af', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>Ticket ID</p>
                                <p style={{ fontFamily: 'monospace', fontSize: '11px', fontWeight: 'bold', color: '#111827' }}>{ticket.ticketId}</p>
                            </div>

                            <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'center' }}>
                                <img src="/logo black.png" alt="FIRA" style={{ height: '14px', objectFit: 'contain', opacity: 0.5 }} />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f9fafb', borderRadius: '4px', padding: '8px', marginTop: '8px', fontSize: '10px' }}>
                                <span style={{ color: '#6b7280', textTransform: 'capitalize' }}>{ticket.ticketType}</span>
                                <span style={{ fontWeight: 'bold', color: '#111827' }}>{ticket.quantity > 1 ? `${ticket.quantity} Members` : '1 Person'}</span>
                            </div>
                        </div>
                    </div>

                    <div style={{ height: '4px', background: 'linear-gradient(to right, #8b5cf6, #a855f7, #ec4899)', borderRadius: '0 0 10px 10px' }} />
                </div>
            </div>

            <div className="mt-4 flex gap-2 w-full max-w-[260px]">
                <Button variant="secondary" className="flex-1 text-xs h-9" onClick={onClose}>Close</Button>
                <Button className="flex-1 text-xs h-9" onClick={handleDownload} disabled={downloading}>
                    {downloading ? 'Saving...' : 'Save Image'}
                </Button>
            </div>
        </div>
    );
}
