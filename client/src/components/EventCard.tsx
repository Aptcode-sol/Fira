import Link from 'next/link';
import Image from 'next/image';
import { Event, Venue } from '@/lib/types';
import { motion } from 'framer-motion';
import { formatEventDateTime } from '@/lib/dateUtils';
import { organizerIdentity } from '@/lib/organizerIdentity';
import { formatInr } from '@/lib/formatInr';

interface EventCardProps {
    event: Event;
    index?: number;
}

export default function EventCard({ event, index = 0 }: EventCardProps) {
    const formatPrice = (price: number) => (price === 0 ? 'Free' : formatInr(price));
    const host = organizerIdentity(event);
    const venue = event.venue as Venue;

    return (
        <Link href={`/events/${event._id}`}>
            <motion.div
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.1 }}
                transition={{
                    duration: 0.4,
                    delay: index * 0.05,
                    ease: [0.25, 0.1, 0.25, 1]
                }}
                className="group relative bg-black/60 backdrop-blur-sm border border-white/[0.08] rounded-2xl overflow-hidden transition-all duration-300 hover:border-violet-500/30 hover:-translate-y-1 hover:shadow-2xl hover:shadow-violet-500/20 h-full flex flex-col"
            >
                {/* Poster Image - Full view, 3:4 aspect ratio */}
                <div className="relative aspect-[3/4] overflow-hidden flex-shrink-0">
                    {(event.coverPhoto || (event.images && event.images.length > 0)) ? (
                        <Image
                            src={event.coverPhoto || event.images[0]}
                            alt={event.name}
                            fill
                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                            className="object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                    ) : (
                        <div className="w-full h-full bg-gradient-to-br from-violet-600/30 to-pink-600/30 flex items-center justify-center">
                            <svg className="w-16 h-16 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                        </div>
                    )}

                    {/* Minimal badges - only date and private indicator */}
                    <div className="absolute top-2.5 left-2.5 right-2.5 flex items-start justify-between gap-2">
                        <div className="px-2 py-1 rounded-md bg-black/60 backdrop-blur-sm text-[11px] text-white font-medium">
                            {formatEventDateTime(event.startDateTime)}
                        </div>
                        {event.eventType === 'private' && (
                            <div className="px-1.5 py-1 rounded-md bg-violet-500/40 backdrop-blur-sm">
                                <svg className="w-3.5 h-3.5 text-violet-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                            </div>
                        )}
                    </div>
                </div>

                {/* Event Info - Below the image */}
                <div className="p-3.5 flex flex-col gap-2 flex-grow">
                    {/* Category */}
                    <span className="text-[10px] uppercase tracking-wider text-violet-400 font-medium">
                        {event.category}
                    </span>

                    {/* Title */}
                    <h3 className="text-base font-semibold text-white group-hover:text-violet-300 transition-colors line-clamp-2 leading-tight">
                        {event.name}
                    </h3>

                    {/* Venue */}
                    {venue && typeof venue === 'object' && (
                        <div className="flex items-center gap-1.5 text-gray-400 text-xs">
                            <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            </svg>
                            <span className="line-clamp-1">{venue.name}</span>
                        </div>
                    )}

                    {/* Spacer */}
                    <div className="flex-grow" />

                    {/* Footer: Organizer + Price */}
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/5">
                        {host ? (
                            <div className="flex items-center gap-1.5 min-w-0">
                                <div className="w-5 h-5 flex-shrink-0 rounded-full overflow-hidden bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-white text-[9px] font-medium">
                                    {host.photo ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={host.photo} alt={host.name} className="w-full h-full object-cover" />
                                    ) : (
                                        host.name?.charAt(0).toUpperCase()
                                    )}
                                </div>
                                <span className="text-[11px] text-gray-400 line-clamp-1">{host.name}</span>
                                {host.verified && (
                                    <svg className="w-3 h-3 text-violet-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                )}
                            </div>
                        ) : <div />}

                        {event.status !== 'completed' ? (
                            <span className={`text-sm font-bold ${event.ticketPrice === 0 ? 'text-green-400' : 'text-white'}`}>
                                {formatPrice(event.ticketPrice)}
                            </span>
                        ) : (
                            <span className="text-[11px] text-gray-500">Ended</span>
                        )}
                    </div>
                </div>
            </motion.div>
        </Link>
    );
}
