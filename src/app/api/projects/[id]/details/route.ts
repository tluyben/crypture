import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { projects, environments, secretConfigs, secrets } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

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

    const project = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, resolvedParams.id), eq(projects.userId, session.user.id)))
      .limit(1);

    if (!project[0]) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const projectEnvironments = await db
      .select()
      .from(environments)
      .where(eq(environments.projectId, resolvedParams.id))
      .orderBy(environments.order);

    const environmentsWithSecrets = await Promise.all(
      projectEnvironments.map(async (env) => {
        const configs = await db
          .select()
          .from(secretConfigs)
          .where(eq(secretConfigs.environmentId, env.id));

        const configsWithSecrets = await Promise.all(
          configs.map(async (config) => {
            const configSecrets = await db
              .select()
              .from(secrets)
              .where(eq(secrets.secretConfigId, config.id))
              .orderBy(secrets.order);

            return {
              ...config,
              secrets: configSecrets,
            };
          })
        );

        return {
          ...env,
          secretConfigs: configsWithSecrets,
        };
      })
    );

    return NextResponse.json({
      ...project[0],
      environments: environmentsWithSecrets,
    });
  } catch (error) {
    console.error('Error fetching project details:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}