'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { messagesApi, Conversation, Message } from '@/lib/api';
import Navbar from '@/components/Navbar';
import PartyBackground from '@/components/PartyBackground';
import { Button, Input } from '@/components/ui';
import { useMobileViewport } from '@/hooks/useMobileViewport';

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

    // Cursor state for "load older". nextBefore is the createdAt of the oldest
    // message held; hasMore says whether anything precedes it.
    const [hasMore, setHasMore] = useState(false);
    const [nextBefore, setNextBefore] = useState<string | null>(null);
    const [isLoadingOlder, setIsLoadingOlder] = useState(false);

    // The conversation list is paged rather than infinitely appended, so it can
    // state where you are instead of silently running past the bottom of the screen.
    const [conversationPage, setConversationPage] = useState(1);
    const [totalConversationPages, setTotalConversationPages] = useState(1);

    // True while the opened thread's first page is in flight.
    const [isLoadingThread, setIsLoadingThread] = useState(false);
    // Which thread the UI is currently committed to, so a slow response for a
    // thread the user has already left cannot overwrite the one now on screen.
    const activeThreadRef = useRef<string | null>(null);

    const scrollRef = useRef<HTMLDivElement>(null);
    // isMobile picks the portal path; the height/offset drive the panel so the
    // composer stays above the keyboard rather than under it.
    const { isMobile, height: mobileHeight, offsetTop: mobileOffsetTop } = useMobileViewport();
    // Portals need a DOM target, which does not exist during SSR.
    const [isMounted, setIsMounted] = useState(false);
    useEffect(() => setIsMounted(true), []);
    // Set when the next render was caused by prepending history, so the
    // scroll-to-bottom effect can stand down.
    const prependedRef = useRef(false);
    const conversationIdFromUrl = searchParams.get('conversation');
    const selectedIdRef = useRef<string | null>(null);
    selectedIdRef.current = selectedConversation?._id ?? null;

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

    /**
     * Load a thread when it is selected, clearing the previous one first.
     *
     * Without the reset, the outgoing thread's messages stayed on screen until the
     * new fetch resolved - so opening a chat briefly showed the last chat you had
     * looked at, then swapped. Most obvious on mobile, where the panel is
     * full-screen and the wrong conversation filled the whole display.
     */
    useEffect(() => {
        if (!selectedConversation) {
            activeThreadRef.current = null;
            setMessages([]);
            return;
        }

        setMessages([]);
        setHasMore(false);
        setNextBefore(null);
        setIsLoadingThread(true);
        loadMessages(selectedConversation._id);
    }, [selectedConversation?._id]);

    // Stick to the newest message by scrolling the thread container itself.
    //
    // This used to call scrollIntoView() on a sentinel at the bottom of the list.
    // That scrolls *every* scrollable ancestor, so it dragged the whole document
    // down to bring the composer into view - opening any chat visibly shoved the
    // page down. Assigning scrollTop touches only this container and leaves the
    // page where the user left it.
    //
    // Skipped when the list grew at the top: prepending history must not yank the
    // viewport back to the bottom.
    useEffect(() => {
        if (prependedRef.current) {
            prependedRef.current = false;
            return;
        }
        scrollToLatest();
    }, [messages]);

    // The keyboard opening shortens the thread, so whatever was at the bottom is
    // now hidden behind it. Re-anchor whenever the visible height changes, which
    // covers open, close, and rotation.
    useEffect(() => {
        if (mobileHeight) scrollToLatest();
    }, [mobileHeight]);

    /**
     * Apply the `?conversation=` deep link - exactly once.
     *
     * This has to wait for the list to load, so it depends on `conversations`. But
     * opening any thread zeroes its unread count through
     * `setConversations(prev => prev.map(...))`, which always returns a new array,
     * which re-ran this effect and re-selected whatever the URL still pointed at.
     * Picking an older thread therefore bounced straight back to the one the
     * enquiry redirect had put in the URL. With two threads from the same person
     * (two of their venues, say) the rows look identical, so it presented as the
     * older thread refusing to open.
     *
     * The ref makes this a one-shot: after the deep link is honoured, selection
     * belongs to the user.
     */
    const appliedUrlSelection = useRef(false);
    useEffect(() => {
        if (appliedUrlSelection.current) return;
        if (!conversationIdFromUrl || isLoading || conversations.length === 0) return;

        const conv = conversations.find(c => c._id === conversationIdFromUrl);
        if (conv) {
            setSelectedConversation(conv);
            appliedUrlSelection.current = true;
        }
    }, [conversationIdFromUrl, conversations, isLoading]);

    /**
     * Open a thread and keep the URL pointing at it, so a refresh or a shared link
     * lands back on the same thread. `replace` rather than `push` so Back leaves
     * the inbox instead of walking through every thread visited.
     */
    const selectConversation = (conversation: Conversation) => {
        setSelectedConversation(conversation);
        router.replace(`/messages?conversation=${conversation._id}`, { scroll: false });
    };

    const closeConversation = () => {
        setSelectedConversation(null);
        // Drop the param too, otherwise a refresh reopens what was just closed.
        router.replace('/messages', { scroll: false });
    };

    /**
     * Live updates. The SSE hook in the app shell re-dispatches every stream
     * payload as a `fira:sse` window event, so this page needs no socket of its
     * own - it just listens. Without this the recipient saw nothing until reload,
     * which is the difference between a message list and a chat.
     */
    useEffect(() => {
        const onSse = (event: Event) => {
            const payload = (event as CustomEvent).detail;
            if (!payload?.type) return;

            if (payload.type === 'message:new') {
                const { conversationId, message } = payload;

                // Append only if this thread is open, and guard against the echo
                // of a message this tab just sent.
                if (conversationId === selectedIdRef.current) {
                    setMessages(prev =>
                        prev.some(m => m._id === message._id) ? prev : [...prev, message]
                    );
                }

                setConversations(prev => {
                    const index = prev.findIndex(c => c._id === conversationId);
                    if (index === -1) return prev; // thread not in the loaded pages

                    const updated = {
                        ...prev[index],
                        lastMessage: {
                            content: message.content,
                            sender: message.sender?._id || '',
                            timestamp: message.createdAt,
                        },
                        // An open thread is being read, so it stays at zero.
                        unreadCount: conversationId === selectedIdRef.current
                            ? 0
                            : (prev[index].unreadCount || 0) + 1,
                    };

                    // A new message is the one thing that *should* reorder the
                    // inbox: move it to the top so the client matches the server's
                    // updatedAt ordering instead of drifting until the next fetch.
                    return [updated, ...prev.slice(0, index), ...prev.slice(index + 1)];
                });
            }

            if (payload.type === 'message:read' && payload.conversationId === selectedIdRef.current) {
                // The other side opened the thread: flip our own bubbles to read.
                setMessages(prev => prev.map(m =>
                    m.sender._id === user?._id ? { ...m, isRead: true } : m
                ));
            }
        };

        window.addEventListener('fira:sse', onSse);
        return () => window.removeEventListener('fira:sse', onSse);
    }, [user?._id]);

    /**
     * Pin the thread to its newest message. Sets scrollTop on the container rather
     * than calling scrollIntoView, which would also scroll the document and shove
     * the whole page around.
     */
    const scrollToLatest = () => {
        const container = scrollRef.current;
        if (container) container.scrollTop = container.scrollHeight;
    };

    const loadConversations = async (page = conversationPage) => {
        try {
            setIsLoading(true);
            const response = await messagesApi.getConversations({ page });
            setConversations(response.conversations);
            setConversationPage(response.pagination.page);
            setTotalConversationPages(response.pagination.totalPages);
        } catch (err) {
            console.error('Failed to load conversations:', err);
            setError('Failed to load conversations');
        } finally {
            setIsLoading(false);
        }
    };

    const goToConversationPage = (page: number) => {
        if (page < 1 || page > totalConversationPages || isLoading) return;
        loadConversations(page);
    };

    const loadMessages = async (conversationId: string) => {
        activeThreadRef.current = conversationId;
        try {
            const response = await messagesApi.getMessages(conversationId);

            // Tapping through threads quickly can leave requests in flight out of
            // order. Anything that is no longer the open thread is discarded rather
            // than painted over the current one.
            if (activeThreadRef.current !== conversationId) return;

            setMessages(response.messages);
            setHasMore(response.pagination.hasMore);
            setNextBefore(response.pagination.nextBefore);

            // Update conversation in list with zero unread
            setConversations(prev => prev.map(c =>
                c._id === conversationId ? { ...c, unreadCount: 0 } : c
            ));
        } catch (err) {
            console.error('Failed to load messages:', err);
        } finally {
            if (activeThreadRef.current === conversationId) setIsLoadingThread(false);
        }
    };

    /**
     * Prepend the page of messages older than the current cursor, holding the
     * user's place: measure scrollHeight before the insert and restore the delta
     * after, otherwise the content they were reading jumps off screen.
     */
    const loadOlder = async () => {
        if (!selectedConversation || !hasMore || !nextBefore || isLoadingOlder) return;

        const container = scrollRef.current;
        const heightBefore = container?.scrollHeight ?? 0;
        const topBefore = container?.scrollTop ?? 0;

        setIsLoadingOlder(true);
        try {
            const response = await messagesApi.getMessages(selectedConversation._id, {
                before: nextBefore,
            });
            prependedRef.current = true;
            setMessages(prev => {
                const known = new Set(prev.map(m => m._id));
                return [...response.messages.filter(m => !known.has(m._id)), ...prev];
            });
            setHasMore(response.pagination.hasMore);
            setNextBefore(response.pagination.nextBefore);

            requestAnimationFrame(() => {
                if (!container) return;
                container.scrollTop = topBefore + (container.scrollHeight - heightBefore);
            });
        } catch (err) {
            console.error('Failed to load older messages:', err);
        } finally {
            setIsLoadingOlder(false);
        }
    };

    // Reaching the top of the thread pulls in the previous page.
    const handleScroll = () => {
        if (scrollRef.current && scrollRef.current.scrollTop < 80) loadOlder();
    };

    /**
     * Optimistic send: the bubble appears immediately with a pending tick, then
     * either resolves to the stored message or flips to a retryable failure.
     * Previously a failed send only hit console.error - the typed text vanished
     * with no error and no way to resend, so people had no idea it was lost.
     */
    const deliver = async (content: string, tempId: string) => {
        if (!selectedConversation) return;
        try {
            const response = await messagesApi.sendMessage({
                conversationId: selectedConversation._id,
                content,
            });
            setMessages(prev => prev.map(m => (m._id === tempId ? response.message : m)));
            // Same reordering rule as an incoming message: sending bumps this
            // thread to the top, matching how the server will return the list.
            setConversations(prev => {
                const index = prev.findIndex(c => c._id === selectedConversation._id);
                if (index === -1) return prev;
                const updated = {
                    ...prev[index],
                    lastMessage: {
                        content,
                        sender: user?._id || '',
                        timestamp: new Date().toISOString(),
                    },
                };
                return [updated, ...prev.slice(0, index), ...prev.slice(index + 1)];
            });
        } catch (err) {
            console.error('Failed to send message:', err);
            setMessages(prev => prev.map(m =>
                m._id === tempId ? { ...m, pending: false, failed: true } : m
            ));
        }
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        const content = newMessage.trim();
        if (!content || !selectedConversation || isSending) return;

        const tempId = `pending-${Date.now()}`;
        const optimistic: Message = {
            _id: tempId,
            conversation: selectedConversation._id,
            // `avatar` is optional, not nullable - a null from the profile has to
            // become undefined or it fails the Message type.
            sender: { _id: user?._id || '', name: user?.name || '', avatar: user?.avatar ?? undefined },
            content,
            messageType: 'text',
            isRead: false,
            createdAt: new Date().toISOString(),
            pending: true,
        };

        setMessages(prev => [...prev, optimistic]);
        setNewMessage('');
        setIsSending(true);
        await deliver(content, tempId);
        setIsSending(false);
    };

    const retryMessage = async (failed: Message) => {
        setMessages(prev => prev.map(m =>
            m._id === failed._id ? { ...m, failed: false, pending: true } : m
        ));
        await deliver(failed.content, failed._id);
    };

    const getOtherParticipant = (conversation: Conversation) => {
        return conversation.participants.find(p => p._id !== user?._id);
    };

    /**
     * What to put on a thread row / header.
     *
     * For an enquiry the subject is the listing, not the person: a thread is one
     * conversation about one event or venue, and one owner can appear in several of
     * them. So the listing name leads and the person is the secondary line -
     * otherwise every thread with the same owner is an identical row.
     *
     * The picture follows the title: an enquiry thread shows the event or venue
     * photo, because that is the subject of the conversation and it makes two
     * threads with the same owner tell themselves apart at a glance. Falls back to
     * the person's avatar when the listing has no image.
     */
    const getDisplayInfo = (conversation: Conversation) => {
        const other = getOtherParticipant(conversation);
        const otherName = other?.name || 'Unknown User';
        const context = conversation.inquiryContext;
        // Fix: compare as strings to handle ObjectId vs string mismatch
        const isBrandOwner = conversation.brand?.user?.toString() === user?._id?.toString();

        if (context?.referenceName) {
            return {
                title: context.referenceName,
                subtitle: otherName,
                image: context.referenceImage || other?.avatar,
                // A place or an event is a rounded square; a face is a circle.
                imageIsListing: Boolean(context.referenceImage),
                isBrand: false,
                kind: context.referenceType ?? null,
                href: context.referenceId
                    ? `/${context.referenceType}s/${context.referenceId}`
                    : null,
            };
        }

        if (conversation.brand && !isBrandOwner) {
            return {
                title: conversation.brand.name,
                subtitle: conversation.brand.type,
                image: conversation.brand.profilePhoto,
                imageIsListing: false,
                isBrand: true,
                kind: 'creator' as const,
                href: `/creators/${conversation.brand._id}`,
            };
        }

        return {
            title: otherName,
            subtitle: null,
            image: other?.avatar,
            imageIsListing: false,
            isBrand: false,
            kind: null,
            href: null,
        };
    };

    /**
     * Tiny badge marking what a thread is about. Two rows can share a title style
     * and a person, so the type is what tells you at a glance whether you are
     * looking at an event enquiry, a venue enquiry, or a creator chat.
     * Icons are the same ones the nav uses for each section.
     */
    const KIND_ICON: Record<'event' | 'venue' | 'creator', string> = {
        event: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
        venue: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
        creator: 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z',
    };

    const renderKindBadge = (kind: 'event' | 'venue' | 'creator' | null) => {
        if (!kind) return null;
        return (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white/[0.06] border border-white/10 text-[10px] uppercase tracking-wide text-gray-300 flex-shrink-0">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={KIND_ICON[kind]} />
                </svg>
                {kind}
            </span>
        );
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

    /** Clock time only - the day is carried by the divider above the group. */
    const formatClock = (dateStr: string) =>
        new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

    /**
     * Day label for a divider. Compared on calendar date, not elapsed hours: a
     * message from 11pm last night is "Yesterday" at 1am, which an hours-based
     * check would call "Today".
     */
    const dayLabel = (dateStr: string) => {
        const date = new Date(dateStr);
        const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
        const dayDiff = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86_400_000);

        if (dayDiff === 0) return 'Today';
        if (dayDiff === 1) return 'Yesterday';
        if (dayDiff < 7) return date.toLocaleDateString('en-US', { weekday: 'long' });
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            // Only show the year once it is not the current one.
            year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
        });
    };

    /** Read state for one of my own bubbles: pending, failed, sent, or read. */
    const receiptFor = (message: Message) => {
        if (message.pending) return { label: 'Sending', icon: '···' };
        if (message.failed) return { label: 'Failed to send', icon: '!' };
        if (message.isRead) return { label: 'Read', icon: '✓✓' };
        return { label: 'Sent', icon: '✓' };
    };

    const enquiry = selectedConversation?.inquiryContext;
    // Contact details are the counterparty's, so only show them to the person who
    // did not write them - the sender does not need their own email quoted back.
    const showContact = Boolean(
        enquiry?.senderEmail && enquiry.senderName && selectedConversation?.participants
            .find(p => p._id === user?._id)?.email !== enquiry.senderEmail
    );

    if (authLoading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-violet-500"></div>
            </div>
        );
    }

    if (!user) return null;

    /**
     * The thread itself: header, contact bar, messages, composer.
     *
     * Built once and rendered in two places - inside the desktop grid cell, and
     * inside a body-level portal on mobile. Keeping it in one variable is what
     * stops the two surfaces drifting apart the way /messages and the old /inbox
     * did.
     */
    const threadPanel = selectedConversation && selectedDisplayInfo ? (
        <>
            {/* Chat Header. On mobile this sits at the very top of the screen, so
                it clears the notch; inside the desktop card it is just p-4. */}
            <div className="p-4 pt-[max(1rem,env(safe-area-inset-top))] md:pt-4 border-b border-white/10 flex items-center gap-3 flex-shrink-0">
                <button
                    onClick={closeConversation}
                    className="md:hidden text-gray-400 hover:text-white"
                    aria-label="Back to conversations"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <div className={`w-10 h-10 bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center overflow-hidden flex-shrink-0 ${selectedDisplayInfo.imageIsListing ? 'rounded-xl' : 'rounded-full'}`}>
                    {selectedDisplayInfo.image ? (
                        <img src={selectedDisplayInfo.image} alt="" className="w-full h-full object-cover" />
                    ) : (
                        <span className="text-white font-medium">
                            {(selectedDisplayInfo.subtitle || selectedDisplayInfo.title)[0]?.toUpperCase()}
                        </span>
                    )}
                </div>
                <div className="min-w-0">
                    {/* Listing name as the title, linked through to the listing
                        itself; the person is the small line under it. */}
                    {selectedDisplayInfo.href ? (
                        <Link
                            href={selectedDisplayInfo.href}
                            className="font-bold text-lg truncate block text-white hover:text-violet-300 transition-colors"
                        >
                            {selectedDisplayInfo.title}
                        </Link>
                    ) : (
                        <h3 className="font-bold text-lg truncate" style={{ color: '#ffffff', opacity: 1 }}>
                            {selectedDisplayInfo.title}
                        </h3>
                    )}
                    {selectedDisplayInfo.subtitle && (
                        <p className="text-sm text-gray-400 truncate capitalize">
                            {selectedDisplayInfo.subtitle}
                        </p>
                    )}
                </div>
            </div>

            {/* Who is asking and how to reach them. The owner gets this so they can
                reply out-of-band (call/email) as well as in chat; only rendered for
                the party who did not supply it. */}
            {showContact && (
                <div className="px-4 py-3 border-b border-white/10 bg-white/[0.02] flex flex-wrap items-center gap-x-4 gap-y-1 text-xs flex-shrink-0">
                    <span className="text-gray-300">
                        From <span className="text-white font-medium">{enquiry!.senderName}</span>
                    </span>
                    <a href={`mailto:${enquiry!.senderEmail}`} className="text-violet-400 hover:text-violet-300">
                        {enquiry!.senderEmail}
                    </a>
                    {enquiry!.senderPhone && (
                        <a href={`tel:${enquiry!.senderPhone}`} className="text-violet-400 hover:text-violet-300">
                            {enquiry!.senderPhone}
                        </a>
                    )}
                </div>
            )}

            {/* Messages - min-h-0 is required for flex overflow to work correctly */}
            <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-4 min-h-0"
            >
                {isLoadingThread && (
                    <div className="h-full flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-violet-500" />
                    </div>
                )}

                {/* History control. Scrolling to the top pulls the previous page in
                    automatically; the button is the explicit affordance. */}
                {!isLoadingThread && hasMore && (
                    <div className="flex justify-center">
                        <button
                            type="button"
                            onClick={loadOlder}
                            disabled={isLoadingOlder}
                            className="text-xs text-violet-400 hover:text-violet-300 disabled:text-gray-500 px-3 py-1.5 rounded-full border border-white/10"
                        >
                            {isLoadingOlder ? 'Loading...' : 'Load earlier messages'}
                        </button>
                    </div>
                )}

                {!isLoadingThread && messages.map((message, index) => {
                    const isMine = message.sender._id === user._id;
                    // Divider whenever the calendar day changes from the previous
                    // message (and above the very first one).
                    const previous = index > 0 ? messages[index - 1] : null;
                    const showDivider =
                        !previous || dayLabel(previous.createdAt) !== dayLabel(message.createdAt);
                    const receipt = receiptFor(message);

                    return (
                        <div key={message._id} className="space-y-4">
                            {showDivider && (
                                <div className="flex items-center gap-3">
                                    <span className="flex-1 h-px bg-white/10" />
                                    <span className="text-[11px] uppercase tracking-wide text-gray-300">
                                        {dayLabel(message.createdAt)}
                                    </span>
                                    <span className="flex-1 h-px bg-white/10" />
                                </div>
                            )}

                            {/* A system line states what an enquiry thread is about.
                                It belongs to neither side, so it is centred and
                                unattributed rather than dressed as someone's bubble. */}
                            {message.messageType === 'system' ? (
                                <div className="flex justify-center">
                                    <p className="max-w-[85%] text-center text-xs text-gray-300 bg-white/[0.04] border border-white/10 rounded-full px-3 py-1.5">
                                        {message.content}
                                    </p>
                                </div>
                            ) : (
                                <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[75%] ${isMine
                                        ? message.failed ? 'bg-red-600/80 text-white' : 'bg-violet-600 text-white'
                                        : 'bg-white/10 text-white'
                                        } rounded-2xl px-4 py-2 ${message.pending ? 'opacity-70' : ''}`}>
                                        <p className="break-words">{message.content}</p>
                                        <p className={`text-xs mt-1 flex items-center gap-1.5 ${isMine ? 'text-violet-200' : 'text-gray-300'
                                            }`}>
                                            <span>{formatClock(message.createdAt)}</span>
                                            {/* Receipt on own messages only - you cannot
                                                be told whether you read your own message. */}
                                            {isMine && (
                                                <span aria-label={receipt.label} title={receipt.label}>
                                                    {receipt.icon}
                                                </span>
                                            )}
                                        </p>
                                        {message.failed && (
                                            <button
                                                type="button"
                                                onClick={() => retryMessage(message)}
                                                className="mt-1 text-xs underline text-white/90 hover:text-white"
                                            >
                                                Retry
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Composer. flex-shrink-0 keeps it pinned; the safe-area inset clears
                the iPhone home indicator and collapses to 0 elsewhere. */}
            <form
                onSubmit={handleSendMessage}
                className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-white/10 flex-shrink-0 bg-black/20"
            >
                <div className="flex gap-2">
                    <Input
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onFocus={scrollToLatest}
                        placeholder="Type a message..."
                        // 16px minimum, enforced globally for coarse pointers, is what
                        // stops iOS zooming the page in on focus.
                        className="flex-1 bg-white/10 border-white/20 text-white placeholder-gray-400"
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
    ) : null;

    return (
        <>
            <PartyBackground />
            <Navbar />
            {/* Height is pinned on mobile so the list can size itself with flex
                instead of a hardcoded dvh subtraction that did not account for the
                top island, the heading and the bottom nav - which is what pushed
                the last row underneath that nav. `body` already reserves 5rem for
                the nav on mobile (globals.css), so that is subtracted here rather
                than added as padding. */}
            <main className="relative z-20 flex flex-col px-4 md:px-8 pt-20 pb-2 md:pb-8 h-[calc(100dvh-5rem-env(safe-area-inset-bottom))] md:h-auto md:min-h-screen">
                <div className="max-w-6xl mx-auto w-full flex-1 flex flex-col min-h-0">
                    {/* "Enquiries", not "Messages": every thread here starts as an
                        enquiry about an event, venue or creator. */}
                    <h1 className="text-2xl font-bold text-white mb-4 md:mb-6 flex-shrink-0">Enquiries</h1>

                    {error && (
                        <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1 min-h-0 md:flex-none md:h-[calc(100dvh-200px)]">
                        {/* Conversations List */}
                        <div className={`bg-white/[0.02] backdrop-blur-xl border border-white/[0.05] rounded-2xl overflow-hidden min-h-0 flex-col ${selectedConversation ? 'hidden md:flex' : 'flex'}`}>
                            <div className="p-4 border-b border-white/10 flex-shrink-0">
                                <h2 className="text-lg font-semibold text-white">Conversations</h2>
                            </div>
                            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
                                {isLoading ? (
                                    <div className="flex items-center justify-center h-32">
                                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-violet-500"></div>
                                    </div>
                                ) : conversations.length === 0 ? (
                                    <div className="p-6 text-center text-gray-300">
                                        <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                        </svg>
                                        <p>No enquiries yet</p>
                                        <p className="text-sm mt-2">Ask a question on an event, venue or creator to start one</p>
                                    </div>
                                ) : (
                                    conversations.map(conversation => {
                                        const displayInfo = getDisplayInfo(conversation);
                                        return (
                                            <button
                                                key={conversation._id}
                                                onClick={() => selectConversation(conversation)}
                                                className={`w-full p-4 flex items-center gap-3 hover:bg-white/5 transition-colors border-b border-white/5 ${selectedConversation?._id === conversation._id ? 'bg-white/10' : ''
                                                    }`}
                                            >
                                                <div className="relative">
                                                    <div className={`w-12 h-12 bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center overflow-hidden ${displayInfo.imageIsListing ? 'rounded-xl' : 'rounded-full'}`}>
                                                        {displayInfo.image ? (
                                                            <img src={displayInfo.image} alt="" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <span className="text-white font-medium">
                                                                {(displayInfo.subtitle || displayInfo.title)[0]?.toUpperCase()}
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
                                                        {/* The listing leads - it is what the thread is
                                                            about, and it is what distinguishes two threads
                                                            with the same owner. */}
                                                        <h3 className="font-semibold truncate" style={{ color: '#ffffff', opacity: 1 }}>
                                                            {displayInfo.title}
                                                        </h3>
                                                        <span className="text-xs text-gray-300 flex-shrink-0">
                                                            {formatTime(conversation.lastMessage?.timestamp || conversation.updatedAt)}
                                                        </span>
                                                    </div>
                                                    {/* Second line mirrors the first: person on the left,
                                                        type badge on the right under the timestamp. The
                                                        name takes whatever width is left and ellipsises,
                                                        so a long name can never push the badge out of
                                                        the row. */}
                                                    {(displayInfo.kind || displayInfo.subtitle) && (
                                                        <div className="flex items-center justify-between gap-2 mt-0.5">
                                                            <span className="text-xs text-gray-400 truncate capitalize min-w-0">
                                                                {displayInfo.subtitle}
                                                            </span>
                                                            {renderKindBadge(displayInfo.kind)}
                                                        </div>
                                                    )}
                                                    <p className="text-sm text-gray-300 truncate">
                                                        {conversation.lastMessage?.content || 'No messages yet'}
                                                    </p>
                                                </div>
                                            </button>
                                        );
                                    })
                                )}

                            </div>

                            {/* Pagination footer. Always shown, even at one page:
                                it tells you the list has ended rather than leaving
                                you wondering whether more is hidden under the
                                bottom nav, and it doubles as the spacer that keeps
                                the last row clear of that nav. */}
                            <div className="flex-shrink-0 flex items-center justify-center gap-4 px-4 py-3 border-t border-white/10 bg-black/20">
                                <button
                                    type="button"
                                    onClick={() => goToConversationPage(conversationPage - 1)}
                                    disabled={conversationPage <= 1 || isLoading}
                                    aria-label="Previous page"
                                    className="p-1 text-gray-400 hover:text-white disabled:text-gray-600 disabled:cursor-not-allowed"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                    </svg>
                                </button>
                                <span className="text-xs text-gray-300" aria-live="polite">
                                    {conversationPage} of {totalConversationPages}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => goToConversationPage(conversationPage + 1)}
                                    disabled={conversationPage >= totalConversationPages || isLoading}
                                    aria-label="Next page"
                                    className="p-1 text-gray-400 hover:text-white disabled:text-gray-600 disabled:cursor-not-allowed"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        {/* Chat View - desktop grid cell only. The mobile thread is
                            portalled to <body> further down, because a z-index set
                            in here is trapped inside `main`'s own stacking context
                            (main is `relative z-20`) and can never rise above the
                            z-50 navbars that live outside it. That is why the panel
                            was appearing underneath the top island and bottom bar. */}
                        <div className="hidden md:flex md:flex-col md:col-span-2 bg-white/[0.02] backdrop-blur-xl border border-white/[0.05] rounded-2xl overflow-hidden">
                            {selectedConversation && selectedDisplayInfo ? (
                                threadPanel
                            ) : (
                                <div className="flex-1 flex items-center justify-center text-gray-300">
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

            {/* Mobile thread, portalled out of `main` so it can actually cover the
                fixed navbars. Sized from the visual viewport so the composer stays
                above the keyboard rather than under it. */}
            {isMounted && isMobile && selectedConversation && selectedDisplayInfo &&
                createPortal(
                    <div
                        style={
                            mobileHeight
                                ? { height: `${mobileHeight}px`, top: `${mobileOffsetTop ?? 0}px` }
                                : undefined
                        }
                        className="fixed inset-x-0 top-0 z-[70] flex flex-col bg-[#0b0b0b] h-[100dvh]"
                    >
                        {threadPanel}
                    </div>,
                    document.body
                )}
        </>
    );
}
