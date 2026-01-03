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
}

// Create singleton instance
const emailService = new EmailService();

module.exports = emailService;
