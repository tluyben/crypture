import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { projects, apiTokens } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { createAuditLog } from '@/lib/audit';
import crypto from 'crypto';

// Generate a secure API token
function generateApiToken(): string {
  const prefix = 'crypt_';
  const randomBytes = crypto.randomBytes(32);
  const token = randomBytes.toString('base64url');
  return prefix + token;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;

    // Verify project ownership
    const project = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, resolvedParams.id), eq(projects.userId, session.user.id)))
      .limit(1);

    if (!project[0]) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get tokens for this project (without exposing the actual token value)
    const tokens = await db
      .select({
        id: apiTokens.id,
        name: apiTokens.name,
        permissions: apiTokens.permissions,
        isActive: apiTokens.isActive,
        lastUsed: apiTokens.lastUsed,
        expiresAt: apiTokens.expiresAt,
        createdAt: apiTokens.createdAt,
      })
      .from(apiTokens)
      .where(eq(apiTokens.projectId, resolvedParams.id))
      .orderBy(apiTokens.createdAt);

    return NextResponse.json(tokens);
  } catch (error) {
    console.error('Error fetching tokens:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const { name, permissions, expiresAt } = await request.json();

    if (!name || !permissions) {
      return NextResponse.json(
        { error: 'Name and permissions are required' },
        { status: 400 }
      );
    }

    // Verify project ownership
    const project = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, resolvedParams.id), eq(projects.userId, session.user.id)))
      .limit(1);

    if (!project[0]) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Generate new token
    const tokenValue = generateApiToken();
    const tokenId = uuidv4();

    // Create token record
    const newToken = await db.insert(apiTokens).values({
      id: tokenId,
      userId: session.user.id,
      projectId: resolvedParams.id,
      name,
      token: tokenValue, // In production, this should be hashed
      permissions: JSON.stringify(permissions),
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      createdAt: new Date(),
      isActive: true,
    }).returning();

    // Create audit log
    await createAuditLog(
      resolvedParams.id,
      session.user.id,
      'secret_created' as any, // We can extend audit actions later
      `Created API token "${name}"`,
      {
        configName: name,
      }
    );

    // Return token details including the actual token value (only shown once)
    return NextResponse.json({
      ...newToken[0],
      token: tokenValue, // Only returned on creation
      permissions: JSON.parse(newToken[0].permissions),
    });
  } catch (error) {
    console.error('Error creating token:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}