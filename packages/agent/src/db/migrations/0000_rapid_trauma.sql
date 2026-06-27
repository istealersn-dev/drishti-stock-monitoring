CREATE TABLE `agent_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`run_id` text NOT NULL,
	`symbol` text,
	`action` text NOT NULL,
	`reasoning` text,
	`dry_run` integer NOT NULL,
	`error` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `agent_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text,
	`status` text NOT NULL,
	`summary` text
);
--> statement-breakpoint
CREATE TABLE `gtt_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`symbol` text NOT NULL,
	`type` text NOT NULL,
	`trigger_price` real NOT NULL,
	`limit_price` real NOT NULL,
	`quantity` integer NOT NULL,
	`status` text NOT NULL,
	`approval_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pending_approvals` (
	`id` text PRIMARY KEY NOT NULL,
	`symbol` text NOT NULL,
	`parsed_json` text NOT NULL,
	`suggested_qty` integer NOT NULL,
	`status` text NOT NULL,
	`slack_ts` text,
	`created_at` text NOT NULL,
	`resolved_at` text
);
--> statement-breakpoint
CREATE TABLE `stock_config` (
	`symbol` text PRIMARY KEY NOT NULL,
	`sl_threshold` real NOT NULL,
	`target_one` real,
	`target_two` real,
	`target_two_open` integer DEFAULT false,
	`entry_low` real,
	`entry_high` real,
	`buy_price` real,
	`is_active` integer DEFAULT true,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `agent_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text NOT NULL
);
