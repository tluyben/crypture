import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { apiTokens, projects, environments, secretConfigs, secrets } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

// Helper function to validate API token
async function validateToken(authHeader: string | null) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  
  const tokenRecord = await db
    .select()
    .from(apiTokens)
    .innerJoin(projects, eq(apiTokens.projectId, projects.id))
    .where(and(
      eq(apiTokens.token, token),
      eq(apiTokens.isActive, true)
    ))
    .limit(1);

  if (!tokenRecord[0]) {
    return null;
  }

  const { api_tokens: apiToken, projects: project } = tokenRecord[0];

  // Check if token is expired
  if (apiToken.expiresAt && apiToken.expiresAt < new Date().getTime()) {
    return null;
  }

  // Update last used timestamp
  await db
    .update(apiTokens)
    .set({ lastUsed: new Date().getTime() })
    .where(eq(apiTokens.id, apiToken.id));

  return {
    token: apiToken,
    project,
    permissions: JSON.parse(apiToken.permissions),
  };
}

// Helper function to check permissions
function hasPermission(permissions: any, action: string, environment?: string) {
  if (permissions.admin) return true;
  
  const envPerms = permissions.environments?.[environment || '*'];
  if (!envPerms) return false;
  
  return envPerms.includes(action) || envPerms.includes('*');
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await validateToken(request.headers.get('authorization'));
    if (!authResult) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const environment = searchParams.get('environment') || 'development';
    const config = searchParams.get('config') || 'default';
    const format = searchParams.get('format') || 'json';

    // Check read permissions
    if (!hasPermission(authResult.permissions, 'read', environment)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Get secrets for the specified environment and config
    const secretsData = await db
      .select()
      .from(secrets)
      .innerJoin(secretConfigs, eq(secrets.secretConfigId, secretConfigs.id))
      .innerJoin(environments, eq(secretConfigs.environmentId, environments.id))
      .where(and(
        eq(environments.projectId, authResult.project.id),
        eq(environments.name, environment),
        eq(secretConfigs.name, config)
      ))
      .orderBy(secrets.order);

    // Format response based on requested format
    if (format === 'env') {
      const envContent = secretsData
        .map(({ secrets: secret }) => `${secret.key}=${secret.value}`)
        .join('\n');
      
      return new NextResponse(envContent, {
        headers: {
          'Content-Type': 'text/plain',
        },
      });
    }

    // Default JSON format
    const secretsMap = secretsData.reduce((acc, { secrets: secret }) => {
      acc[secret.key] = secret.value;
      return acc;
    }, {} as Record<string, string>);

    return NextResponse.json({
      project: authResult.project.name,
      environment,
      config,
      secrets: secretsMap,
    });

  } catch (error) {
    console.error('Error fetching secrets via API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await validateToken(request.headers.get('authorization'));
    if (!authResult) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    const { environment = 'development', config = 'default', secrets: secretsData } = await request.json();

    // Check write permissions
    if (!hasPermission(authResult.permissions, 'write', environment)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    if (!secretsData || typeof secretsData !== 'object') {
      return NextResponse.json({ error: 'Invalid secrets data' }, { status: 400 });
    }

    // Find the target secret config
    const secretConfig = await db
      .select()
      .from(secretConfigs)
      .innerJoin(environments, eq(secretConfigs.environmentId, environments.id))
      .where(and(
        eq(environments.projectId, authResult.project.id),
        eq(environments.name, environment),
        eq(secretConfigs.name, config)
      ))
      .limit(1);

    if (!secretConfig[0]) {
      return NextResponse.json({ 
        error: `Environment "${environment}" or config "${config}" not found` 
      }, { status: 404 });
    }

    const configId = secretConfig[0].secret_configs.id;

    // Add or update secrets
    let createdCount = 0;
    let updatedCount = 0;

    for (const [key, value] of Object.entries(secretsData)) {
      if (typeof value !== 'string') continue;

      // Check if secret already exists
      const existingSecret = await db
        .select()
        .from(secrets)
        .where(and(
          eq(secrets.secretConfigId, configId),
          eq(secrets.key, key)
        ))
        .limit(1);

      if (existingSecret[0]) {
        // Update existing secret
        await db
          .update(secrets)
          .set({ value })
          .where(eq(secrets.id, existingSecret[0].id));
        updatedCount++;
      } else {
        // Create new secret
        await db.insert(secrets).values({
          id: crypto.randomUUID(),
          key,
          value,
          type: 'text',
          secretConfigId: configId,
          order: 1,
        });
        createdCount++;
      }
    }

    return NextResponse.json({
      message: 'Secrets updated successfully',
      created: createdCount,
      updated: updatedCount,
    });

  } catch (error) {
    console.error('Error updating secrets via API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}