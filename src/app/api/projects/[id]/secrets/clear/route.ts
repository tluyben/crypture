import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { projects, environments, secretConfigs, secrets } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { createAuditLog } from '@/lib/audit';

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
    const { secretConfigId } = await request.json();

    if (!secretConfigId) {
      return NextResponse.json(
        { error: 'secretConfigId is required' },
        { status: 400 }
      );
    }

    const project = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, resolvedParams.id), eq(projects.userId, session.user.id)))
      .limit(1);

    if (!project[0]) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const secretConfig = await db
      .select()
      .from(secretConfigs)
      .innerJoin(environments, eq(secretConfigs.environmentId, environments.id))
      .where(and(
        eq(secretConfigs.id, secretConfigId),
        eq(environments.projectId, resolvedParams.id)
      ))
      .limit(1);

    if (!secretConfig[0]) {
      return NextResponse.json({ error: 'Secret config not found' }, { status: 404 });
    }

    // Get secrets count before clearing for audit log
    const existingSecrets = await db
      .select()
      .from(secrets)
      .where(eq(secrets.secretConfigId, secretConfigId));

    await db.delete(secrets).where(eq(secrets.secretConfigId, secretConfigId));

    // Create audit log
    await createAuditLog(
      resolvedParams.id,
      session.user.id,
      'secret_bulk_clear',
      `Cleared ${existingSecrets.length} secrets from ${secretConfig[0].secret_configs.name}`,
      {
        secretsCount: existingSecrets.length,
        configName: secretConfig[0].secret_configs.name,
        environmentName: secretConfig[0].environments.displayName,
      }
    );

    return NextResponse.json({ message: 'Secrets cleared successfully' });
  } catch (error) {
    console.error('Error clearing secrets:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}