const User = require('../models/User');
const OTP = require('../models/OTP');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const emailService = require('./emailService');
const passwordValidator = require('../utils/passwordValidator');

const authService = {
    /**
     * Generate random 4-digit OTP
     */
    generateOTP() {
        return Math.floor(1000 + Math.random() * 9000).toString();
    },

    /**
     * Register new user and send OTP
     */
    async register({ email, password, name, role = 'user', city = null }) {
        // Validate password strength
        const passwordCheck = passwordValidator.validate(password);
        if (!passwordCheck.isValid) {
            throw new Error(passwordCheck.errors.join('. '));
        }

        // Check if user exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            if (existingUser.emailVerified) {
                throw new Error('User already exists with this email');
            } else {
                // User registered but not verified, allow resending OTP
                // Delete old user and OTP to start fresh
                await User.deleteOne({ email });
                await OTP.deleteMany({ email });
            }
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create user (not verified yet)
        const user = await User.create({
            email,
            password: hashedPassword,
            name,
            role,
            city,
            emailVerified: false
        });

        // Generate OTP
        const otpCode = this.generateOTP();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        // Save OTP to database
        await OTP.create({
            email,
            code: otpCode,
            expiresAt,
            attempts: 0,
            lastSentAt: new Date()
        });

        // Send OTP email
        try {
            await emailService.sendOTPEmail(email, otpCode, name);
        } catch (error) {
            // If email fails, delete the user and OTP
            await User.deleteOne({ email });
            await OTP.deleteMany({ email });
            throw new Error('Failed to send verification email. Please try again.');
        }

        return {
            success: true,
            message: 'Registration successful! Please check your email for the verification code.',
            email: email
        };
    },

    /**
     * Verify OTP and activate user account
     */
    async verifyOTP({ email, code }) {
        // Find OTP record
        const otpRecord = await OTP.findOne({
            email,
            verified: false
        }).sort({ createdAt: -1 });

        if (!otpRecord) {
            throw new Error('No verification code found. Please request a new one.');
        }

        // Check if expired
        if (otpRecord.isExpired()) {
            await OTP.deleteOne({ _id: otpRecord._id });
            throw new Error('Verification code has expired. Please request a new one.');
        }

        // Check attempts
        if (otpRecord.attempts >= 5) {
            await OTP.deleteOne({ _id: otpRecord._id });
            throw new Error('Too many failed attempts. Please request a new verification code.');
        }

        // Verify code
        if (otpRecord.code !== code) {
            otpRecord.attempts += 1;
            await otpRecord.save();
            const remainingAttempts = 5 - otpRecord.attempts;
            throw new Error(`Invalid verification code. ${remainingAttempts} attempts remaining.`);
        }

        // Find user
        const user = await User.findOne({ email });
        if (!user) {
            throw new Error('User not found. Please register again.');
        }

        // Update user as verified
        user.emailVerified = true;
        user.emailVerifiedAt = new Date();
        await user.save();

        // Mark OTP as verified and delete
        await OTP.deleteOne({ _id: otpRecord._id });

        // Send welcome email (non-blocking)
        emailService.sendWelcomeEmail(email, user.name, user.role).catch(err => {
            console.error('Failed to send welcome email:', err);
        });

        // Generate token
        const token = jwt.sign(
            { userId: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        return {
            user: {
                _id: user._id,
                email: user.email,
                name: user.name,
                role: user.role,
                emailVerified: user.emailVerified
            },
            token,
            message: 'Email verified successfully! Welcome to FIRA!'
        };
    },

    /**
     * Resend OTP with cooldown check
     */
    async resendOTP({ email }) {
        // Check if user exists
        const user = await User.findOne({ email });
        if (!user) {
            throw new Error('No account found with this email.');
        }

        if (user.emailVerified) {
            throw new Error('Email is already verified. Please login.');
        }

        // Find existing OTP
        const existingOTP = await OTP.findOne({
            email,
            verified: false
        }).sort({ createdAt: -1 });

        // Check cooldown
        if (existingOTP && !existingOTP.canResend()) {
            const remainingSeconds = existingOTP.getRemainingCooldown();
            throw new Error(`Please wait ${remainingSeconds} seconds before requesting a new code.`);
        }

        // Generate new OTP
        const otpCode = this.generateOTP();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        // Delete old OTPs for this email
        await OTP.deleteMany({ email });

        // Create new OTP
        await OTP.create({
            email,
            code: otpCode,
            expiresAt,
            attempts: 0,
            lastSentAt: new Date()
        });

        // Send OTP email
        await emailService.sendOTPEmail(email, otpCode, user.name);

        return {
            success: true,
            message: 'Verification code sent! Please check your email.',
            cooldownSeconds: 90
        };
    },

    /**
     * Login user
     */
    async login({ email, password }) {
        // Find user
        const user = await User.findOne({ email });
        if (!user) {
            throw new Error('Invalid credentials');
        }

        // Check if email is verified
        if (!user.emailVerified) {
            throw new Error('EMAIL_NOT_VERIFIED');
        }

        // Check password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            throw new Error('Invalid credentials');
        }

        // Generate token
        const token = jwt.sign(
            { userId: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        return {
            user: {
                _id: user._id,
                email: user.email,
                name: user.name,
                role: user.role,
                emailVerified: user.emailVerified,
                isVerified: user.isVerified,
                verificationBadge: user.verificationBadge
            },
            token
        };
    },

    /**
     * Get user from token
     */
    async getUserFromToken(token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findById(decoded.userId).select('-password');
            return user;
        } catch (error) {
            throw new Error('Invalid token');
        }
    }
};

module.exports = authService;

