import { db } from '@/lib/db';
import { auditLogs } from '@/lib/db/schema';
import { eq, and, or, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export type AuditAction = 
  | 'secret_created' 
  | 'secret_updated' 
  | 'secret_deleted' 
  | 'secret_bulk_import' 
  | 'secret_bulk_clear'
  | 'config_created' 
  | 'config_deleted' 
  | 'config_forked'
  | 'environment_created'
  | 'environment_deleted';

export interface AuditMetadata {
  secretKey?: string;
  oldValue?: string;
  newValue?: string;
  secretType?: string;
  configName?: string;
  environmentName?: string;
  importFormat?: string;
  secretsCount?: number;
  sourceConfigId?: string;
  targetConfigId?: string;
}

export async function createAuditLog(
  projectId: string,
  userId: string,
  action: AuditAction,
  details: string,
  metadata?: AuditMetadata
) {
  try {
    await db.insert(auditLogs).values({
      id: uuidv4(),
      projectId,
      userId,
      action,
      details,
      metadata: metadata ? JSON.stringify(metadata) : null,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('Failed to create audit log:', error);
    // Don't throw - audit logging should not break main functionality
  }
}

export async function getProjectAuditLogs(projectId: string, limit = 100) {
  try {
    const logs = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.projectId, projectId))
      .orderBy(desc(auditLogs.timestamp))
      .limit(limit);

    return logs.map(log => ({
      ...log,
      metadata: log.metadata ? JSON.parse(log.metadata) : null,
    }));
  } catch (error) {
    console.error('Failed to fetch audit logs:', error);
    return [];
  }
}

export async function getSecretHistory(projectId: string, secretKey: string) {
  try {
    const logs = await db
      .select()
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.projectId, projectId),
          or(
            eq(auditLogs.action, 'secret_created'),
            eq(auditLogs.action, 'secret_updated'),
            eq(auditLogs.action, 'secret_deleted')
          )
        )
      )
      .orderBy(desc(auditLogs.timestamp));

    return logs
      .filter(log => {
        const metadata = log.metadata ? JSON.parse(log.metadata) : null;
        return metadata?.secretKey === secretKey;
      })
      .map(log => ({
        ...log,
        metadata: log.metadata ? JSON.parse(log.metadata) : null,
      }));
  } catch (error) {
    console.error('Failed to fetch secret history:', error);
    return [];
  }
}