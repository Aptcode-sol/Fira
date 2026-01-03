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
  role: {
    type: String,
    enum: ['user'],
    default: 'user'
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
  }
}, {
  timestamps: true
});

// Index for faster queries
userSchema.index({ location: '2dsphere' });
userSchema.index({ verificationBadge: 1 });
userSchema.index({ isVerified: 1 });

module.exports = mongoose.model('User', userSchema);
