/**
 * Diagnose "Failed to send verification email".
 *
 * That message is a generic catch-all thrown by emailService.sendOTPEmail, so
 * it hides the real cause. This walks the same path step by step and prints the
 * actual SMTP error.
 *
 * Usage:
 *   node server/scripts/testEmail.js                 # sends to SMTP_USER
 *   node server/scripts/testEmail.js you@gmail.com   # sends to a real inbox
 *
 * Run it on the SERVER, not just locally - the usual cause of this working in
 * development and failing in production is the host's outbound network, not the
 * code. AWS blocks outbound port 25 on EC2 by default, and some providers
 * throttle or block SMTP from datacenter IP ranges entirely.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const net = require('net');

const recipient = process.argv[2] || process.env.SMTP_USER;

function step(label) {
    process.stdout.write(`\n▶ ${label}\n`);
}

async function main() {
    step('1. Environment');
    const required = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'];
    let missing = false;
    for (const key of required) {
        const value = process.env[key];
        const shown = key === 'SMTP_PASS' ? (value ? '*** set ***' : undefined) : value;
        console.log(`   ${key.padEnd(16)} ${shown || '!! MISSING !!'}`);
        if (!value) missing = true;
    }
    console.log(`   ${'EMAIL_DISABLE'.padEnd(16)} ${process.env.EMAIL_DISABLE || '(not set)'}`);

    if (process.env.EMAIL_DISABLE === 'true') {
        console.log('\n   EMAIL_DISABLE=true - all mail is mocked. That alone explains no emails arriving.');
        return;
    }
    if (missing) {
        console.log('\n   Stop: SMTP settings are incomplete in server/.env');
        return;
    }

    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || '587', 10);

    step(`2. Raw TCP reachability to ${host}:${port}`);
    // Done before nodemailer so a blocked egress port is reported plainly
    // instead of surfacing as a vague timeout later.
    const reachable = await new Promise(resolve => {
        const socket = net.createConnection({ host, port, timeout: 12000 });
        socket.on('connect', () => { socket.destroy(); resolve(true); });
        socket.on('timeout', () => { socket.destroy(); resolve(false); });
        socket.on('error', () => resolve(false));
    });

    if (!reachable) {
        console.log('   BLOCKED - could not open a TCP connection.');
        console.log('   This is a network problem, not a code problem. Check:');
        console.log('     - the EC2 security group allows OUTBOUND traffic on this port');
        console.log('     - any host firewall (ufw) allows it');
        console.log('     - your provider is not blocking SMTP from this IP range');
        return;
    }
    console.log('   OK - port is open from this host.');

    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        tls: { rejectUnauthorized: false },
        connectionTimeout: 20000
    });

    step('3. SMTP authentication');
    try {
        await transporter.verify();
        console.log('   OK - credentials accepted.');
    } catch (err) {
        console.log('   FAILED');
        console.log(`   code=${err.code} responseCode=${err.responseCode}`);
        console.log(`   response=${err.response}`);
        console.log(`   message=${err.message}`);
        console.log('\n   535 usually means the password is wrong. For Zoho with 2FA you need');
        console.log('   an app-specific password, not the account password.');
        return;
    }

    step(`4. Sending a real message to ${recipient}`);
    try {
        const info = await transporter.sendMail({
            from: `"${process.env.SMTP_FROM_NAME || 'Fira'}" <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER}>`,
            to: recipient,
            subject: 'FIRA email diagnostic',
            text: 'If you are reading this, outbound email from this server works.'
        });
        console.log('   SENT');
        console.log(`   messageId: ${info.messageId}`);
        console.log(`   accepted:  ${JSON.stringify(info.accepted)}`);
        console.log(`   rejected:  ${JSON.stringify(info.rejected)}`);
        console.log(`   response:  ${info.response}`);
        console.log('\n   If this says SENT but nothing arrives, the mail is being accepted and');
        console.log('   then dropped or spam-filtered downstream - check the recipient spam');
        console.log('   folder and your Zoho sent-items / suppression list.');
    } catch (err) {
        console.log('   FAILED');
        console.log(`   code=${err.code} responseCode=${err.responseCode}`);
        console.log(`   response=${err.response}`);
        console.log(`   message=${err.message}`);
        if (String(err.response || '').match(/limit|quota|exceed/i)) {
            console.log('\n   Looks like a sending quota. Zoho caps daily volume per plan, and the');
            console.log('   48 bot signups on this account each triggered an OTP email.');
        }
    }
}

main()
    .catch(err => console.error('\nDiagnostic crashed:', err.message))
    .finally(() => process.exit(0));
