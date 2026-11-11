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

export const dailyBrowsers = sqliteTable('daily_browsers', {
  day: text('day').notNull(), browserId: text('browser_id').notNull(),
}, table => [primaryKey({columns: [table.day, table.browserId]})]);
export const dailyCollection = sqliteTable('daily_collection', {
  day: text('day').primaryKey(), identifiedViews: integer('identified_views').notNull().default(0),
  unidentifiedViews: integer('unidentified_views').notNull().default(0),
}, table => [check('collection_counts_nonnegative', sql`${table.identifiedViews} >= 0 AND ${table.unidentifiedViews} >= 0`)]);
