-- Milestones go from a done flag to a status (open | done | failed), and
-- done_at becomes resolved_at (the day it was completed or failed).
ALTER TABLE `milestones` ADD `status` text DEFAULT 'open' NOT NULL;--> statement-breakpoint
UPDATE `milestones` SET `status` = 'done' WHERE `done` = 1;--> statement-breakpoint
ALTER TABLE `milestones` DROP COLUMN `done`;--> statement-breakpoint
ALTER TABLE `milestones` RENAME COLUMN `done_at` TO `resolved_at`;
