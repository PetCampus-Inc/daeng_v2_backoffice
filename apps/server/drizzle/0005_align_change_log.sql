ALTER TABLE `change_log` RENAME COLUMN `target_identifier` TO `target_label`;--> statement-breakpoint
ALTER TABLE `change_log` ADD `target_id` int;--> statement-breakpoint
UPDATE `change_log` AS `log`
INNER JOIN `member` AS `target` ON `target`.`email` = `log`.`target_label`
SET
	`log`.`target_id` = `target`.`id`,
	`log`.`target_type` = 'ACCOUNT',
	`log`.`action` = CASE `log`.`action`
		WHEN 'MEMBER_REGISTERED' THEN 'ACCOUNT_REGISTERED'
		WHEN 'MEMBER_ROLE_CHANGED' THEN 'ACCOUNT_ROLE_CHANGED'
		WHEN 'MEMBER_DEACTIVATED' THEN 'ACCOUNT_DEACTIVATED'
		WHEN 'MEMBER_CANCELLED' THEN 'ACCOUNT_REGISTRATION_CANCELLED'
		WHEN 'MEMBER_REACTIVATED' THEN 'ACCOUNT_REACTIVATED'
		ELSE `log`.`action`
	END
WHERE `log`.`target_type` = 'MEMBER';--> statement-breakpoint
ALTER TABLE `change_log` MODIFY COLUMN `target_id` int NOT NULL;--> statement-breakpoint
ALTER TABLE `change_log` DROP COLUMN `target_title`;
