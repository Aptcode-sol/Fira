const nodemailer = require('nodemailer');
const emailTemplates = require('../utils/emailTemplates');

/**
 * Email Service for FIRA
 * Handles all email sending functionality
 */

class EmailService {
  constructor() {
    this.transporter = null;
    this.initialize();
  }

  /**
   * Initialize email transporter with SMTP configuration
   */
  initialize() {
    try {
      // Validate required environment variables
      if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.error('❌ Missing SMTP configuration. Please check your .env file.');
        console.error('Required: SMTP_HOST, SMTP_USER, SMTP_PASS');
        return;
      }

      const smtpConfig = {
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_PORT === '465', // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        },
        tls: {
          rejectUnauthorized: false
        },
        // Add debug logging
        logger: process.env.NODE_ENV === 'development',
        debug: process.env.NODE_ENV === 'development'
      };

      this.transporter = nodemailer.createTransport(smtpConfig);

      console.log('✅ Email service initialized successfully');
      console.log(`📧 SMTP Host: ${process.env.SMTP_HOST}`);
      console.log(`📧 SMTP Port: ${smtpConfig.port}`);
      console.log(`📧 SMTP User: ${process.env.SMTP_USER}`);
      console.log(`📧 Secure: ${smtpConfig.secure}`);
    } catch (error) {
      console.error('❌ Email service initialization failed:', error.message);
    }
  }

  /**
   * Send OTP verification email
   * @param {string} email - Recipient email
   * @param {string} otp - 4-digit OTP code
   * @param {string} name - User's name
   * @returns {Promise<boolean>} - Success status
   */
  async sendOTPEmail(email, otp, name) {
    try {
      if (!this.transporter) {
        throw new Error('Email service not initialized');
      }

      const mailOptions = {
        from: `"${process.env.SMTP_FROM_NAME || 'Fira - Let\'s Celebrate'}" <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER}>`,
        to: email,
        subject: `${otp} is your FIRA verification code`,
        html: emailTemplates.otpVerification(name, otp),
        text: `Hey ${name}!\n\nYour FIRA verification code is: ${otp}\n\nThis code expires in 10 minutes.\n\nIf you didn't request this code, please ignore this email.\n\n- FIRA Team`
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ OTP email sent successfully:', info.messageId);
      return true;
    } catch (error) {
      console.error('❌ Failed to send OTP email:', error.message);
      throw new Error('Failed to send verification email. Please try again.');
    }
  }

  /**
   * Send welcome email after successful verification
   * @param {string} email - Recipient email
   * @param {string} name - User's name
   * @param {string} role - User's role
   * @returns {Promise<boolean>} - Success status
   */
  async sendWelcomeEmail(email, name, role) {
    try {
      if (!this.transporter) {
        throw new Error('Email service not initialized');
      }

      const mailOptions = {
        from: `"${process.env.SMTP_FROM_NAME || 'Fira - Let\'s Celebrate'}" <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER}>`,
        to: email,
        subject: 'Welcome to FIRA! 🎉',
        html: emailTemplates.welcome(name, role),
        text: `Hey ${name}!\n\nWelcome to FIRA! Your email has been successfully verified.\n\nStart exploring amazing venues and events now!\n\n- FIRA Team`
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Welcome email sent successfully:', info.messageId);
      return true;
    } catch (error) {
      console.error('❌ Failed to send welcome email:', error.message);
      // Don't throw error for welcome email, it's not critical
      return false;
    }
  }

  /**
   * Verify email service configuration
   * @returns {Promise<boolean>} - Verification status
   */
  async verifyConnection() {
    try {
      if (!this.transporter) {
        return false;
      }
      await this.transporter.verify();
      console.log('✅ Email service connection verified');
      return true;
    } catch (error) {
      console.error('❌ Email service verification failed:', error.message);
      return false;
    }
  }
  /**
   * Send ticket confirmation email
   * @param {string} email - Recipient email
   * @param {string} name - User's name
   * @param {object} event - Event details
   * @param {object} ticket - Ticket details
   * @returns {Promise<boolean>} - Success status
   */
  async sendTicketEmail(email, name, event, ticket) {
    try {
      if (!this.transporter) {
        console.warn('⚠️ Email service not initialized, skipping ticket email.');
        return false;
      }

      const mailOptions = {
        from: `"${process.env.SMTP_FROM_NAME || 'Fira Tickets'}" <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER}>`,
        to: email,
        subject: `Your Ticket for ${event.name} 🎟️`,
        html: emailTemplates.ticketConfirmation(name, event, ticket),
        // attachments: [
        //   {
        //     filename: 'ticket-qr.png',
        //     content: ticket.qrCode.split('base64,')[1],
        //     encoding: 'base64'
        //   }
        // ]
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Ticket email sent successfully:', info.messageId);
      return true;
    } catch (error) {
      console.error('❌ Failed to send ticket email:', error.message);
      return false;
    }
  }

  /**
   * Send password reset OTP email
   * @param {string} email - Recipient email
   * @param {string} otp - Reset code
   * @param {string} name - User's name
   * @returns {Promise<boolean>} - Success status
   */
  async sendPasswordResetEmail(email, otp, name) {
    try {
      if (!this.transporter) {
        throw new Error('Email service not initialized');
      }

      const mailOptions = {
        from: `"${process.env.SMTP_FROM_NAME || 'Fira - Let\'s Celebrate'}" <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER}>`,
        to: email,
        subject: `${otp} - Reset your FIRA password`,
        html: emailTemplates.passwordReset ? emailTemplates.passwordReset(name, otp) : `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #8b5cf6;">Reset Your Password</h2>
            <p>Hey ${name || 'there'},</p>
            <p>We received a request to reset your FIRA account password.</p>
            <p>Your password reset code is:</p>
            <div style="text-align: center; margin: 30px 0;">
              <span style="font-size: 36px; letter-spacing: 8px; font-weight: bold; color: #8b5cf6; background: #f3f4f6; padding: 15px 30px; border-radius: 10px;">${otp}</span>
            </div>
            <p>This code expires in 10 minutes.</p>
            <p>If you didn't request this, you can safely ignore this email.</p>
            <br>
            <p>- FIRA Team</p>
          </div>
        `,
        text: `Hey ${name}!\n\nYour FIRA password reset code is: ${otp}\n\nThis code expires in 10 minutes.\n\nIf you didn't request this, please ignore this email.\n\n- FIRA Team`
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Password reset email sent successfully:', info.messageId);
      return true;
    } catch (error) {
      console.error('❌ Failed to send password reset email:', error.message);
      throw new Error('Failed to send password reset email. Please try again.');
    }
  }

  /**
   * Send password changed confirmation email
   * @param {string} email - Recipient email
   * @param {string} name - User's name
   * @returns {Promise<boolean>} - Success status
   */
  async sendPasswordChangedEmail(email, name) {
    try {
      if (!this.transporter) {
        return false;
      }

      const mailOptions = {
        from: `"${process.env.SMTP_FROM_NAME || 'Fira - Let\'s Celebrate'}" <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER}>`,
        to: email,
        subject: 'Your FIRA password was changed',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #8b5cf6;">Password Changed Successfully</h2>
            <p>Hey ${name || 'there'},</p>
            <p>Your FIRA account password was successfully changed.</p>
            <p>If you didn't make this change, please contact us immediately.</p>
            <br>
            <p>- FIRA Team</p>
          </div>
        `,
        text: `Hey ${name}!\n\nYour FIRA account password was successfully changed.\n\nIf you didn't make this change, please contact us immediately.\n\n- FIRA Team`
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Password changed email sent successfully:', info.messageId);
      return true;
    } catch (error) {
      console.error('❌ Failed to send password changed email:', error.message);
      return false;
    }
  }

  /**
   * Send venue booking notification email to owner
   * @param {string} email - Venue owner's email
   * @param {string} ownerName - Venue owner's name
   * @param {object} venue - Venue details
   * @param {object} booking - Booking details
   * @param {object} booker - Booker's info
   * @returns {Promise<boolean>} - Success status
   */
  async sendVenueBookingEmail(email, ownerName, venue, booking, booker) {
    try {
      if (!this.transporter) {
        console.warn('⚠️ Email service not initialized, skipping venue booking email.');
        return false;
      }

      const mailOptions = {
        from: `"${process.env.SMTP_FROM_NAME || 'Fira - Let\'s Celebrate'}" <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER}>`,
        to: email,
        subject: `New Booking Request for ${venue.name} 🎉`,
        html: emailTemplates.venueBookingNotification(ownerName, venue, booking, booker),
        text: `Hey ${ownerName}!\n\nGreat news! Someone wants to book your venue ${venue.name}.\n\nBooking Details:\n- Date: ${new Date(booking.date).toLocaleDateString()}\n- Guests: ${booking.guestCount || 'Not specified'}\n- Total: ₹${booking.totalPrice || 'TBD'}\n\nFrom: ${booker.name} (${booker.email})\n\nLog in to your dashboard to respond: ${process.env.CLIENT_URL || 'http://localhost:3000'}/dashboard/requests\n\n- FIRA Team`
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Venue booking notification email sent successfully:', info.messageId);
      return true;
    } catch (error) {
      console.error('❌ Failed to send venue booking email:', error.message);
      return false;
    }
  }

  /**
   * Send event request notification email to venue owner
   * @param {string} email - Venue owner's email
   * @param {string} ownerName - Venue owner's name
   * @param {object} venue - Venue details
   * @param {object} event - Event details
   * @param {object} organizer - Organizer info
   * @returns {Promise<boolean>} - Success status
   */
  async sendEventRequestEmail(email, ownerName, venue, event, organizer) {
    try {
      if (!this.transporter) {
        console.warn('⚠️ Email service not initialized, skipping event request email.');
        return false;
      }

      const mailOptions = {
        from: `"${process.env.SMTP_FROM_NAME || 'Fira - Let\'s Celebrate'}" <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER}>`,
        to: email,
        subject: `New Event Request for ${venue.name} 🎉`,
        html: emailTemplates.eventRequestNotification(ownerName, venue, event, organizer),
        text: `Hey ${ownerName}!\n\nSomeone wants to host an event at your venue ${venue.name}.\n\nEvent: ${event.name}\nDate: ${new Date(event.date).toLocaleDateString()}\nTime: ${event.startTime} - ${event.endTime}\n\nOrganizer: ${organizer.name} (${organizer.email})\n\nLog in to your dashboard to respond: ${process.env.CLIENT_URL || 'http://localhost:3000'}/dashboard/requests\n\n- FIRA Team`
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Event request notification email sent successfully:', info.messageId);
      return true;
    } catch (error) {
      console.error('❌ Failed to send event request email:', error.message);
      return false;
    }
  }

  /**
   * Send brand activity notification email
   * @param {string} email - Recipient email
   * @param {string} userName - User's name
   * @param {string} brandName - Brand name
   * @param {string} activityType - Type of activity (brand_new_event, brand_new_post)
   * @param {object} data - Activity data (event or post details)
   * @returns {Promise<boolean>} - Success status
   */
  async sendBrandActivityEmail(email, userName, brandName, activityType, data) {
    try {
      if (!this.transporter) {
        console.warn('⚠️ Email service not initialized, skipping brand activity email.');
        return false;
      }

      let subject, html;
      
      if (activityType === 'brand_new_event') {
        subject = `🎉 ${brandName} just announced a new event!`;
        html = emailTemplates.brandNewEvent(userName, brandName, data.extra?.event || data);
      } else if (activityType === 'brand_new_post') {
        subject = `📢 New update from ${brandName}`;
        html = emailTemplates.brandNewPost(userName, brandName, data.extra?.post || data);
      } else {
        console.warn('Unknown brand activity type:', activityType);
        return false;
      }

      const mailOptions = {
        from: `"${process.env.SMTP_FROM_NAME || 'Fira - Let\'s Celebrate'}" <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER}>`,
        to: email,
        subject,
        html,
        text: `Hey ${userName}, ${brandName} has new activity! Check it out on FIRA.`
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Brand activity email sent successfully:', info.messageId);
      return true;
    } catch (error) {
      console.error('❌ Failed to send brand activity email:', error.message);
      return false;
    }
  }

  /**
   * Send event reminder email (1 hour before event)
   * @param {string} email - Recipient email
   * @param {string} userName - User's name
   * @param {object} event - Event details
   * @param {object} ticket - Ticket details
   * @returns {Promise<boolean>} - Success status
   */
  async sendEventReminderEmail(email, userName, event, ticket) {
    try {
      if (!this.transporter) {
        console.warn('⚠️ Email service not initialized, skipping event reminder email.');
        return false;
      }

      const mailOptions = {
        from: `"${process.env.SMTP_FROM_NAME || 'Fira - Let\'s Celebrate'}" <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER}>`,
        to: email,
        subject: `⏰ ${event.name} starts in 1 hour!`,
        html: emailTemplates.eventReminder(userName, event, ticket),
        text: `Hey ${userName}!\n\nDon't forget - ${event.name} starts in 1 hour!\n\nYour ticket ID: ${ticket.ticketId}\n\nSee you there!\n- FIRA Team`
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Event reminder email sent successfully:', info.messageId);
      return true;
    } catch (error) {
      console.error('❌ Failed to send event reminder email:', error.message);
      return false;
    }
  }
}

// Create singleton instance
const emailService = new EmailService();

module.exports = emailService;
