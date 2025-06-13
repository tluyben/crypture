import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { projects, secrets, secretConfigs, environments } from '@/lib/db/schema';
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
    const { key, value, type, secretConfigId } = await request.json();

    if (!key || !value || !secretConfigId) {
      return NextResponse.json(
        { error: 'Key, value, and secretConfigId are required' },
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

    // Check if key already exists in this config
    const existingSecret = await db
      .select()
      .from(secrets)
      .where(and(
        eq(secrets.secretConfigId, secretConfigId),
        eq(secrets.key, key)
      ))
      .limit(1);

    if (existingSecret[0]) {
      return NextResponse.json(
        { error: `Secret with key "${key}" already exists in this configuration` },
        { status: 400 }
      );
    }

    const maxOrder = await db
      .select({ order: secrets.order })
      .from(secrets)
      .where(eq(secrets.secretConfigId, secretConfigId))
      .orderBy(secrets.order)
      .limit(1);

    const newSecret = await db.insert(secrets).values({
      id: uuidv4(),
      key,
      value,
      type: type || 'text',
      secretConfigId,
      order: (maxOrder[0]?.order || 0) + 1,
    }).returning();

    // Create audit log
    await createAuditLog(
      resolvedParams.id,
      session.user.id,
      'secret_created',
      `Created secret "${key}" in ${secretConfig[0].secretConfigs.name}`,
      {
        secretKey: key,
        newValue: value,
        secretType: type || 'text',
        configName: secretConfig[0].secretConfigs.name,
        environmentName: secretConfig[0].environments.displayName,
      }
    );

    return NextResponse.json(newSecret[0]);
  } catch (error) {
    console.error('Error creating secret:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}