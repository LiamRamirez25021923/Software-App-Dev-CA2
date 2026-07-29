-- SavePoint collation repair
-- Run this against c237_017_team5_savepoint if it contains tables imported
-- from older projects with latin1_swedish_ci columns.

USE `c237_017_team5_savepoint`;

ALTER DATABASE `c237_017_team5_savepoint`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- The users table is the source of the current profile COALESCE error.
ALTER TABLE `users`
  CONVERT TO CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- Normalise the text-based forum tables as well so usernames, community
-- names, notifications and post text use one collation.
ALTER TABLE `communities`
  CONVERT TO CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

ALTER TABLE `community_roles`
  CONVERT TO CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

ALTER TABLE `community_members`
  CONVERT TO CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

ALTER TABLE `forum_posts`
  CONVERT TO CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

ALTER TABLE `forum_comments`
  CONVERT TO CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

ALTER TABLE `forum_notifications`
  CONVERT TO CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- forum_votes contains only numeric/timestamp columns and therefore needs
-- no character-set conversion.
