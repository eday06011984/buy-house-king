CREATE TABLE `daily_browsers` (
	`day` text NOT NULL,
	`browser_id` text NOT NULL,
	PRIMARY KEY(`day`, `browser_id`)
);
--> statement-breakpoint
CREATE TABLE `daily_collection` (
	`day` text PRIMARY KEY NOT NULL,
	`identified_views` integer DEFAULT 0 NOT NULL,
	`unidentified_views` integer DEFAULT 0 NOT NULL,
	CONSTRAINT "collection_counts_nonnegative" CHECK("daily_collection"."identified_views" >= 0 AND "daily_collection"."unidentified_views" >= 0)
);
