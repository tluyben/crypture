import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { eq } from 'drizzle-orm';
import { sendVerificationEmail } from '@/lib/email';
import { generateVerificationToken } from '@/lib/email-verification';

export async function POST(request: NextRequest) {
  try {
    const { email, password, name } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const existingUser = await db.select().from(users).where(eq(users.email, email)).limit(1);
    
    if (existingUser.length > 0) {
      return NextResponse.json(
        { error: 'User already exists' },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const userId = uuidv4();
    
    const newUser = await db.insert(users).values({
      id: userId,
      email,
      password: hashedPassword,
      name: name || null,
      emailVerified: null, // Not verified yet
    }).returning();

    // Generate verification token and send email
    const verificationToken = generateVerificationToken({
      email,
      userId,
      type: 'verification',
    });

    try {
      await sendVerificationEmail(email, verificationToken, name);
    } catch (error) {
      console.error('Failed to send verification email:', error);
      // Don't fail registration if email fails
    }

    return NextResponse.json({
      message: 'User created successfully. Please check your email to verify your account.',
      user: {
        id: newUser[0].id,
        email: newUser[0].email,
        name: newUser[0].name,
        emailVerified: false,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}