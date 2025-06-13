import { NextAuthOptions } from 'next-auth';
import { db } from '@/lib/db';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import GitHubProvider from 'next-auth/providers/github';
import AppleProvider from 'next-auth/providers/apple';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { sendWelcomeEmail } from '@/lib/email';

export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/auth/signin',
    signUp: '/auth/signup',
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await db.select().from(users).where(eq(users.email, credentials.email)).limit(1);
        
        if (!user[0] || !user[0].password) {
          return null;
        }

        // Check if email is verified for password-based login
        if (!user[0].emailVerified) {
          throw new Error('Please verify your email address before signing in.');
        }

        const isPasswordValid = await bcrypt.compare(credentials.password, user[0].password);
        
        if (!isPasswordValid) {
          return null;
        }

        return {
          id: user[0].id,
          email: user[0].email,
          name: user[0].name,
          image: user[0].image,
        };
      },
    }),
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET ? [
      GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      })
    ] : []),
    ...(process.env.GITHUB_ID && process.env.GITHUB_SECRET ? [
      GitHubProvider({
        clientId: process.env.GITHUB_ID,
        clientSecret: process.env.GITHUB_SECRET,
      })
    ] : []),
    ...(process.env.APPLE_ID && process.env.APPLE_SECRET ? [
      AppleProvider({
        clientId: process.env.APPLE_ID,
        clientSecret: process.env.APPLE_SECRET,
      })
    ] : []),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      // For OAuth providers, handle user creation and welcome email
      if (account?.provider !== 'credentials' && user.email) {
        try {
          // Check if user exists
          const existingUser = await db.select().from(users).where(eq(users.email, user.email)).limit(1);
          
          if (!existingUser[0]) {
            // Create new user for OAuth signup
            const userId = uuidv4();
            await db.insert(users).values({
              id: userId,
              email: user.email,
              name: user.name || null,
              image: user.image || null,
              emailVerified: new Date(), // OAuth users are pre-verified
            });
            
            // Send welcome email for new OAuth users
            try {
              await sendWelcomeEmail(user.email, user.name || undefined);
            } catch (error) {
              console.error('Failed to send welcome email to OAuth user:', error);
            }
          }
        } catch (error) {
          console.error('Error handling OAuth signup:', error);
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
};