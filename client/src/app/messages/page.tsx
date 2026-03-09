'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { messagesApi, Conversation, Message } from '@/lib/api';
import Navbar from '@/components/Navbar';
import PartyBackground from '@/components/PartyBackground';
import { Button, Input } from '@/components/ui';

export default function MessagesPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, isLoading: authLoading } = useAuth();

    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const [error, setError] = useState('');

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const conversationIdFromUrl = searchParams.get('conversation');

    // Redirect if not logged in
    useEffect(() => {
        if (!authLoading && !user) {
            router.replace('/signin?redirect=/messages');
        }
    }, [user, authLoading, router]);

    // Load conversations
    useEffect(() => {
        if (user) {
            loadConversations();
        }
    }, [user]);

    // Load messages when conversation is selected
    useEffect(() => {
        if (selectedConversation) {
            loadMessages(selectedConversation._id);
        }
    }, [selectedConversation?._id]);

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Handle URL parameter for conversation
    useEffect(() => {
        if (conversationIdFromUrl && conversations.length > 0) {
            const conv = conversations.find(c => c._id === conversationIdFromUrl);
            if (conv) {
                setSelectedConversation(conv);
            }
        }
    }, [conversationIdFromUrl, conversations]);

    const loadConversations = async () => {
        try {
            setIsLoading(true);
            const response = await messagesApi.getConversations();
            setConversations(response.conversations);
        } catch (err) {
            console.error('Failed to load conversations:', err);
            setError('Failed to load conversations');
        } finally {
            setIsLoading(false);
        }
    };

    const loadMessages = async (conversationId: string) => {
        try {
            const response = await messagesApi.getMessages(conversationId);
            setMessages(response.messages);

            // Update conversation in list with zero unread
            setConversations(prev => prev.map(c =>
                c._id === conversationId ? { ...c, unreadCount: 0 } : c
            ));
        } catch (err) {
            console.error('Failed to load messages:', err);
        }
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !selectedConversation || isSending) return;

        setIsSending(true);
        try {
            const response = await messagesApi.sendMessage({
                conversationId: selectedConversation._id,
                content: newMessage.trim(),
            });

            setMessages(prev => [...prev, response.message]);
            setNewMessage('');

            // Update last message in conversation list
            setConversations(prev => prev.map(c =>
                c._id === selectedConversation._id
                    ? {
                        ...c,
                        lastMessage: {
                            content: newMessage.trim(),
                            sender: user?._id || '',
                            timestamp: new Date().toISOString()
                        }
                    }
                    : c
            ));
        } catch (err) {
            console.error('Failed to send message:', err);
        } finally {
            setIsSending(false);
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

    const selectedDisplayInfo = selectedConversation ? getDisplayInfo(selectedConversation) : null;

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (days === 0) {
            return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        } else if (days === 1) {
            return 'Yesterday';
        } else if (days < 7) {
            return date.toLocaleDateString('en-US', { weekday: 'short' });
        } else {
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
    };

    if (authLoading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-violet-500"></div>
            </div>
        );
    }

    if (!user) return null;

    return (
        <>
            <PartyBackground />
            <Navbar />
            <main className="min-h-screen pt-20 pb-24 md:pb-8 px-4 md:px-8 relative z-20">
                <div className="max-w-6xl mx-auto">
                    <h1 className="text-2xl font-bold text-white mb-6">Messages</h1>

                    {error && (
                        <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[calc(100vh-200px)]">
                        {/* Conversations List */}
                        <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.05] rounded-2xl overflow-hidden">
                            <div className="p-4 border-b border-white/10">
                                <h2 className="text-lg font-semibold text-white">Conversations</h2>
                            </div>
                            <div className="overflow-y-auto h-[calc(100%-60px)]">
                                {isLoading ? (
                                    <div className="flex items-center justify-center h-32">
                                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-violet-500"></div>
                                    </div>
                                ) : conversations.length === 0 ? (
                                    <div className="p-6 text-center text-gray-400">
                                        <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                        </svg>
                                        <p>No conversations yet</p>
                                        <p className="text-sm mt-2">Start a conversation by contacting a brand</p>
                                    </div>
                                ) : (
                                    conversations.map(conversation => {
                                        const displayInfo = getDisplayInfo(conversation);
                                        return (
                                            <button
                                                key={conversation._id}
                                                onClick={() => setSelectedConversation(conversation)}
                                                className={`w-full p-4 flex items-center gap-3 hover:bg-white/5 transition-colors border-b border-white/5 ${selectedConversation?._id === conversation._id ? 'bg-white/10' : ''
                                                    }`}
                                            >
                                                <div className="relative">
                                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center overflow-hidden">
                                                        {displayInfo.image ? (
                                                            <img src={displayInfo.image} alt="" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <span className="text-white font-medium">
                                                                {displayInfo.name[0].toUpperCase()}
                                                            </span>
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
                                                        <h3 className="font-bold text-lg truncate" style={{ color: '#ffffff', opacity: 1 }}>
                                                            {displayInfo.name}
                                                        </h3>
                                                        <span className="text-xs text-gray-500 flex-shrink-0">
                                                            {formatTime(conversation.lastMessage?.timestamp || conversation.updatedAt)}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm text-gray-400 truncate">
                                                        {conversation.lastMessage?.content || 'No messages yet'}
                                                    </p>
                                                </div>
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        {/* Chat View */}
                        <div className="md:col-span-2 bg-white/[0.02] backdrop-blur-xl border border-white/[0.05] rounded-2xl overflow-hidden flex flex-col">
                            {selectedConversation && selectedDisplayInfo ? (
                                <>
                                    {/* Chat Header */}
                                    <div className="p-4 border-b border-white/10 flex items-center gap-3">
                                        <button
                                            onClick={() => setSelectedConversation(null)}
                                            className="md:hidden text-gray-400 hover:text-white"
                                        >
                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                            </svg>
                                        </button>
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center overflow-hidden">
                                            {selectedDisplayInfo.image ? (
                                                <img src={selectedDisplayInfo.image} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="text-white font-medium">
                                                    {selectedDisplayInfo.name[0].toUpperCase()}
                                                </span>
                                            )}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-lg" style={{ color: '#ffffff', opacity: 1 }}>
                                                {selectedDisplayInfo.name}
                                            </h3>
                                            {selectedDisplayInfo.isBrand && selectedDisplayInfo.type && (
                                                <p className="text-sm capitalize font-medium" style={{ color: '#ffffff', opacity: 1 }}>{selectedDisplayInfo.type}</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Messages */}
                                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                        {messages.map(message => (
                                            <div
                                                key={message._id}
                                                className={`flex ${message.sender._id === user._id ? 'justify-end' : 'justify-start'}`}
                                            >
                                                <div className={`max-w-[70%] ${message.sender._id === user._id
                                                    ? 'bg-violet-600 text-white'
                                                    : 'bg-white/10 text-white'
                                                    } rounded-2xl px-4 py-2`}>
                                                    <p className="break-words">{message.content}</p>
                                                    <p className={`text-xs mt-1 ${message.sender._id === user._id ? 'text-violet-200' : 'text-gray-400'
                                                        }`}>
                                                        {formatTime(message.createdAt)}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                        <div ref={messagesEndRef} />
                                    </div>

                                    {/* Message Input */}
                                    <form onSubmit={handleSendMessage} className="p-4 border-t border-white/10">
                                        <div className="flex gap-2">
                                            <Input
                                                value={newMessage}
                                                onChange={(e) => setNewMessage(e.target.value)}
                                                placeholder="Type a message..."
                                                className="flex-1 bg-black/40"
                                                disabled={isSending}
                                            />
                                            <Button
                                                type="submit"
                                                variant="primary"
                                                disabled={!newMessage.trim() || isSending}
                                                isLoading={isSending}
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                                </svg>
                                            </Button>
                                        </div>
                                    </form>
                                </>
                            ) : (
                                <div className="flex-1 flex items-center justify-center text-gray-400">
                                    <div className="text-center">
                                        <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                        </svg>
                                        <p className="text-lg">Select a conversation</p>
                                        <p className="text-sm mt-1">Choose a conversation from the list to start chatting</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </>
    );
}
