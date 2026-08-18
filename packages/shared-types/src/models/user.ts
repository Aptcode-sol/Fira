export type UserRole = 'user' | 'venue_owner' | 'admin';
export type VerificationBadge = 'none' | 'brand' | 'band' | 'organizer';

export interface SocialLinks {
  instagram: string | null;
  twitter: string | null;
  facebook: string | null;
  website: string | null;
}

export interface BankDetails {
  accountName: string | null;
  accountNumber: string | null;
  ifscCode: string | null;
  bankName: string | null;
}

export interface User {
  _id: string;
  email: string;
  name: string;
  description: string | null;
  avatar: string | null;
  phone: string | null;
  city: string | null;
  role: UserRole;
  isVerified: boolean;
  emailVerified: boolean;
  emailVerifiedAt: string | null;
  verificationBadge: VerificationBadge;
  socialLinks: SocialLinks;
  followers: string[];
  following: string[];
  followingBrands: string[];
  bankDetails: BankDetails;
  isActive: boolean;
  isBlocked: boolean;
  createdAt: string;
  updatedAt: string;
}
