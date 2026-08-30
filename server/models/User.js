const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: null,
    maxLength: 500
  },
  avatar: {
    type: String,
    default: null
  },
  phone: {
    type: String,
    default: null
  },
  city: {
    type: String,
    trim: true,
    default: null
  },
  /**
   * Canonical slug of `city`. Derived by the hook below - see Venue.address.citySlug
   * for why the display name is not the thing we match on.
   */
  citySlug: {
    type: String,
    default: null
  },
  role: {
    type: String,
    enum: ['user', 'venue_owner', 'admin'],
    default: 'user'
  },
  roles: {
    type: [String],
    enum: ['user', 'venue_owner', 'admin'],
    default: ['user']
  },
  adminRole: {
    type: String,
    enum: ['super_admin', 'admin', 'moderator'],
    default: null
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  emailVerifiedAt: {
    type: Date,
    default: null
  },
  verificationBadge: {
    type: String,
    enum: ['none', 'brand', 'band', 'organizer'],
    default: 'none'
  },
  socialLinks: {
    instagram: { type: String, default: null },
    twitter: { type: String, default: null },
    facebook: { type: String, default: null },
    website: { type: String, default: null }
  },
  followers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  following: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  followingBrands: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BrandProfile'
  }],
  /**
   * Saved payout accounts. One is flagged `isDefault`, which is what a venue or
   * event pre-selects at creation time; the organiser can pick a different one
   * there without changing this default.
   */
  bankAccounts: [{
    accountName: { type: String, required: true },
    accountNumber: { type: String, required: true },
    ifscCode: { type: String, required: true },
    bankName: { type: String, required: true },
    isDefault: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
  }],
  /**
   * The default account, mirrored here on every change to `bankAccounts`.
   *
   * Deliberately kept rather than migrated away: payouts (paymentService),
   * earnings breakdowns (earningsService), admin reads and registration all read
   * this shape today. Mirroring the default means multi-account support does not
   * require rewriting any payout-critical code path - those keep resolving a
   * single account exactly as before, and get the default unless a listing names
   * a specific one.
   */
  bankDetails: {
    accountName: { type: String, default: null },
    accountNumber: { type: String, default: null },
    ifscCode: { type: String, default: null },
    bankName: { type: String, default: null }
  },
  // Brand/Profile Fields
  coverPhoto: {
    type: String,
    default: null
  },
  ownerName: {
    type: String,
    trim: true,
    default: null
  },
  address: {
    type: String,
    default: null
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      default: [0, 0] // [longitude, latitude]
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isBlocked: {
    type: Boolean,
    default: false
  },
  // Government ID fields (for venue owners)
  govIdType: {
    type: String,
    enum: ['aadhar', 'pan', 'driving_license', 'passport', 'voter_id'],
    default: null
  },
  govIdNumber: {
    type: String,
    default: null
  },
  govIdDocument: {
    type: String,  // URL to uploaded document
    default: null
  },
  govIdVerified: {
    type: Boolean,
    default: false
  },
  // Business details (for venue owners)
  businessName: {
    type: String,
    trim: true,
    default: null
  },
  businessPhone: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Index for faster queries
userSchema.index({ location: '2dsphere' });
userSchema.index({ verificationBadge: 1 });
userSchema.index({ isVerified: 1 });
userSchema.index({ followingBrands: 1 });

// Derives citySlug from city on every write path (signup, profile edit, admin).
require('../utils/citySlugHook').attachCitySlug(userSchema);

module.exports = mongoose.model('User', userSchema);
