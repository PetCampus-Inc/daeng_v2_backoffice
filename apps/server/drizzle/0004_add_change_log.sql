CREATE TABLE `change_log` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`occurred_at` datetime(3) NOT NULL,
	`actor_member_id` int NOT NULL,
	`actor_email` varchar(320) NOT NULL,
	`actor_display_name` varchar(10) NOT NULL,
	`actor_job_role` enum('PM','UX_UI','FE','BE','FULL_STACK') NOT NULL,
	`target_type` varchar(32) NOT NULL,
	`target_identifier` varchar(320) NOT NULL,
	`target_title` varchar(255),
	`action` varchar(64) NOT NULL,
	`before_value` varchar(255),
	`after_value` varchar(255),
	CONSTRAINT `change_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_change_log_occurred_at` ON `change_log` (`occurred_at`);--> statement-breakpoint
CREATE INDEX `idx_change_log_actor` ON `change_log` (`actor_member_id`);