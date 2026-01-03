'use client';

import { FadeIn, SlideUp, StaggerContainer, StaggerItem } from './animations';

const events = [
    {
        id: 1,
        title: 'Neon Nights: EDM Festival',
        date: 'Dec 28',
        time: '9:00 PM',
        venue: 'Skyline Rooftop, LA',
        image: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&h=400&fit=crop',
        organizer: 'Electric Dreams',
        verified: true,
        price: '$45',
        attendees: 342,
    },
    {
        id: 2,
        title: 'New Year\'s Eve Gala',
        date: 'Dec 31',
        time: '8:00 PM',
        venue: 'The Grand Ballroom, NY',
        image: 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=600&h=400&fit=crop',
        organizer: 'Luxe Events',
        verified: true,
        price: '$150',
        attendees: 489,
    },
    {
        id: 3,
        title: 'Tech Startup Mixer',
        date: 'Jan 5',
        time: '6:00 PM',
        venue: 'Industrial Loft, Brooklyn',
        image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=600&h=400&fit=crop',
        organizer: 'TechConnect',
        verified: false,
        price: 'Free',
        attendees: 156,
    },
    {
        id: 4,
        title: 'Beach Sunset Party',
        date: 'Jan 12',
        time: '4:00 PM',
        venue: 'Ocean View Estate, Miami',
        image: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=600&h=400&fit=crop',
        organizer: 'Sunset Vibes',
        verified: true,
        price: '$35',
        attendees: 278,
    },
];

export default function UpcomingEvents() {
    return (
        <FadeIn>
            <section className="py-20 px-4 sm:px-6 lg:px-8">
                <div className="max-w-6xl mx-auto">
                    {/* Section Header */}
                    <SlideUp>
                        <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-12">
                            <div>
                                <h2 className="text-3xl md:text-4xl font-semibold mb-3 text-white">
                                    Upcoming <span className="accent-text">Events</span>
                                </h2>
                                <p className="text-gray-500 text-sm">
                                    Don't miss out on the hottest events near you.
                                </p>
                            </div>
                            <div className="flex gap-2 mt-4 md:mt-0">
                                {['All', 'This Week', 'This Month'].map((filter, idx) => (
                                    <button
                                        key={filter}
                                        className={`px-4 py-1.5 rounded-full text-xs transition-colors ${idx === 0
                                            ? 'bg-white text-black'
                                            : 'text-gray-500 hover:text-white hover:bg-white/5'
                                            }`}
                                    >
                                        {filter}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </SlideUp>

                    {/* Events Grid */}
                    <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {events.map((event) => (
                            <StaggerItem key={event.id}>
                                <div className="glass-card overflow-hidden group cursor-pointer flex h-full">
                                    {/* Image */}
                                    <div className="relative w-32 sm:w-40 flex-shrink-0 overflow-hidden">
                                        <img
                                            src={event.image}
                                            alt={event.title}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                        />
                                    </div>

                                    {/* Content */}
                                    <div className="p-4 flex-1 flex flex-col justify-between">
                                        <div>
                                            {/* Date & Time */}
                                            <div className="flex items-center gap-3 text-xs mb-2">
                                                <span className="text-violet-400">{event.date}</span>
                                                <span className="text-gray-600">{event.time}</span>
                                            </div>

                                            {/* Title */}
                                            <h3 className="text-base font-medium text-white mb-1 group-hover:text-violet-400 transition-colors line-clamp-1">
                                                {event.title}
                                            </h3>

                                            {/* Venue */}
                                            <p className="text-gray-500 text-xs mb-2 flex items-center gap-1">
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                </svg>
                                                {event.venue}
                                            </p>

                                            {/* Organizer */}
                                            <div className="flex items-center gap-2">
                                                <span className="text-gray-500 text-xs">{event.organizer}</span>
                                                {event.verified && (
                                                    <svg className="w-3 h-3 text-violet-400" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                    </svg>
                                                )}
                                            </div>
                                        </div>

                                        {/* Footer */}
                                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
                                            <span className="text-gray-600 text-xs">{event.attendees}+ going</span>
                                            <span className={`font-medium text-sm ${event.price === 'Free' ? 'text-emerald-400' : 'text-white'}`}>
                                                {event.price}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </StaggerItem>
                        ))}
                    </StaggerContainer>

                    {/* View More */}
                    <SlideUp delay={0.3}>
                        <div className="text-center mt-10">
                            <button className="btn-primary px-6 py-2.5 rounded-full text-sm inline-flex items-center gap-2">
                                Browse All Events
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                </svg>
                            </button>
                        </div>
                    </SlideUp>
                </div>
            </section>
        </FadeIn>
    );
}
