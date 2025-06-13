import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { projects, environments, secretConfigs, secrets } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import * as yaml from 'js-yaml';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'env';
    const environmentId = searchParams.get('environmentId');
    const secretConfigId = searchParams.get('secretConfigId');

    if (!environmentId || !secretConfigId) {
      return NextResponse.json(
        { error: 'environmentId and secretConfigId are required' },
        { status: 400 }
      );
    }

    const project = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, params.id), eq(projects.userId, session.user.id)))
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
        eq(environments.id, environmentId),
        eq(environments.projectId, params.id)
      ))
      .limit(1);

    if (!secretConfig[0]) {
      return NextResponse.json({ error: 'Secret config not found' }, { status: 404 });
    }

    const configSecrets = await db
      .select()
      .from(secrets)
      .where(eq(secrets.secretConfigId, secretConfigId))
      .orderBy(secrets.order);

    let content: string;
    let contentType: string;
    let filename: string;

    const secretsData: Record<string, any> = {};
    configSecrets.forEach(secret => {
      let value = secret.value;
      
      if (secret.type === 'boolean') {
        value = secret.value.toLowerCase() === 'true';
      } else if (secret.type === 'integer') {
        value = parseInt(secret.value);
      } else if (secret.type === 'decimal') {
        value = parseFloat(secret.value);
      } else if (secret.type === 'json') {
        try {
          value = JSON.parse(secret.value);
        } catch (e) {
          value = secret.value;
        }
      }
      
      secretsData[secret.key] = value;
    });

    switch (format) {
      case 'env':
        content = configSecrets
          .map(secret => `${secret.key}=${secret.value}`)
          .join('\n');
        contentType = 'text/plain';
        filename = `${secretConfig[0].secretConfigs.name}.env`;
        break;
      
      case 'json':
        content = JSON.stringify(secretsData, null, 2);
        contentType = 'application/json';
        filename = `${secretConfig[0].secretConfigs.name}.json`;
        break;
      
      case 'yaml':
        content = yaml.dump(secretsData);
        contentType = 'text/yaml';
        filename = `${secretConfig[0].secretConfigs.name}.yaml`;
        break;
      
      case 'csv':
        const headers = 'key,value,type\n';
        const rows = configSecrets
          .map(secret => `"${secret.key}","${secret.value}","${secret.type}"`)
          .join('\n');
        content = headers + rows;
        contentType = 'text/csv';
        filename = `${secretConfig[0].secretConfigs.name}.csv`;
        break;
      
      default:
        return NextResponse.json({ error: 'Unsupported format' }, { status: 400 });
    }

    return new NextResponse(content, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Error exporting secrets:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}