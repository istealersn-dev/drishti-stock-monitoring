CREATE TABLE `holdings_snapshot` (
	`id` integer PRIMARY KEY NOT NULL,
	`holdings_json` text NOT NULL,
	`cached_at` text NOT NULL
);
