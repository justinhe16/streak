CREATE TABLE `check_ins` (
	`goal_id` text NOT NULL,
	`date` text NOT NULL,
	PRIMARY KEY(`goal_id`, `date`),
	FOREIGN KEY (`goal_id`) REFERENCES `goals`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `check_ins_date_idx` ON `check_ins` (`date`);--> statement-breakpoint
CREATE TABLE `goals` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`days_per_week` integer NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text,
	`okr_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`okr_id`) REFERENCES `okrs`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "goals_days_per_week" CHECK("goals"."days_per_week" BETWEEN 1 AND 7),
	CONSTRAINT "goals_range" CHECK("goals"."end_date" IS NULL OR "goals"."end_date" >= "goals"."start_date")
);
--> statement-breakpoint
CREATE INDEX `goals_okr_idx` ON `goals` (`okr_id`);--> statement-breakpoint
CREATE TABLE `milestones` (
	`id` text PRIMARY KEY NOT NULL,
	`okr_id` text NOT NULL,
	`text` text NOT NULL,
	`done` integer DEFAULT false NOT NULL,
	`done_at` text,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`okr_id`) REFERENCES `okrs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `milestones_okr_idx` ON `milestones` (`okr_id`,`position`);--> statement-breakpoint
CREATE TABLE `okrs` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`timeframe` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reflections` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`written_on` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `reflections_written_on_idx` ON `reflections` (`written_on`);