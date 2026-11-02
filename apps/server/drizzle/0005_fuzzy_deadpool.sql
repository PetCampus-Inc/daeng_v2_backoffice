CREATE TABLE `notification` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`recipient_id` int NOT NULL,
	`event_id` varchar(20) NOT NULL,
	`kind` varchar(32) NOT NULL,
	`message` varchar(255) NOT NULL,
	`target_type` varchar(16) NOT NULL,
	`target_id` bigint NOT NULL,
	`created_at` datetime(3) NOT NULL,
	`read_at` datetime(3),
	CONSTRAINT `notification_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_notification_event_recipient` UNIQUE(`event_id`,`recipient_id`)
);
--> statement-breakpoint
CREATE TABLE `processed_notification_event` (
	`event_id` varchar(20) NOT NULL,
	`processed_at` datetime(3) NOT NULL,
	CONSTRAINT `processed_notification_event_event_id` PRIMARY KEY(`event_id`)
);
--> statement-breakpoint
ALTER TABLE `notification` ADD CONSTRAINT `notification_recipient_id_member_id_fk` FOREIGN KEY (`recipient_id`) REFERENCES `member`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notification` ADD CONSTRAINT `notification_event_id_processed_notification_event_event_id_fk` FOREIGN KEY (`event_id`) REFERENCES `processed_notification_event`(`event_id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_notification_recipient_created` ON `notification` (`recipient_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `idx_notification_recipient_read` ON `notification` (`recipient_id`,`read_at`);