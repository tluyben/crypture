import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { projects, secrets, secretConfigs, environments, auditLogs } from '@/lib/db/schema';
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
    const { auditLogId } = await request.json();

    if (!auditLogId) {
      return NextResponse.json(
        { error: 'auditLogId is required' },
        { status: 400 }
      );
    }

    // Verify project ownership
    const project = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, resolvedParams.id), eq(projects.userId, session.user.id)))
      .limit(1);

    if (!project[0]) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get the audit log entry
    const auditLog = await db
      .select()
      .from(auditLogs)
      .where(and(
        eq(auditLogs.id, auditLogId),
        eq(auditLogs.projectId, resolvedParams.id)
      ))
      .limit(1);

    if (!auditLog[0]) {
      return NextResponse.json({ error: 'Audit log not found' }, { status: 404 });
    }

    const log = auditLog[0];
    const metadata = log.metadata ? JSON.parse(log.metadata) : null;

    // Only allow rollback for certain actions
    if (!['secret_created', 'secret_updated', 'secret_deleted'].includes(log.action)) {
      return NextResponse.json(
        { error: 'Cannot rollback this type of action' },
        { status: 400 }
      );
    }

    if (!metadata?.secretKey) {
      return NextResponse.json(
        { error: 'Insufficient metadata for rollback' },
        { status: 400 }
      );
    }

    let rollbackAction = '';
    let rollbackDetails = '';

    // Handle different rollback scenarios
    switch (log.action) {
      case 'secret_created':
        // Rollback creation by deleting the secret
        const createdSecret = await db
          .select()
          .from(secrets)
          .innerJoin(secretConfigs, eq(secrets.secretConfigId, secretConfigs.id))
          .innerJoin(environments, eq(secretConfigs.environmentId, environments.id))
          .where(and(
            eq(secrets.key, metadata.secretKey),
            eq(environments.projectId, resolvedParams.id)
          ))
          .limit(1);

        if (createdSecret[0]) {
          await db.delete(secrets).where(eq(secrets.id, createdSecret[0].secrets.id));
          rollbackAction = 'secret_deleted';
          rollbackDetails = `Rolled back creation of secret "${metadata.secretKey}"`;
        }
        break;

      case 'secret_updated':
        // Rollback update by restoring old value
        if (metadata.oldValue) {
          const updatedSecret = await db
            .select()
            .from(secrets)
            .innerJoin(secretConfigs, eq(secrets.secretConfigId, secretConfigs.id))
            .innerJoin(environments, eq(secretConfigs.environmentId, environments.id))
            .where(and(
              eq(secrets.key, metadata.secretKey),
              eq(environments.projectId, resolvedParams.id)
            ))
            .limit(1);

          if (updatedSecret[0]) {
            await db
              .update(secrets)
              .set({ value: metadata.oldValue })
              .where(eq(secrets.id, updatedSecret[0].secrets.id));
            
            rollbackAction = 'secret_updated';
            rollbackDetails = `Rolled back update of secret "${metadata.secretKey}" to previous value`;
          }
        }
        break;

      case 'secret_deleted':
        // Rollback deletion by recreating the secret
        if (metadata.oldValue && metadata.configName) {
          // Find the secret config by name
          const secretConfig = await db
            .select()
            .from(secretConfigs)
            .innerJoin(environments, eq(secretConfigs.environmentId, environments.id))
            .where(and(
              eq(secretConfigs.name, metadata.configName),
              eq(environments.projectId, resolvedParams.id)
            ))
            .limit(1);

          if (secretConfig[0]) {
            await db.insert(secrets).values({
              id: crypto.randomUUID(),
              key: metadata.secretKey,
              value: metadata.oldValue,
              type: metadata.secretType || 'text',
              secretConfigId: secretConfig[0].secret_configs.id,
              order: 1,
            });
            
            rollbackAction = 'secret_created';
            rollbackDetails = `Rolled back deletion of secret "${metadata.secretKey}"`;
          }
        }
        break;
    }

    if (rollbackAction) {
      // Create audit log for the rollback
      await createAuditLog(
        resolvedParams.id,
        session.user.id,
        rollbackAction as any,
        rollbackDetails,
        {
          secretKey: metadata.secretKey,
          originalAuditLogId: auditLogId,
        }
      );

      return NextResponse.json({ 
        message: 'Rollback completed successfully',
        action: rollbackAction,
        details: rollbackDetails
      });
    } else {
      return NextResponse.json(
        { error: 'Rollback failed - could not find target secret or config' },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Error during rollback:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}