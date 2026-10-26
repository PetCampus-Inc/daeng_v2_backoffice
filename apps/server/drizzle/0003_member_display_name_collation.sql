-- 표시명 중복 판정이 DB 기본 정렬 규칙에 따라 달라지지 않도록 고정한다.
ALTER TABLE `member` MODIFY COLUMN `display_name` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL;
