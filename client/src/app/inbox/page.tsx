'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { messagesApi, notificationsApi, Conversation, Message } from '@/lib/api';
import Navbar from '@/components/Navbar';
import PartyBackground from '@/components/PartyBackground';
import PushNotificationToggle from '@/components/PushNotificationToggle';
import { Button, Input } from '@/components/ui';
import { motion } from 'framer-motion';
import { FadeIn, SlideUp } from '@/components/animations';

type NotificationCategory = 'all' | 'events' | 'bookings' | 'payments' | 'system';

interface NotificationData {
    _id: string;
    category: NotificationCategory;
    type: string;
    title: string;
    message: string;
    createdAt: string;
    read: boolean;
    data?: any;
}

export default function InboxPage() {
    const router = useRouter();
    const { user, isLoading: authLoading, isAuthenticated } = useAuth();
    
    const [activeTab, setActiveTab] = useState<'alerts' | 'messages'>('alerts');
    
    // Notifications State
    const [notifications, setNotifications] = useState<NotificationData[]>([]);
    const [loadingNotifications, setLoadingNotifications] = useState(true);
    
    // Messages State
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loadingMessages, setLoadingMessages] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.replace('/signin?redirect=/inbox');
        }
    }, [authLoading, isAuthenticated, router]);

    // Load Notifications
    const getCategoryFromType = (type: string): NotificationCategory => {
        if (!type) return 'system';
        if (type.includes('booking')) return 'bookings';
        if (type.includes('payment') || type.includes('refund') || type.includes('payout')) return 'payments';
        if (type.includes('event') || type.includes('ticket')) return 'events';
        if (type === 'brand_new_post') return 'system';
        return 'system';
    };

    useEffect(() => {
        const fetchNotifications = async () => {
            if (!user?._id) return;
            try {
                setLoadingNotifications(true);
                const response = await notificationsApi.getUserNotifications(user._id);
                const rawData = response as any[];
                const mappedData: NotificationData[] = rawData.map(n => ({
                    _id: n._id,
                    type: n.type,
                    category: getCategoryFromType(n.type),
                    title: n.title,
                    message: n.message,
                    createdAt: n.createdAt,
                    read: n.isRead === true,
                    data: n.data
                }));
                setNotifications(mappedData);
            } catch (err) {
                console.error('Failed to load notifications:', err);
            } finally {
                setLoadingNotifications(false);
            }
        };

        if (isAuthenticated && user?._id && activeTab === 'alerts') {
            fetchNotifications();
        }
    }, [isAuthenticated, user?._id, activeTab]);

    // CHAT DISABLED - conversation/message loading and sending are commented out.
    // Restore this block together with the Messages tab markup further down.
    //
    // // Load Conversations
    // useEffect(() => {
    //     const loadConversations = async () => {
    //         try {
    //             setLoadingMessages(true);
    //             const response = await messagesApi.getConversations();
    //             setConversations(response.conversations);
    //         } catch (err) {
    //             console.error('Failed to load conversations:', err);
    //         } finally {
    //             setLoadingMessages(false);
    //         }
    //     };
    //
    //     if (isAuthenticated && user && activeTab === 'messages' && !selectedConversation) {
    //         loadConversations();
    //     }
    // }, [isAuthenticated, user, activeTab, selectedConversation]);
    //
    // // Load Chat Messages
    // useEffect(() => {
    //     const loadChatMessages = async (conversationId: string) => {
    //         try {
    //             const response = await messagesApi.getMessages(conversationId);
    //             setMessages(response.messages);
    //             setConversations(prev => prev.map(c =>
    //                 c._id === conversationId ? { ...c, unreadCount: 0 } : c
    //             ));
    //         } catch (err) {
    //             console.error('Failed to load messages:', err);
    //         }
    //     };
    //
    //     if (selectedConversation) {
    //         loadChatMessages(selectedConversation._id);
    //     }
    // }, [selectedConversation?._id]);
    //
    // useEffect(() => {
    //     messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    // }, [messages]);
    //
    // const handleSendMessage = async (e: React.FormEvent) => {
    //     e.preventDefault();
    //     if (!newMessage.trim() || !selectedConversation || isSending) return;
    //
    //     setIsSending(true);
    //     try {
    //         const response = await messagesApi.sendMessage({
    //             conversationId: selectedConversation._id,
    //             content: newMessage.trim(),
    //         });
    //
    //         setMessages(prev => [...prev, response.message]);
    //         setNewMessage('');
    //
    //         setConversations(prev => prev.map(c =>
    //             c._id === selectedConversation._id
    //                 ? {
    //                     ...c,
    //                     lastMessage: {
    //                         content: newMessage.trim(),
    //                         sender: user?._id || '',
    //                         timestamp: new Date().toISOString()
    //                     }
    //                 }
    //                 : c
    //         ));
    //     } catch (err) {
    //         console.error('Failed to send message:', err);
    //     } finally {
    //         setIsSending(false);
    //     }
    // };

    const markAsRead = async (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        try {
            await notificationsApi.markAsRead(id);
            setNotifications((prev) =>
                prev.map((n) => (n._id === id ? { ...n, read: true } : n))
            );
        } catch (err) {
            console.error('Failed to mark as read:', err);
        }
    };

    // Matches the "Mark all as read" action on the desktop notifications page.
    const markAllAsRead = async () => {
        if (!user?._id) return;
        try {
            await notificationsApi.markAllAsRead(user._id);
            setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        } catch (err) {
            console.error('Failed to mark all as read:', err);
        }
    };

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const minutes = Math.floor(diff / (1000 * 60));
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (minutes < 1) return 'Just now';
        if (hours < 1) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        return date.toLocaleDateString();
    };

    const formatMessageTime = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (days === 0) return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        if (days === 1) return 'Yesterday';
        if (days < 7) return date.toLocaleDateString('en-US', { weekday: 'short' });
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const getIcon = (notification: NotificationData) => {
        const extra = notification.data?.extra;
        const profileImage = extra?.actor?.avatar || extra?.user?.avatar || extra?.brand?.profilePhoto || 
                            extra?.brand?.logo || notification.data?.avatar || notification.data?.profilePhoto;

        if (profileImage) {
            return (
                <div className="w-10 h-10 rounded-xl overflow-hidden bg-zinc-800 flex-shrink-0 border border-white/10">
                    <img src={profileImage} alt="Notification Source" className="w-full h-full object-cover" />
                </div>
            );
        }

        if (notification.type === 'brand_new_post') {
            return (
                <div className="w-10 h-10 rounded-xl bg-pink-500/20 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                </div>
            );
        }

        if (notification.type === 'new_follower') {
            return (
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                </div>
            );
        }

        switch (notification.category) {
            case 'events':
                return (
                    <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                    </div>
                );
            case 'bookings':
                return (
                    <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16" />
                        </svg>
                    </div>
                );
            case 'payments':
                return (
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                );
            default:
                return (
                    <div className="w-10 h-10 rounded-xl bg-gray-500/20 flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    </div>
                );
        }
    };

    const getOtherParticipant = (conversation: Conversation) => {
        return conversation.participants.find(p => p._id !== user?._id);
    };

    const getDisplayInfo = (conversation: Conversation) => {
        const other = getOtherParticipant(conversation);
        const isBrandOwner = conversation.brand?.user === user?._id;

        if (conversation.brand && !isBrandOwner) {
            return {
                name: conversation.brand.name,
                image: conversation.brand.profilePhoto,
                type: conversation.brand.type,
                isBrand: true
            };
        }

        return {
            name: other?.name || 'Unknown User',
            image: other?.avatar,
            type: null,
            isBrand: false
        };
    };

    if (authLoading) {
        return <div className="min-h-screen bg-black" />;
    }

    if (!user) return null;

    const unreadAlerts = notifications.filter(n => !n.read).length;
    const unreadMessages = conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0);

    return (
        <div className="min-h-screen bg-black">
            <PartyBackground />
            <Navbar />
            <main className="pt-20 pb-24 px-4 relative z-20 md:hidden">
                {/* CHAT DISABLED - with Messages gone there is only one tab
                    left, so a tab bar is meaningless. This mirrors the desktop
                    /dashboard/notifications header instead.
                    To bring chat back, restore the two-button tab bar kept at
                    the bottom of this comment and drop this header. */}
                {!selectedConversation && (
                    <div className="flex items-start justify-between mb-6">
                        <div>
                            <h1 className="text-2xl font-bold text-white mb-1">Notifications</h1>
                            <p className="text-sm text-gray-300">
                                {unreadAlerts > 0
                                    ? `You have ${unreadAlerts} unread notification${unreadAlerts === 1 ? '' : 's'}`
                                    : "You're all caught up!"}
                            </p>
                        </div>
                        {unreadAlerts > 0 && (
                            <button
                                onClick={markAllAsRead}
                                className="text-xs text-violet-400 hover:text-violet-300 transition-colors shrink-0 mt-1"
                            >
                                Mark all as read
                            </button>
                        )}
                    </div>
                )}

                {/* Per-device push opt-in. This is the mobile surface, so it is
                    the most likely place a user actually turns push on. */}
                {!selectedConversation && <PushNotificationToggle className="mb-6" />}
                {/* CHAT DISABLED - original tab bar
                {!selectedConversation && (
                    <div className="flex gap-2 mb-6">
                        <button
                            onClick={() => setActiveTab('alerts')}
                            className={`flex-1 py-2.5 rounded-full text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
                                activeTab === 'alerts'
                                ? 'bg-violet-600 text-white'
                                : 'bg-white/5 text-gray-400 hover:text-white'
                            }`}
                        >
                            Alerts
                            {unreadAlerts > 0 && (
                                <span className="w-5 h-5 rounded-full bg-white text-violet-600 flex items-center justify-center text-xs">
                                    {unreadAlerts}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={() => setActiveTab('messages')}
                            className={`flex-1 py-2.5 rounded-full text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
                                activeTab === 'messages'
                                ? 'bg-violet-600 text-white'
                                : 'bg-white/5 text-gray-400 hover:text-white'
                            }`}
                        >
                            Messages
                            {unreadMessages > 0 && (
                                <span className="w-5 h-5 rounded-full bg-white text-violet-600 flex items-center justify-center text-xs">
                                    {unreadMessages}
                                </span>
                            )}
                        </button>
                    </div>
                )}
                */}

                {/* Alerts Content */}
                {activeTab === 'alerts' && !selectedConversation && (
                    <div className="space-y-3">
                        {loadingNotifications ? (
                            <div className="flex justify-center p-8">
                                <div className="animate-spin w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full" />
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="text-center py-12">
                                <svg className="w-12 h-12 text-gray-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                </svg>
                                <p className="text-gray-300">No alerts yet</p>
                            </div>
                        ) : (
                            notifications.map((notification) => (
                                <div
                                    key={notification._id}
                                    onClick={(e) => !notification.read && markAsRead(notification._id, e)}
                                    className={`bg-white/[0.02] backdrop-blur-sm border rounded-2xl p-4 flex items-start gap-3 transition-colors ${
                                        notification.read ? 'border-white/[0.05]' : 'border-violet-500/30 bg-violet-500/[0.03]'
                                    }`}
                                >
                                    {getIcon(notification)}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2 mb-1">
                                            <h3 className={`text-sm font-medium leading-snug ${notification.read ? 'text-white' : 'text-violet-300'}`}>
                                                {notification.title}
                                            </h3>
                                            {!notification.read && <span className="w-2 h-2 rounded-full bg-violet-500 flex-shrink-0 mt-1" />}
                                        </div>
                                        <p className="text-sm text-gray-300 mb-1 leading-snug">{notification.message}</p>
                                        <p className="text-xs text-gray-300">{formatTime(notification.createdAt)}</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* CHAT DISABLED - Messages list */}
                {/*
                {activeTab === 'messages' && !selectedConversation && (
                    <div className="space-y-3">
                        {loadingMessages ? (
                            <div className="flex justify-center p-8">
                                <div className="animate-spin w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full" />
                            </div>
                        ) : conversations.length === 0 ? (
                            <div className="text-center py-12">
                                <svg className="w-12 h-12 text-gray-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                </svg>
                                <p className="text-gray-300">No messages yet</p>
                            </div>
                        ) : (
                            conversations.map(conversation => {
                                const displayInfo = getDisplayInfo(conversation);
                                return (
                                    <button
                                        key={conversation._id}
                                        onClick={() => setSelectedConversation(conversation)}
                                        className="w-full bg-white/[0.02] backdrop-blur-sm border border-white/[0.05] rounded-2xl p-4 flex items-center gap-3 active:bg-white/5 transition-colors"
                                    >
                                        <div className="relative">
                                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center overflow-hidden">
                                                {displayInfo.image ? (
                                                    <img src={displayInfo.image} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <span className="text-white font-medium">{displayInfo.name[0]?.toUpperCase()}</span>
                                                )}
                                            </div>
                                            {conversation.unreadCount > 0 && (
                                                <span className="absolute -top-1 -right-1 w-5 h-5 bg-violet-500 rounded-full text-xs flex items-center justify-center text-white font-medium">
                                                    {conversation.unreadCount}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex-1 text-left min-w-0">
                                            <div className="flex items-center justify-between gap-2">
                                                <h3 className="font-semibold text-white truncate">{displayInfo.name}</h3>
                                                <span className="text-xs text-gray-300 flex-shrink-0">
                                                    {formatMessageTime(conversation.lastMessage?.timestamp || conversation.updatedAt)}
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-300 truncate">{conversation.lastMessage?.content || 'Say hi!'}</p>
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </div>
                )}
                */}

                {/* CHAT DISABLED - Mobile chat view overlay */}
                {/*
                {selectedConversation && (
                    <div className="fixed inset-0 z-50 bg-black flex flex-col">
                        <div className="pt-safe pr-4 pl-2 pb-3 border-b border-white/10 flex items-center gap-2 bg-black/90 backdrop-blur-xl shrink-0 mt-2">
                            <button
                                onClick={() => setSelectedConversation(null)}
                                className="p-2 text-gray-400 hover:text-white"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                            </button>
                            <div className="flex items-center gap-3">
                                {(()=>{
                                    const displayInfo = getDisplayInfo(selectedConversation);
                                    return (
                                        <>
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center overflow-hidden">
                                                {displayInfo.image ? (
                                                    <img src={displayInfo.image} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <span className="text-white font-medium text-xs">{displayInfo.name[0]?.toUpperCase()}</span>
                                                )}
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-sm text-white">{displayInfo.name}</h3>
                                                {displayInfo.isBrand && <p className="text-xs text-violet-400 capitalize">{displayInfo.type}</p>}
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {messages.map(message => (
                                <div key={message._id} className={`flex ${message.sender._id === user._id ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[80%] ${message.sender._id === user._id ? 'bg-violet-600 text-white' : 'bg-white/10 text-white'} rounded-2xl px-4 py-2`}>
                                        <p className="break-words text-sm">{message.content}</p>
                                        <p className={`text-[10px] mt-1 text-right ${message.sender._id === user._id ? 'text-violet-200' : 'text-gray-300'}`}>
                                            {formatMessageTime(message.createdAt)}
                                        </p>
                                    </div>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>

                        <form onSubmit={handleSendMessage} className="p-3 border-t border-white/10 bg-black pb-safe shrink-0">
                            <div className="flex gap-2">
                                <Input
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    placeholder="Message..."
                                    className="flex-1 bg-white/5 border-none h-10 rounded-full px-4 text-sm"
                                    disabled={isSending}
                                />
                                <Button
                                    type="submit"
                                    variant="primary"
                                    className="rounded-full w-10 h-10 p-0 flex items-center justify-center shrink-0 bg-violet-600 hover:bg-violet-500"
                                    disabled={!newMessage.trim() || isSending}
                                >
                                    <svg className="w-4 h-4 translate-x-px" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                    </svg>
                                </Button>
                            </div>
                        </form>
                    </div>
                )}
                */}
            </main>
        </div>
    );
}
