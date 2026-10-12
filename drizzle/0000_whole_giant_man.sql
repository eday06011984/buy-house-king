CREATE TABLE `daily_pageviews` (
	`day` text NOT NULL,
	`path` text NOT NULL,
	`views` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`day`, `path`),
	CONSTRAINT "daily_pageviews_views_nonnegative" CHECK("daily_pageviews"."views" >= 0)
);
