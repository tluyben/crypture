import nodemailer from 'nodemailer';
import { render } from '@react-email/render';
import { VerificationEmail } from '@/emails/verification-email';
import { WelcomeEmail } from '@/emails/welcome-email';

// Create transporter
const createTransporter = () => {
  if (!process.env.SMTP_HOST || !process.env.SMTP_PORT) {
    console.warn('SMTP configuration not found. Email functionality will be disabled.');
    return null;
  }

  // Check if we have credentials
  if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
    console.warn('SMTP credentials not configured. Running in development mode - emails will be logged but not sent.');
    return null;
  }

  try {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT!),
      secure: parseInt(process.env.SMTP_PORT!) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  } catch (error) {
    console.error('Failed to create email transporter:', error);
    return null;
  }
};

export const sendVerificationEmail = async (
  email: string,
  verificationToken: string,
  userName?: string
) => {
  const transporter = createTransporter();
  if (!transporter) {
    const verificationUrl = `${process.env.NEXTAUTH_URL}/auth/verify?token=${verificationToken}`;
    console.log('\n=== DEVELOPMENT MODE: Email would be sent ===');
    console.log('To:', email);
    console.log('Subject: Verify your Crypture account');
    console.log('Verification URL:', verificationUrl);
    console.log('===== Copy this URL to verify your email =====\n');
    return true; // Return true for development without SMTP
  }

  const verificationUrl = `${process.env.NEXTAUTH_URL}/auth/verify?token=${verificationToken}`;
  
  const emailHtml = await render(VerificationEmail({
    userEmail: email,
    verificationUrl,
    userName,
  }));

  try {
    await transporter.sendMail({
      from: `${process.env.SMTP_FROM_NAME || 'Crypture'} <${process.env.SMTP_FROM || 'noreply@crypture.dev'}>`,
      to: email,
      subject: 'Verify your Crypture account',
      html: emailHtml,
    });
    console.log('Verification email sent to:', email);
    return true;
  } catch (error) {
    console.error('Failed to send verification email:', error);
    return false;
  }
};

export const sendWelcomeEmail = async (
  email: string,
  userName?: string
) => {
  const transporter = createTransporter();
  if (!transporter) {
    console.log('\n=== DEVELOPMENT MODE: Welcome email would be sent ===');
    console.log('To:', email);
    console.log('Subject: Welcome to Crypture!');
    console.log('Dashboard URL:', `${process.env.NEXTAUTH_URL}/dashboard`);
    console.log('==============================================\n');
    return true; // Return true for development without SMTP
  }

  const dashboardUrl = `${process.env.NEXTAUTH_URL}/dashboard`;
  
  const emailHtml = await render(WelcomeEmail({
    userEmail: email,
    userName,
    dashboardUrl,
  }));

  try {
    await transporter.sendMail({
      from: `${process.env.SMTP_FROM_NAME || 'Crypture'} <${process.env.SMTP_FROM || 'noreply@crypture.dev'}>`,
      to: email,
      subject: 'Welcome to Crypture!',
      html: emailHtml,
    });
    console.log('Welcome email sent to:', email);
    return true;
  } catch (error) {
    console.error('Failed to send welcome email:', error);
    return false;
  }
};