CREATE TABLE `activity` (
	`owner_id` text NOT NULL,
	`day` text NOT NULL,
	`web_requests` integer DEFAULT 0 NOT NULL,
	`mcp_calls` integer DEFAULT 0 NOT NULL,
	`purchases_added` integer DEFAULT 0 NOT NULL,
	`drafts_prepared` integer DEFAULT 0 NOT NULL,
	`receipts_uploaded` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`owner_id`, `day`),
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `activity_day` ON `activity` (`day`);--> statement-breakpoint
CREATE TABLE `administrators` (
	`id` integer PRIMARY KEY NOT NULL,
	`subject` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`purchase_id` text,
	`original_filename` text NOT NULL,
	`object_key` text NOT NULL,
	`content_hash` text NOT NULL,
	`size` integer NOT NULL,
	`upload_timestamp` text NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`owner_id`,`purchase_id`) REFERENCES `purchases`(`owner_id`,`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `documents_owner` ON `documents` (`owner_id`);--> statement-breakpoint
CREATE TABLE `request_limits` (
	`owner_id` text NOT NULL,
	`bucket` text NOT NULL,
	`requests` integer NOT NULL,
	PRIMARY KEY(`owner_id`, `bucket`),
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`purchase_id` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`message` text NOT NULL,
	`created_at` text NOT NULL,
	`read` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`owner_id`,`purchase_id`) REFERENCES `purchases`(`owner_id`,`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notifications_owner_key` ON `notifications` (`owner_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `notifications_owner_created` ON `notifications` (`owner_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `purchases` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`data` text NOT NULL,
	`is_demo` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `purchases_owner_id_id` ON `purchases` (`owner_id`,`id`);--> statement-breakpoint
CREATE INDEX `purchases_owner_created` ON `purchases` (`owner_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`last_active` text NOT NULL,
	`settings` text NOT NULL
);
