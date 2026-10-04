ALTER TABLE `builds` ADD `okr_id` text REFERENCES okrs(id) ON DELETE set null;--> statement-breakpoint
CREATE INDEX `builds_okr_idx` ON `builds` (`okr_id`);