CREATE TABLE `member` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`google_subject` varchar(255),
	`google_name` varchar(255),
	`display_name` varchar(10),
	`job_role` enum('PM','UX_UI','FE','BE','FULL_STACK'),
	`role` enum('SUPER_ADMIN','OPERATOR','VIEWER') NOT NULL,
	`status` enum('REGISTERED','ACTIVE','INACTIVE','CANCELLED') NOT NULL DEFAULT 'REGISTERED',
	`last_login_at` datetime(3),
	`registered_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `member_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_member_email` UNIQUE(`email`),
	CONSTRAINT `uq_member_google_subject` UNIQUE(`google_subject`)
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id_hash` char(64) NOT NULL,
	`member_id` int NOT NULL,
	`created_at` datetime(3) NOT NULL,
	`last_used_at` datetime(3) NOT NULL,
	CONSTRAINT `session_id_hash` PRIMARY KEY(`id_hash`)
);
--> statement-breakpoint
ALTER TABLE `session` ADD CONSTRAINT `session_member_id_member_id_fk` FOREIGN KEY (`member_id`) REFERENCES `member`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_session_member` ON `session` (`member_id`);--> statement-breakpoint
CREATE INDEX `idx_session_last_used` ON `session` (`last_used_at`);