CREATE TABLE `broker_connections` (
	`broker_id` text PRIMARY KEY NOT NULL,
	`is_active` integer DEFAULT false NOT NULL,
	`status` text NOT NULL,
	`last_checked_at` text,
	`last_error` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
