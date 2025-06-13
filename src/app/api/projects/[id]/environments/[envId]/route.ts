import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { projects, environments, secretConfigs, secrets } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; envId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;

    // Check if project exists and belongs to user
    const project = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, resolvedParams.id), eq(projects.userId, session.user.id)))
      .limit(1);

    if (!project[0]) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check if environment exists and belongs to the project
    const environment = await db
      .select()
      .from(environments)
      .where(and(eq(environments.id, resolvedParams.envId), eq(environments.projectId, resolvedParams.id)))
      .limit(1);

    if (!environment[0]) {
      return NextResponse.json({ error: 'Environment not found' }, { status: 404 });
    }

    // Get all secret configs for this environment
    const configs = await db
      .select()
      .from(secretConfigs)
      .where(eq(secretConfigs.environmentId, resolvedParams.envId));

    // Delete all secrets for all configs in this environment
    for (const config of configs) {
      await db.delete(secrets).where(eq(secrets.secretConfigId, config.id));
    }

    // Delete all secret configs for this environment
    await db.delete(secretConfigs).where(eq(secretConfigs.environmentId, resolvedParams.envId));

    // Delete the environment
    await db.delete(environments).where(eq(environments.id, resolvedParams.envId));

    return NextResponse.json({ message: 'Environment deleted successfully' });
  } catch (error) {
    console.error('Error deleting environment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}