import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { projects, environments, secretConfigs, secrets } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
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
    const { sourceConfigId, newConfigName, environmentId } = await request.json();

    if (!sourceConfigId || !newConfigName || !environmentId) {
      return NextResponse.json(
        { error: 'sourceConfigId, newConfigName, and environmentId are required' },
        { status: 400 }
      );
    }

    // Validate bash identifier
    const bashIdentifierRegex = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
    if (!bashIdentifierRegex.test(newConfigName)) {
      return NextResponse.json(
        { error: 'Config name must be a valid bash identifier (letters, numbers, underscores, cannot start with number)' },
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

    const sourceConfig = await db
      .select()
      .from(secretConfigs)
      .innerJoin(environments, eq(secretConfigs.environmentId, environments.id))
      .where(and(
        eq(secretConfigs.id, sourceConfigId),
        eq(environments.projectId, resolvedParams.id)
      ))
      .limit(1);

    if (!sourceConfig[0]) {
      return NextResponse.json({ error: 'Source config not found' }, { status: 404 });
    }

    const targetEnvironment = await db
      .select()
      .from(environments)
      .where(and(
        eq(environments.id, environmentId),
        eq(environments.projectId, resolvedParams.id)
      ))
      .limit(1);

    if (!targetEnvironment[0]) {
      return NextResponse.json({ error: 'Target environment not found' }, { status: 404 });
    }

    // Check if config name already exists in the environment
    const existingConfig = await db
      .select()
      .from(secretConfigs)
      .where(and(
        eq(secretConfigs.environmentId, environmentId),
        eq(secretConfigs.name, newConfigName)
      ))
      .limit(1);

    if (existingConfig[0]) {
      return NextResponse.json(
        { error: 'A config with this name already exists in the environment' },
        { status: 400 }
      );
    }

    // Create new secret config
    const newConfigId = uuidv4();
    const newConfig = await db.insert(secretConfigs).values({
      id: newConfigId,
      name: newConfigName,
      environmentId,
    }).returning();

    // Copy all secrets from source config
    const sourceSecrets = await db
      .select()
      .from(secrets)
      .where(eq(secrets.secretConfigId, sourceConfigId))
      .orderBy(secrets.order);

    for (const secret of sourceSecrets) {
      await db.insert(secrets).values({
        id: uuidv4(),
        key: secret.key,
        value: secret.value,
        type: secret.type,
        secretConfigId: newConfigId,
        order: secret.order,
      });
    }

    // Create audit log
    await createAuditLog(
      resolvedParams.id,
      session.user.id,
      'secret_created' as any, // We can extend audit actions later
      `Forked config "${sourceConfig[0].secretConfigs.name}" to "${newConfigName}" with ${sourceSecrets.length} secrets`,
      {
        sourceConfigName: sourceConfig[0].secretConfigs.name,
        newConfigName: newConfigName,
        copiedSecrets: sourceSecrets.length,
        environmentName: targetEnvironment[0].displayName,
      }
    );

    return NextResponse.json({
      message: 'Config forked successfully',
      newConfig: newConfig[0],
      newConfigId: newConfigId,
      copiedSecrets: sourceSecrets.length,
    });
  } catch (error) {
    console.error('Error forking config:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}