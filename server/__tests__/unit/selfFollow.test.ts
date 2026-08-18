import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the User model
vi.mock('../../models/User', () => {
  return {
    default: {
      findById: vi.fn(),
      findByIdAndUpdate: vi.fn(),
    },
    __esModule: true,
  };
});

const User = require('../../models/User');
const userService = require('../../services/userService');

describe('Self-follow bug fix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('followUser - self-follow guard', () => {
    it('rejects when userId equals targetUserId (string comparison)', async () => {
      await expect(
        userService.followUser('abc123', 'abc123')
      ).rejects.toThrow('A user cannot follow themselves');
    });

    it('rejects when userId equals targetUserId (ObjectId-like with toString)', async () => {
      const id = { toString: () => '507f1f77bcf86cd799439011' };
      const sameId = { toString: () => '507f1f77bcf86cd799439011' };

      await expect(
        userService.followUser(id, sameId)
      ).rejects.toThrow('A user cannot follow themselves');
    });

    it('allows follow when userId differs from targetUserId', async () => {
      const mockUser = { _id: 'user1' };
      const mockTarget = { _id: 'user2' };
      User.findById = vi.fn()
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce(mockTarget);
      User.findByIdAndUpdate = vi.fn().mockResolvedValue({});

      const result = await userService.followUser('user1', 'user2');
      expect(result.message).toBe('Successfully followed user');
    });
  });

  describe('unfollowUser - self-follow guard', () => {
    it('rejects self-unfollow', async () => {
      await expect(
        userService.unfollowUser('abc123', 'abc123')
      ).rejects.toThrow('A user cannot follow themselves');
    });
  });

  describe('getUserById - legacy self-reference filtering', () => {
    it('filters own ID from followers array', async () => {
      const userId = '507f1f77bcf86cd799439011';
      User.findById = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue({
            _id: { toString: () => userId },
            followers: [
              { toString: () => userId },
              { toString: () => 'other1' },
              { toString: () => 'other2' },
            ],
            following: [
              { toString: () => userId },
              { toString: () => 'other3' },
            ],
          }),
        }),
      });

      const user = await userService.getUserById(userId);
      expect(user.followers).toHaveLength(2);
      expect(user.followers.map((f: any) => f.toString())).not.toContain(userId);
      expect(user.following).toHaveLength(1);
      expect(user.following.map((f: any) => f.toString())).not.toContain(userId);
    });

    it('handles user with no followers/following arrays', async () => {
      User.findById = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue({
            _id: { toString: () => 'user1' },
          }),
        }),
      });

      const user = await userService.getUserById('user1');
      expect(user.followers).toBeUndefined();
      expect(user.following).toBeUndefined();
    });
  });
});
