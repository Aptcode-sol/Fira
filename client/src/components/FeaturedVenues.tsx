'use client';

import { FadeIn, SlideUp, StaggerContainer, StaggerItem } from './animations';

const venues = [
    {
        id: 1,
        name: 'The Grand Ballroom',
        location: 'Downtown Manhattan, NY',
        image: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=600&h=400&fit=crop',
        rating: 4.9,
        capacity: '500 guests',
        price: '$2,500',
        verified: true,
    },
    {
        id: 2,
        name: 'Skyline Rooftop',
        location: 'Beverly Hills, LA',
        image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600&h=400&fit=crop',
        rating: 4.8,
        capacity: '200 guests',
        price: '$1,800',
        verified: true,
    },
    {
        id: 3,
        name: 'Ocean View Estate',
        location: 'Miami Beach, FL',
        image: 'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=600&h=400&fit=crop',
        rating: 4.9,
        capacity: '350 guests',
        price: '$3,200',
        verified: true,
    },
    {
        id: 4,
        name: 'Industrial Loft',
        location: 'Brooklyn, NY',
        image: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&h=400&fit=crop',
        rating: 4.7,
        capacity: '150 guests',
        price: '$1,200',
        verified: false,
    },
];

export default function FeaturedVenues() {
    return (
        <FadeIn>
            <section className="py-20 px-4 sm:px-6 lg:px-8">
                <div className="max-w-6xl mx-auto">
                    {/* Section Header */}
                    <SlideUp>
                        <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-12">
                            <div>
                                <h2 className="text-3xl md:text-4xl font-semibold mb-3 text-white">
                                    Featured <span className="accent-text">Venues</span>
                                </h2>
                                <p className="text-gray-500 text-sm">
                                    Handpicked venues perfect for your next event.
                                </p>
                            </div>
                            <button className="mt-4 md:mt-0 text-gray-400 hover:text-white flex items-center gap-2 text-sm transition-colors">
                                View All
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                </svg>
                            </button>
                        </div>
                    </SlideUp>

                    {/* Venues Grid */}
                    <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                        {venues.map((venue) => (
                            <StaggerItem key={venue.id}>
                                <div className="glass-card overflow-hidden group cursor-pointer h-full">
                                    {/* Image */}
                                    <div className="relative h-44 overflow-hidden">
                                        <img
                                            src={venue.image}
                                            alt={venue.name}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>

                                        {/* Rating */}
                                        <div className="absolute top-3 right-3 flex items-center gap-1 text-white text-xs">
                                            <svg className="w-3 h-3 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                            </svg>
                                            {venue.rating}
                                        </div>

                                        {/* Verified badge */}
                                        {venue.verified && (
                                            <div className="absolute top-3 left-3">
                                                <svg className="w-4 h-4 text-violet-400" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                </svg>
                                            </div>
                                        )}
                                    </div>

                                    {/* Content */}
                                    <div className="p-4">
                                        <h3 className="text-base font-medium text-white mb-1 group-hover:text-violet-400 transition-colors">
                                            {venue.name}
                                        </h3>
                                        <p className="text-gray-500 text-xs mb-3 flex items-center gap-1">
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                            </svg>
                                            {venue.location}
                                        </p>

                                        {/* Footer */}
                                        <div className="flex items-center justify-between pt-3 border-t border-white/5">
                                            <span className="text-gray-500 text-xs">{venue.capacity}</span>
                                            <span className="text-white font-medium text-sm">{venue.price}<span className="text-gray-600 font-normal">/day</span></span>
                                        </div>
                                    </div>
                                </div>
                            </StaggerItem>
                        ))}
                    </StaggerContainer>
                </div>
            </section>
        </FadeIn>
    );
}

