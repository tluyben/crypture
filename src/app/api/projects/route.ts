import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { projects, environments, secretConfigs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userProjects = await db
      .select()
      .from(projects)
      .where(eq(projects.userId, session.user.id));

    return NextResponse.json(userProjects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, description, icon } = await request.json();

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const projectId = uuidv4();
    
    const newProject = await db.insert(projects).values({
      id: projectId,
      name,
      description: description || null,
      icon: icon || null,
      userId: session.user.id,
    }).returning();

    const defaultEnvironments = [
      { name: 'dev', displayName: 'Development', order: 0 },
      { name: 'stg', displayName: 'Staging', order: 1 },
      { name: 'prd', displayName: 'Production', order: 2 },
    ];

    for (const env of defaultEnvironments) {
      const environmentId = uuidv4();
      await db.insert(environments).values({
        id: environmentId,
        name: env.name,
        displayName: env.displayName,
        projectId,
        order: env.order,
      });

      await db.insert(secretConfigs).values({
        id: uuidv4(),
        name: env.name,
        environmentId,
      });
    }

    return NextResponse.json(newProject[0]);
  } catch (error) {
    console.error('Error creating project:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}