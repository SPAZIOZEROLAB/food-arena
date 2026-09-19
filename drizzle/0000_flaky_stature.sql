CREATE TABLE `limits` (
	`id` text PRIMARY KEY NOT NULL,
	`count` integer DEFAULT 1 NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `menu` (
	`id` text PRIMARY KEY NOT NULL,
	`venue_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`price` integer NOT NULL,
	`stock` integer NOT NULL,
	`prep` integer NOT NULL,
	`vegetarian` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`updated` integer NOT NULL,
	FOREIGN KEY (`venue_id`) REFERENCES `venues`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `menu_venue` ON `menu` (`venue_id`);--> statement-breakpoint
CREATE TABLE `offers` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`venue_id` text NOT NULL,
	`menu_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`price` integer NOT NULL,
	`quantity` integer NOT NULL,
	`ready_at` integer NOT NULL,
	`expires` integer NOT NULL,
	`created` integer NOT NULL,
	`status` text DEFAULT 'offered' NOT NULL,
	`code` text NOT NULL,
	`proof_hash` text,
	`tx_hash` text,
	FOREIGN KEY (`request_id`) REFERENCES `requests`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`venue_id`) REFERENCES `venues`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`menu_id`) REFERENCES `menu`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `offers_request` ON `offers` (`request_id`);--> statement-breakpoint
CREATE INDEX `offers_holds` ON `offers` (`menu_id`,`status`,`expires`);--> statement-breakpoint
CREATE INDEX `offers_venue` ON `offers` (`venue_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `offer_once` ON `offers` (`request_id`,`venue_id`);--> statement-breakpoint
CREATE TABLE `requests` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_hash` text NOT NULL,
	`budget` integer NOT NULL,
	`quantity` integer NOT NULL,
	`zone` text NOT NULL,
	`wish` text NOT NULL,
	`vegetarian` integer DEFAULT 0 NOT NULL,
	`pickup_by` integer NOT NULL,
	`created` integer NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`chosen` text,
	`demo` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `requests_owner` ON `requests` (`owner_hash`);--> statement-breakpoint
CREATE INDEX `requests_feed` ON `requests` (`demo`,`zone`,`status`,`pickup_by`);--> statement-breakpoint
CREATE TABLE `venues` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`address` text NOT NULL,
	`zone` text NOT NULL,
	`phone` text NOT NULL,
	`demo` integer DEFAULT 1 NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `venue_owner` ON `venues` (`owner`);