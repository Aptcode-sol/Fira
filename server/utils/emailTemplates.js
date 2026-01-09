/**
 * Email Templates for FIRA
 * Branded email templates with black dominant theme
 */

const emailTemplates = {
  /**
   * OTP Verification Email Template
   * @param {string} name - User's name
   * @param {string} otp - 4-digit OTP code
   * @returns {string} - HTML email template
   */
  otpVerification(name, otp) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Email - FIRA</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: #000000;
      color: #ffffff;
      line-height: 1.6;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%);
      border-radius: 16px;
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
      padding: 40px 30px;
      text-align: center;
      position: relative;
      overflow: hidden;
    }
    .header::before {
      content: '';
      position: absolute;
      top: -50%;
      left: -50%;
      width: 200%;
      height: 200%;
      background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
      animation: pulse 3s ease-in-out infinite;
    }
    @keyframes pulse {
      0%, 100% { transform: scale(1); opacity: 0.5; }
      50% { transform: scale(1.1); opacity: 0.8; }
    }
    .logo {
      font-size: 32px;
      font-weight: bold;
      color: #ffffff;
      position: relative;
      z-index: 1;
      letter-spacing: 2px;
    }
    .tagline {
      font-size: 14px;
      color: rgba(255, 255, 255, 0.9);
      margin-top: 8px;
      position: relative;
      z-index: 1;
    }
    .content {
      padding: 40px 30px;
    }
    .greeting {
      font-size: 24px;
      font-weight: 600;
      color: #ffffff;
      margin-bottom: 20px;
    }
    .message {
      font-size: 16px;
      color: #a0a0a0;
      margin-bottom: 30px;
      line-height: 1.8;
    }
    .otp-container {
      background: rgba(139, 92, 246, 0.1);
      border: 2px solid rgba(139, 92, 246, 0.3);
      border-radius: 12px;
      padding: 30px;
      text-align: center;
      margin: 30px 0;
    }
    .otp-label {
      font-size: 14px;
      color: #a0a0a0;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 15px;
    }
    .otp-code {
      font-size: 48px;
      font-weight: bold;
      color: #8b5cf6;
      letter-spacing: 12px;
      font-family: 'Courier New', monospace;
      text-align: center;
      margin: 10px 0;
    }
    .expiry-notice {
      font-size: 14px;
      color: #ef4444;
      margin-top: 15px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    .warning-icon {
      width: 16px;
      height: 16px;
    }
    .info-box {
      background: rgba(99, 102, 241, 0.1);
      border-left: 4px solid #6366f1;
      padding: 20px;
      margin: 25px 0;
      border-radius: 8px;
    }
    .info-box p {
      font-size: 14px;
      color: #c0c0c0;
      margin: 8px 0;
    }
    .footer {
      background: #0a0a0a;
      padding: 30px;
      text-align: center;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
    }
    .footer-text {
      font-size: 13px;
      color: #666666;
      margin: 5px 0;
    }
    .footer-link {
      color: #8b5cf6;
      text-decoration: none;
    }
    .footer-link:hover {
      text-decoration: underline;
    }
    .social-links {
      margin-top: 20px;
    }
    .social-links a {
      display: inline-block;
      margin: 0 10px;
      color: #8b5cf6;
      text-decoration: none;
      font-size: 12px;
    }
    @media only screen and (max-width: 600px) {
      .container {
        border-radius: 0;
      }
      .content {
        padding: 30px 20px;
      }
      .otp-code {
        font-size: 36px;
        letter-spacing: 8px;
      }
    }
  </style>
</head>
<body>
  <div style="padding: 20px; background-color: #000000;">
    <div class="container">
      <!-- Header -->
      <div class="header">
        <div class="logo">FIRA</div>
        <div class="tagline">Let's Celebrate</div>
      </div>

      <!-- Content -->
      <div class="content">
        <div class="greeting">Hey ${name}! 👋</div>
        
        <div class="message">
          Welcome to FIRA! We're excited to have you join our community of event enthusiasts and venue owners.
          <br><br>
          To complete your registration and start exploring amazing venues and events, please verify your email address using the code below:
        </div>

        <!-- OTP Box -->
        <div class="otp-container">
          <div class="otp-label">Your Verification Code</div>
          <div class="otp-code">${otp}</div>
          <div class="expiry-notice">
            <svg class="warning-icon" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
            </svg>
            This code expires in 10 minutes
          </div>
        </div>

        <!-- Info Box -->
        <div class="info-box">
          <p><strong>🔒 Security Tips:</strong></p>
          <p>• Never share this code with anyone</p>
          <p>• FIRA will never ask for your code via phone or email</p>
          <p>• If you didn't request this code, please ignore this email</p>
        </div>

        <div class="message">
          Once verified, you'll be able to:
          <br>
          ✨ Discover and book amazing venues<br>
          🎉 Browse upcoming events<br>
          🎫 Purchase tickets seamlessly<br>
          ${name.includes('venue') || name.includes('owner') ? '🏢 List and manage your venues<br>' : ''}
        </div>
      </div>

      <!-- Footer -->
      <div class="footer">
        <p class="footer-text">
          Need help? Contact us at <a href="mailto:support@fira.com" class="footer-link">support@fira.com</a>
        </p>
        <p class="footer-text" style="margin-top: 15px;">
          © ${new Date().getFullYear()} FIRA - Let's Celebrate. All rights reserved.
        </p>
        <div class="social-links">
          <a href="#">Instagram</a> • 
          <a href="#">Twitter</a> • 
          <a href="#">Facebook</a>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
    `.trim();
  },

  /**
   * Welcome Email Template (sent after successful verification)
   * @param {string} name - User's name
   * @param {string} role - User's role (user or venue_owner)
   * @returns {string} - HTML email template
   */
  welcome(name, role) {
    const isVenueOwner = role === 'venue_owner';

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to FIRA</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #000000;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%); padding: 40px; text-align: center; border-radius: 16px 16px 0 0;">
      <h1 style="color: #ffffff; font-size: 32px; margin: 0;">Welcome to FIRA! 🎉</h1>
      <p style="color: rgba(255,255,255,0.9); margin-top: 10px;">Let's Celebrate</p>
    </div>
    
    <div style="background: #1a1a1a; padding: 40px; border-radius: 0 0 16px 16px;">
      <p style="color: #ffffff; font-size: 18px; margin-bottom: 20px;">Hey ${name}!</p>
      
      <p style="color: #a0a0a0; line-height: 1.8; margin-bottom: 20px;">
        Your email has been successfully verified! You're now part of the FIRA community.
      </p>
      
      ${isVenueOwner ? `
      <p style="color: #a0a0a0; line-height: 1.8; margin-bottom: 20px;">
        As a venue owner, you can now start listing your spaces and connecting with event organizers.
      </p>
      ` : `
      <p style="color: #a0a0a0; line-height: 1.8; margin-bottom: 20px;">
        Start exploring amazing venues and events in your area!
      </p>
      `}
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/dashboard" 
           style="display: inline-block; background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%); color: #ffffff; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: 600;">
          Go to Dashboard
        </a>
      </div>
      
      <p style="color: #666666; font-size: 13px; text-align: center; margin-top: 30px;">
        © ${new Date().getFullYear()} FIRA. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>
    `.trim();
  },

  /**
   * Ticket Confirmation Email Template
   * @param {string} userName - User's name
   * @param {object} event - Event details (name, date, time, venue)
   * @param {object} ticket - Ticket details (ticketId, qrCode, quantity, price)
   * @returns {string} - HTML email template
   */
  ticketConfirmation(userName, event, ticket) {
    const isPaid = ticket.price > 0;
    const formattedDate = new Date(event.date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Ticket for ${event.name} - FIRA</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #000000; color: #ffffff;">
  <div style="max-width: 600px; margin: 0 auto; background: #0a0a0a; border-radius: 16px; overflow: hidden;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%); padding: 30px; text-align: center;">
      <h1 style="margin: 0; font-size: 28px; letter-spacing: 2px;">FIRA</h1>
      <p style="margin: 5px 0 0; opacity: 0.9; font-size: 14px;">Let's Celebrate</p>
    </div>

    <!-- Content -->
    <div style="padding: 30px;">
      <h2 style="margin: 0 0 20px; font-size: 24px; text-align: center;">You're Going! 🎉</h2>
      <p style="color: #a0a0a0; text-align: center; margin-bottom: 30px;">
        Hey ${userName}, your booking is confirmed. Get ready for an amazing experience!
      </p>

      <!-- Event Card -->
      <div style="background: #1a1a1a; border-radius: 12px; border: 1px solid #333; overflow: hidden; margin-bottom: 30px;">
        ${event.images && event.images[0] ? `<img src="${event.images[0]}" alt="${event.name}" style="width: 100%; height: 200px; object-fit: cover; display: block;">` : ''}
        <div style="padding: 20px;">
          <h3 style="margin: 0 0 10px; font-size: 20px; color: #fff;">${event.name}</h3>
          
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 5px 0; color: #888; font-size: 14px;">Date</td>
              <td style="padding: 5px 0; color: #fff; text-align: right; font-size: 14px;">${formattedDate}</td>
            </tr>
            <tr>
              <td style="padding: 5px 0; color: #888; font-size: 14px;">Time</td>
              <td style="padding: 5px 0; color: #fff; text-align: right; font-size: 14px;">${event.startTime}</td>
            </tr>
            <tr>
              <td style="padding: 5px 0; color: #888; font-size: 14px;">Venue</td>
              <td style="padding: 5px 0; color: #fff; text-align: right; font-size: 14px;">${event.venue.name}</td>
            </tr>
          </table>
        </div>
      </div>

      <!-- Ticket Details -->
      <div style="background: #ffffff; border-radius: 12px; color: #000; padding: 20px; text-align: center; margin-bottom: 30px;">
        <div style="font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 1px;">Ticket ID</div>
        <div style="font-family: monospace; font-size: 18px; font-weight: bold; margin: 5px 0 15px;">${ticket.ticketId}</div>
        
        <!-- QR Code Placeholder (Standard QRCode generated via backend is usually attached as CID or simple img tag if public) -->
        <!-- Ideally we attach the QR code as an image with CID. For now, assuming provided qrCode is a data url or we use text fallback if complex -->
        <img src="${ticket.qrCode}" alt="Ticket QR Code" style="width: 180px; height: 180px; display: block; margin: 0 auto;">
        
        <div style="margin-top: 15px; font-size: 14px; color: #666;">
          Scan this code at the entrance
        </div>
        
        <div style="margin-top: 20px; padding-top: 20px; border-top: 1px dashed #ccc; display: flex; justify-content: space-between;">
           <div style="text-align: left;">
              <div style="font-size: 12px; color: #666;">Type</div>
              <div style="font-weight: bold; text-transform: capitalize;">${ticket.ticketType}</div>
           </div>
           <div style="text-align: right;">
              <div style="font-size: 12px; color: #666;">Admit</div>
              <div style="font-weight: bold;">${ticket.quantity} Person(s)</div>
           </div>
        </div>
      </div>

      <p style="text-align: center; color: #666; font-size: 13px;">
        Please save this email or download your ticket from the dashboard.
      </p>

      <div style="text-align: center; margin-top: 30px;">
        <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/dashboard" 
           style="display: inline-block; background: #8b5cf6; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;">
           View in Dashboard
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="background: #000; padding: 20px; text-align: center; border-top: 1px solid #222;">
      <p style="color: #444; font-size: 12px; margin: 0;">© ${new Date().getFullYear()} FIRA. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `.trim();
  },

  /**
   * Ticket Confirmation Email Template
   */
  ticketConfirmation(userName, event, ticket) {
    const isPaid = ticket.price > 0;
    const formattedDate = new Date(event.date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Ticket for ${event.name} - FIRA</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #000000; color: #ffffff;">
  <div style="max-width: 600px; margin: 0 auto; background: #0a0a0a; border-radius: 16px; overflow: hidden;">
    <div style="background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%); padding: 30px; text-align: center;">
      <h1 style="margin: 0; font-size: 28px; letter-spacing: 2px;">FIRA</h1>
      <p style="margin: 5px 0 0; opacity: 0.9; font-size: 14px;">Let's Celebrate</p>
    </div>
    <div style="padding: 30px;">
      <h2 style="margin: 0 0 20px; font-size: 24px; text-align: center;">You're Going! 🎉</h2>
      <p style="color: #a0a0a0; text-align: center; margin-bottom: 30px;">
        Hey ${userName}, your booking is confirmed.
      </p>
      <div style="background: #1a1a1a; border-radius: 12px; border: 1px solid #333; overflow: hidden; margin-bottom: 30px;">
        ${event.images?.[0] ? `<img src="${event.images[0]}" alt="${event.name}" style="width: 100%; height: 200px; object-fit: cover; display: block;">` : ''}
        <div style="padding: 20px;">
          <h3 style="margin: 0 0 10px; font-size: 20px; color: #fff;">${event.name}</h3>
          <p style="color: #ccc; margin: 5px 0;">${formattedDate} • ${event.startTime}</p>
          <p style="color: #888; font-size: 14px;">${event.venue.name}</p>
        </div>
      </div>
      <div style="background: #ffffff; border-radius: 12px; color: #000; padding: 20px; text-align: center; margin-bottom: 30px;">
        <div style="font-size: 12px; color: #666; text-transform: uppercase;">Ticket ID</div>
        <div style="font-family: monospace; font-size: 18px; font-weight: bold; margin: 5px 0 15px;">${ticket.ticketId}</div>
        <img src="${ticket.qrCode}" alt="QR Code" style="width: 180px; height: 180px; display: block; margin: 0 auto;">
        <div style="margin-top: 15px; font-size: 14px; color: #666;">Admit ${ticket.quantity} • ${ticket.ticketType}</div>
      </div>
    </div>
  </div>
</body>
</html>
    `.trim();
  }
};

module.exports = emailTemplates;
