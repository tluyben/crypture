import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, blob } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  password: text('password'),
  emailVerified: integer('emailVerified', { mode: 'timestamp_ms' }),
  image: text('image'),
  twoFactorSecret: text('twoFactorSecret'),
  twoFactorEnabled: integer('twoFactorEnabled', { mode: 'boolean' }).default(false),
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }).default(sql`(unixepoch() * 1000)`),
  updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }).default(sql`(unixepoch() * 1000)`),
});

export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  provider: text('provider').notNull(),
  providerAccountId: text('providerAccountId').notNull(),
  refresh_token: text('refresh_token'),
  access_token: text('access_token'),
  expires_at: integer('expires_at'),
  token_type: text('token_type'),
  scope: text('scope'),
  id_token: text('id_token'),
  session_state: text('session_state'),
});

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  sessionToken: text('sessionToken').notNull().unique(),
  userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expires: integer('expires', { mode: 'timestamp_ms' }).notNull(),
});

export const verificationTokens = sqliteTable('verificationTokens', {
  identifier: text('identifier').notNull(),
  token: text('token').notNull(),
  expires: integer('expires', { mode: 'timestamp_ms' }).notNull(),
});

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  icon: text('icon'),
  userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }).default(sql`(unixepoch() * 1000)`),
  updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }).default(sql`(unixepoch() * 1000)`),
});

export const environments = sqliteTable('environments', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  displayName: text('displayName').notNull(),
  shortcut: text('shortcut').notNull(),
  projectId: text('projectId').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  order: integer('order').notNull().default(0),
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }).default(sql`(unixepoch() * 1000)`),
  updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }).default(sql`(unixepoch() * 1000)`),
});

export const secretConfigs = sqliteTable('secretConfigs', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  environmentId: text('environmentId').notNull().references(() => environments.id, { onDelete: 'cascade' }),
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }).default(sql`(unixepoch() * 1000)`),
  updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }).default(sql`(unixepoch() * 1000)`),
});

export const secrets = sqliteTable('secrets', {
  id: text('id').primaryKey(),
  key: text('key').notNull(),
  value: text('value').notNull(),
  type: text('type').notNull().default('text'),
  secretConfigId: text('secretConfigId').notNull().references(() => secretConfigs.id, { onDelete: 'cascade' }),
  order: integer('order').notNull().default(0),
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }).default(sql`(unixepoch() * 1000)`),
  updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }).default(sql`(unixepoch() * 1000)`),
});

export const auditLogs = sqliteTable('auditLogs', {
  id: text('id').primaryKey(),
  projectId: text('projectId').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  userId: text('userId').notNull().references(() => users.id),
  action: text('action').notNull(),
  details: text('details').notNull(),
  metadata: text('metadata'),
  timestamp: integer('timestamp', { mode: 'timestamp_ms' }).default(sql`(unixepoch() * 1000)`),
});

export const apiTokens = sqliteTable('apiTokens', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  token: text('token').notNull().unique(),
  userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  projectId: text('projectId').references(() => projects.id, { onDelete: 'cascade' }),
  permissions: text('permissions').notNull(),
  isActive: integer('isActive', { mode: 'boolean' }).default(true),
  expiresAt: integer('expiresAt', { mode: 'timestamp_ms' }),
  lastUsed: integer('lastUsed', { mode: 'timestamp_ms' }),
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }).default(sql`(unixepoch() * 1000)`),
  updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }).default(sql`(unixepoch() * 1000)`),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Environment = typeof environments.$inferSelect;
export type NewEnvironment = typeof environments.$inferInsert;
export type SecretConfig = typeof secretConfigs.$inferSelect;
export type NewSecretConfig = typeof secretConfigs.$inferInsert;
export type Secret = typeof secrets.$inferSelect;
export type NewSecret = typeof secrets.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
export type ApiToken = typeof apiTokens.$inferSelect;
export type NewApiToken = typeof apiTokens.$inferInsert;