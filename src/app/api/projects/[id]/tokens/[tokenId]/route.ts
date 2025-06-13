import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { projects, apiTokens } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { createAuditLog } from '@/lib/audit';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; tokenId: string }> }
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

    // Get token details before deletion for audit log
    const token = await db
      .select()
      .from(apiTokens)
      .where(and(
        eq(apiTokens.id, resolvedParams.tokenId),
        eq(apiTokens.projectId, resolvedParams.id)
      ))
      .limit(1);

    if (!token[0]) {
      return NextResponse.json({ error: 'Token not found' }, { status: 404 });
    }

    // Delete the token
    await db
      .delete(apiTokens)
      .where(eq(apiTokens.id, resolvedParams.tokenId));

    // Create audit log
    await createAuditLog(
      resolvedParams.id,
      session.user.id,
      'secret_deleted' as any,
      `Deleted API token "${token[0].name}"`,
      {
        configName: token[0].name,
      }
    );

    return NextResponse.json({ message: 'Token deleted successfully' });
  } catch (error) {
    console.error('Error deleting token:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; tokenId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const { isActive, name, permissions } = await request.json();

    // Verify project ownership
    const project = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, resolvedParams.id), eq(projects.userId, session.user.id)))
      .limit(1);

    if (!project[0]) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check if token exists
    const existingToken = await db
      .select()
      .from(apiTokens)
      .where(and(
        eq(apiTokens.id, resolvedParams.tokenId),
        eq(apiTokens.projectId, resolvedParams.id)
      ))
      .limit(1);

    if (!existingToken[0]) {
      return NextResponse.json({ error: 'Token not found' }, { status: 404 });
    }

    // Update token
    const updateData: any = {};
    if (isActive !== undefined) updateData.isActive = isActive;
    if (name !== undefined) updateData.name = name;
    if (permissions !== undefined) updateData.permissions = JSON.stringify(permissions);

    const updatedToken = await db
      .update(apiTokens)
      .set(updateData)
      .where(eq(apiTokens.id, resolvedParams.tokenId))
      .returning();

    // Create audit log
    const action = isActive === false ? 'disabled' : 'updated';
    await createAuditLog(
      resolvedParams.id,
      session.user.id,
      'secret_updated' as any,
      `${action} API token "${updatedToken[0].name}"`,
      {
        configName: updatedToken[0].name,
      }
    );

    return NextResponse.json({
      ...updatedToken[0],
      permissions: JSON.parse(updatedToken[0].permissions),
    });
  } catch (error) {
    console.error('Error updating token:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}