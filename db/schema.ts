import { sqliteTable, text, integer, primaryKey, check } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
export const dailyPageviews = sqliteTable('daily_pageviews', {
  day: text('day').notNull(),
  path: text('path').notNull(),
  views: integer('views').notNull().default(0),
}, (table) => [
  primaryKey({ columns: [table.day, table.path] }),
  check('daily_pageviews_views_nonnegative', sql`${table.views} >= 0`),
]);
