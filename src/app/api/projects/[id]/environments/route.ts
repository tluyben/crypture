import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { projects, environments, secretConfigs } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

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
    const { name, displayName, shortcut } = await request.json();

    if (!name || !displayName || !shortcut) {
      return NextResponse.json(
        { error: 'Name, displayName, and shortcut are required' },
        { status: 400 }
      );
    }

    // Validate shortcut format
    if (!/^[a-z]{1,3}$/.test(shortcut)) {
      return NextResponse.json(
        { error: 'Shortcut must be 1-3 lowercase letters' },
        { status: 400 }
      );
    }

    // Check if project exists and belongs to user
    const project = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, resolvedParams.id), eq(projects.userId, session.user.id)))
      .limit(1);

    if (!project[0]) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check if shortcut is unique within the project
    const existingEnv = await db
      .select()
      .from(environments)
      .where(and(eq(environments.projectId, resolvedParams.id), eq(environments.shortcut, shortcut)))
      .limit(1);

    if (existingEnv[0]) {
      return NextResponse.json(
        { error: `Shortcut "${shortcut}" is already used in this project` },
        { status: 400 }
      );
    }

    // Create new environment
    const environmentId = uuidv4();
    await db.insert(environments).values({
      id: environmentId,
      name,
      displayName,
      shortcut,
      projectId: resolvedParams.id,
    });

    // Create default secret config for the new environment (using shortcut as name)
    const defaultConfigId = uuidv4();
    await db.insert(secretConfigs).values({
      id: defaultConfigId,
      name: shortcut, // Use shortcut instead of 'default'
      environmentId,
    });

    return NextResponse.json({ 
      message: 'Environment created successfully',
      environmentId,
      configId: defaultConfigId
    });
  } catch (error) {
    console.error('Error creating environment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}