import Link from 'next/link';
import { Event, User, Venue } from '@/lib/types';
import { motion } from 'framer-motion';
import { formatEventDateTime } from '@/lib/dateUtils';

interface EventCardProps {
    event: Event;
    index?: number;
}

export default function EventCard({ event, index = 0 }: EventCardProps) {
    const formatPrice = (price: number) => {
        if (price === 0) return 'Free';
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
        }).format(price);
    };

    const organizer = event.organizer as User;
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
                className="group relative bg-black/70 backdrop-blur-sm border border-white/5 rounded-2xl overflow-hidden transition-all duration-300 hover:border-white/20 hover:-translate-y-1 hover:shadow-xl hover:shadow-violet-500/10 h-full"
            >

                {/* Image */}
                <div className="relative h-44 overflow-hidden">
                    {event.images && event.images.length > 0 ? (
                        <img
                            src={event.images[0]}
                            alt={event.name}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        />
                    ) : (
                        <div className="w-full h-full bg-gradient-to-br from-violet-500/20 to-pink-500/20 flex items-center justify-center">
                            <svg className="w-12 h-12 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                        </div>
                    )}

                    {/* Date/Time Badge */}
                    <div className="absolute top-3 left-3 px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-sm border border-white/10">
                        <div className="text-xs text-gray-400">{formatEventDateTime(event.startDateTime)}</div>
                    </div>

                    {/* Event Type Badge */}
                    {event.eventType === 'private' && (
                        <div className="absolute top-3 right-3 px-2 py-1 rounded-full bg-violet-500/20 border border-violet-500/30 text-violet-300 text-xs font-medium flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                            Private
                        </div>
                    )}

                    {/* Category Badge */}
                    <div className="absolute bottom-3 left-3 px-2 py-1 rounded-full bg-white/10 backdrop-blur-sm text-white text-xs capitalize">
                        {event.category}
                    </div>
                </div>

                {/* Content */}
                <div className="p-5">
                    <h3 className="text-lg font-semibold text-white group-hover:text-violet-300 transition-colors line-clamp-1 mb-2">
                        {event.name}
                    </h3>

                    {/* Venue */}
                    {venue && typeof venue === 'object' && (
                        <div className="flex items-center gap-1 text-gray-400 text-sm mb-3">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span className="line-clamp-1">{venue.name}</span>
                        </div>
                    )}

                    {/* Organizer */}
                    {organizer && typeof organizer === 'object' && (
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-6 h-6 rounded-full overflow-hidden bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-white text-xs font-medium">
                                {organizer.avatar ? (
                                    <img src={organizer.avatar} alt={organizer.name} className="w-full h-full object-cover" />
                                ) : (
                                    organizer.name?.charAt(0).toUpperCase()
                                )}
                            </div>
                            <span className="text-sm text-gray-400">{organizer.name}</span>
                            {organizer.isVerified && (
                                <svg className="w-4 h-4 text-violet-400" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                            )}
                        </div>
                    )}

                    {/* Footer */}
                    <div className="flex items-center justify-between">
                        <div>
                            <span className={`text-lg font-bold ${event.ticketPrice === 0 ? 'text-green-400' : 'text-white'}`}>
                                {formatPrice(event.ticketPrice)}
                            </span>
                            {event.ticketPrice > 0 && (
                                <span className="text-gray-500 text-sm ml-1">/ ticket</span>
                            )}
                        </div>

                        {/* Attendees */}
                        <div className="flex items-center gap-1 text-gray-500 text-sm">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span>{event.currentAttendees}/{event.maxAttendees}</span>
                        </div>
                    </div>
                </div>
            </motion.div>
        </Link>
    );
}
