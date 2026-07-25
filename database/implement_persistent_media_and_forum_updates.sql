-- SavePoint persistent uploads and Community Forum enhancements
-- Run against the same MySQL database used by SavePoint/Render.
USE `c237_017_team5_savepoint`;

CREATE TABLE IF NOT EXISTS media_assets (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  owner_user_id INT NULL,
  media_kind ENUM('image','video') NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  original_name VARCHAR(255) NULL,
  byte_size INT NOT NULL,
  media_data LONGBLOB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_media_owner (owner_user_id),
  INDEX idx_media_kind (media_kind)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @has_video_url = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='forum_posts' AND COLUMN_NAME='video_url'
);
SET @video_sql = IF(@has_video_url=0,
  'ALTER TABLE forum_posts ADD COLUMN video_url VARCHAR(255) NULL AFTER image_url',
  'SELECT 1');
PREPARE video_stmt FROM @video_sql;
EXECUTE video_stmt;
DEALLOCATE PREPARE video_stmt;

CREATE TABLE IF NOT EXISTS forum_comment_votes (
  comment_id INT NOT NULL,
  user_id INT NOT NULL,
  vote_value TINYINT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (comment_id, user_id),
  INDEX idx_comment_vote_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Optional integrity constraints. They are omitted deliberately to remain
-- compatible with legacy SavePoint schemas that use different user/post IDs.
