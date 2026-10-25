CREATE TABLE `access_log` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`occurred_at` datetime(3) NOT NULL,
	`email` varchar(320),
	`event` enum('LOGIN_SUCCESS','LOGIN_FAILURE','LOGOUT','SESSION_EXPIRED','ACCESS_DENIED') NOT NULL,
	`result` enum('SUCCESS','UNREGISTERED','INACTIVE','CANCELLED','SUBJECT_MISMATCH','INVALID_TOKEN','FORBIDDEN') NOT NULL,
	CONSTRAINT `access_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_access_log_occurred_at` ON `access_log` (`occurred_at`);