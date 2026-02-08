CREATE TABLE `predictions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`creator_user_id` integer NOT NULL,
	`asset_symbol` text NOT NULL,
	`direction` text NOT NULL,
	`timeframe_end` integer NOT NULL,
	`confidence` integer NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`settlement_price` text,
	`settlement_timestamp` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`creator_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `predictions_creator_idx` ON `predictions` (`creator_user_id`);--> statement-breakpoint
CREATE INDEX `predictions_status_idx` ON `predictions` (`status`);--> statement-breakpoint
CREATE INDEX `predictions_timeframe_end_idx` ON `predictions` (`timeframe_end`);--> statement-breakpoint
CREATE TABLE `reputation_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`prediction_id` integer NOT NULL,
	`outcome` text NOT NULL,
	`delta_score` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`prediction_id`) REFERENCES `predictions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `reputation_events_user_idx` ON `reputation_events` (`user_id`);--> statement-breakpoint
CREATE INDEX `reputation_events_prediction_idx` ON `reputation_events` (`prediction_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `reputation_events_user_prediction_uniq` ON `reputation_events` (`user_id`,`prediction_id`);--> statement-breakpoint
CREATE TABLE `stakes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`prediction_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`side` text NOT NULL,
	`amount` text NOT NULL,
	`currency` text NOT NULL,
	`invoice_id` text,
	`payment_status` text DEFAULT 'initiated' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`prediction_id`) REFERENCES `predictions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `stakes_invoice_id_uniq` ON `stakes` (`invoice_id`);--> statement-breakpoint
CREATE INDEX `stakes_prediction_idx` ON `stakes` (`prediction_id`);--> statement-breakpoint
CREATE INDEX `stakes_user_idx` ON `stakes` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `stakes_user_prediction_side_uniq` ON `stakes` (`user_id`,`prediction_id`,`side`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`alien_subject` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_alien_subject_uniq` ON `users` (`alien_subject`);