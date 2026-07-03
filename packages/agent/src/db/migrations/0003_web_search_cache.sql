CREATE TABLE IF NOT EXISTS `web_search_cache` (
	`symbol` text NOT NULL,
	`date` text NOT NULL,
	`content` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`symbol`, `date`)
);
