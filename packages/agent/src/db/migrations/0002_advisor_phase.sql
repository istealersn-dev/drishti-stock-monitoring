CREATE TABLE `technical_levels` (
	`symbol` text NOT NULL,
	`date` text NOT NULL,
	`dma50` real,
	`dma200` real,
	`week_high_52` real,
	`week_low_52` real,
	`swing_high` real,
	`swing_low` real,
	`avg_volume_20` real,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`symbol`, `date`)
);
--> statement-breakpoint
CREATE TABLE `watchlist` (
	`symbol` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`notes` text,
	`added_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `advisory_conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`channel` text NOT NULL,
	`created_at` text NOT NULL
);
