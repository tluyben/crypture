import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

const SECRET = process.env.EMAIL_VERIFICATION_SECRET || 'fallback-secret';

export interface EmailVerificationPayload {
  email: string;
  userId: string;
  type: 'verification' | 'password_reset';
}

export const generateVerificationToken = (payload: EmailVerificationPayload): string => {
  return jwt.sign(
    { ...payload, jti: uuidv4() },
    SECRET,
    { expiresIn: '24h' }
  );
};

export const verifyEmailToken = (token: string): EmailVerificationPayload | null => {
  try {
    const decoded = jwt.verify(token, SECRET) as EmailVerificationPayload & { jti: string };
    return {
      email: decoded.email,
      userId: decoded.userId,
      type: decoded.type,
    };
  } catch (error) {
    console.error('Failed to verify email token:', error);
    return null;
  }
};