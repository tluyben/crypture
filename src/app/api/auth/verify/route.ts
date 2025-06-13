import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { verifyEmailToken } from '@/lib/email-verification';
import { sendWelcomeEmail } from '@/lib/email';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'Verification token is required' },
        { status: 400 }
      );
    }

    // Verify the token
    const payload = verifyEmailToken(token);
    if (!payload || payload.type !== 'verification') {
      return NextResponse.json(
        { error: 'Invalid or expired verification token' },
        { status: 400 }
      );
    }

    // Find the user
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, payload.userId))
      .limit(1);

    if (!user[0]) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    if (user[0].email !== payload.email) {
      return NextResponse.json(
        { error: 'Email mismatch' },
        { status: 400 }
      );
    }

    // Check if already verified
    if (user[0].emailVerified) {
      return NextResponse.json({
        message: 'Email already verified',
        success: true,
      });
    }

    // Update user as verified
    const now = new Date();
    await db
      .update(users)
      .set({
        emailVerified: now,
        updatedAt: now,
      })
      .where(eq(users.id, payload.userId));

    // Send welcome email
    try {
      await sendWelcomeEmail(user[0].email, user[0].name);
    } catch (error) {
      console.error('Failed to send welcome email:', error);
      // Don't fail verification if welcome email fails
    }

    // Return success response
    return NextResponse.json({
      message: 'Email verified successfully! You can now sign in.',
      success: true,
    });
  } catch (error) {
    console.error('Email verification error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}