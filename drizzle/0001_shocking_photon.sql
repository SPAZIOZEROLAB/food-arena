CREATE TABLE `budget_offers` (
	`offer_id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`merchant` text NOT NULL,
	`amount` text NOT NULL,
	`expires_at` integer NOT NULL,
	`terms_hash` text NOT NULL,
	`signature` text NOT NULL,
	`status` text DEFAULT 'offered' NOT NULL,
	`hold_tx` text,
	`settle_signature` text,
	`settle_deadline` integer,
	`fulfilment_hash` text,
	`settle_tx` text,
	`release_tx` text
);
--> statement-breakpoint
CREATE INDEX `budget_order` ON `budget_offers` (`order_id`);--> statement-breakpoint
CREATE TABLE `budget_wallets` (
	`venue_id` text PRIMARY KEY NOT NULL,
	`address` text NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `budget_wallet_address` ON `budget_wallets` (`address`);--> statement-breakpoint
CREATE TABLE `chain_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`nonce` integer NOT NULL,
	`raw_tx` text NOT NULL,
	`tx_hash` text NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `chain_nonce` ON `chain_jobs` (`nonce`);--> statement-breakpoint
CREATE TABLE `chain_lease` (
	`id` text PRIMARY KEY NOT NULL,
	`holder` text NOT NULL,
	`until` integer NOT NULL
);
