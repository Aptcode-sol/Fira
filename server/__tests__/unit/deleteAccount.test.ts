import { describe, it, expect, vi, beforeEach } from 'vitest';

// Same mock shape as selfFollow.test.ts (the proven pattern in this repo):
// userService requires all these models at module top, so vi.mock intercepts them.
vi.mock('../../models/User', () => ({
  __esModule: true,
  default: { findById: vi.fn(), findByIdAndDelete: vi.fn() },
}));
vi.mock('../../models/Event', () => ({ __esModule: true, default: { deleteMany: vi.fn() } }));
vi.mock('../../models/Venue', () => ({ __esModule: true, default: { deleteMany: vi.fn() } }));
vi.mock('../../models/BrandProfile', () => ({ __esModule: true, default: { deleteMany: vi.fn() } }));
vi.mock('../../models/Post', () => ({ __esModule: true, default: { deleteMany: vi.fn() } }));
vi.mock('../../models/Booking', () => ({ __esModule: true, default: { deleteMany: vi.fn() } }));
vi.mock('../../models/Ticket', () => ({ __esModule: true, default: { deleteMany: vi.fn() } }));
vi.mock('../../models/Notification', () => ({ __esModule: true, default: { deleteMany: vi.fn() } }));
vi.mock('../../models/PushSubscription', () => ({ __esModule: true, default: { deleteMany: vi.fn() } }));
vi.mock('../../models/Inquiry', () => ({ __esModule: true, default: { deleteMany: vi.fn() } }));

const User = require('../../models/User');
const Event = require('../../models/Event');
const Venue = require('../../models/Venue');
const BrandProfile = require('../../models/BrandProfile');
const Post = require('../../models/Post');
const Booking = require('../../models/Booking');
const Ticket = require('../../models/Ticket');
const Notification = require('../../models/Notification');
const PushSubscription = require('../../models/PushSubscription');
const Inquiry = require('../../models/Inquiry');
const userService = require('../../services/userService');

const ownedModels = [Event, Venue, BrandProfile, Post, Booking, Ticket, Notification, PushSubscription, Inquiry];

describe('deleteAccount - self-deletion cascade (17.4 / 18.4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const m of ownedModels) m.deleteMany = vi.fn().mockResolvedValue({ deletedCount: 0 });
  });

  it('throws when the user does not exist (nothing deleted)', async () => {
    User.findById = vi.fn().mockResolvedValue(null);
    User.findByIdAndDelete = vi.fn();

    await expect(userService.deleteAccount('missing')).rejects.toThrow('User not found');
    expect(User.findByIdAndDelete).not.toHaveBeenCalled();
    expect(Event.deleteMany).not.toHaveBeenCalled();
  });

  it('removes only the authenticated user\'s associated data, then the user', async () => {
    const userId = '507f1f77bcf86cd799439011';
    User.findById = vi.fn().mockResolvedValue({ _id: userId });
    User.findByIdAndDelete = vi.fn().mockResolvedValue({ _id: userId });

    const result = await userService.deleteAccount(userId);

    // Every owned collection is scoped to this user id (never a blanket delete).
    expect(Event.deleteMany).toHaveBeenCalledWith({ organizer: userId });
    expect(Venue.deleteMany).toHaveBeenCalledWith({ owner: userId });
    expect(BrandProfile.deleteMany).toHaveBeenCalledWith({ user: userId });
    expect(Post.deleteMany).toHaveBeenCalledWith({ author: userId });
    expect(Booking.deleteMany).toHaveBeenCalledWith({ user: userId });
    expect(Ticket.deleteMany).toHaveBeenCalledWith({ user: userId });
    expect(Notification.deleteMany).toHaveBeenCalledWith({ user: userId });
    expect(PushSubscription.deleteMany).toHaveBeenCalledWith({ user: userId });
    expect(Inquiry.deleteMany).toHaveBeenCalledWith({ user: userId });

    // The user record itself is removed.
    expect(User.findByIdAndDelete).toHaveBeenCalledWith(userId);
    expect(result.message).toBe('Account deleted successfully');
  });
});
