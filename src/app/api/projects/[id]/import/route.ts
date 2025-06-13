import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { projects, environments, secretConfigs, secrets } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import * as yaml from 'js-yaml';
import Papa from 'papaparse';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const environmentId = formData.get('environmentId') as string;
    const secretConfigId = formData.get('secretConfigId') as string;
    const format = formData.get('format') as string || 'env';
    const overwrite = formData.get('overwrite') === 'true';

    if (!file || !environmentId || !secretConfigId) {
      return NextResponse.json(
        { error: 'File, environmentId, and secretConfigId are required' },
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

    const fileContent = await file.text();
    let parsedSecrets: Array<{ key: string; value: string; type?: string }> = [];

    try {
      switch (format) {
        case 'env':
          const envLines = fileContent.split('\n');
          parsedSecrets = envLines
            .filter(line => line.trim() && !line.startsWith('#'))
            .map(line => {
              const [key, ...valueParts] = line.split('=');
              const value = valueParts.join('=');
              return {
                key: key.trim(),
                value: value.trim().replace(/^["']|["']$/g, ''),
                type: 'text'
              };
            });
          break;

        case 'json':
          const jsonData = JSON.parse(fileContent);
          parsedSecrets = Object.entries(jsonData).map(([key, value]) => ({
            key,
            value: typeof value === 'string' ? value : JSON.stringify(value),
            type: typeof value === 'boolean' ? 'boolean' : 
                  typeof value === 'number' ? 
                    (Number.isInteger(value) ? 'integer' : 'decimal') : 
                  typeof value === 'object' ? 'json' : 'text'
          }));
          break;

        case 'yaml':
          const yamlData = yaml.load(fileContent) as Record<string, any>;
          parsedSecrets = Object.entries(yamlData).map(([key, value]) => ({
            key,
            value: typeof value === 'string' ? value : JSON.stringify(value),
            type: typeof value === 'boolean' ? 'boolean' : 
                  typeof value === 'number' ? 
                    (Number.isInteger(value) ? 'integer' : 'decimal') : 
                  typeof value === 'object' ? 'json' : 'text'
          }));
          break;

        case 'csv':
          const csvData = Papa.parse(fileContent, { header: true });
          parsedSecrets = csvData.data.map((row: any) => ({
            key: row.key,
            value: row.value,
            type: row.type || 'text'
          }));
          break;

        default:
          return NextResponse.json({ error: 'Unsupported format' }, { status: 400 });
      }
    } catch (error) {
      return NextResponse.json({ error: 'Failed to parse file' }, { status: 400 });
    }

    if (overwrite) {
      await db.delete(secrets).where(eq(secrets.secretConfigId, secretConfigId));
    }

    const existingSecrets = await db
      .select({ key: secrets.key })
      .from(secrets)
      .where(eq(secrets.secretConfigId, secretConfigId));

    const existingKeys = new Set(existingSecrets.map(s => s.key));

    let imported = 0;
    let skipped = 0;

    for (const [index, secret] of parsedSecrets.entries()) {
      if (!secret.key || secret.key === '') continue;

      if (!overwrite && existingKeys.has(secret.key)) {
        skipped++;
        continue;
      }

      try {
        await db.insert(secrets).values({
          id: uuidv4(),
          key: secret.key,
          value: secret.value,
          type: secret.type || 'text',
          secretConfigId,
          order: index,
        });
        imported++;
      } catch (error) {
        console.error(`Failed to import secret ${secret.key}:`, error);
      }
    }

    return NextResponse.json({
      message: 'Import completed',
      imported,
      skipped,
      total: parsedSecrets.length,
    });
  } catch (error) {
    console.error('Error importing secrets:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}