CREATE TABLE IF NOT EXISTS `notification_image_submissions` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `notification_image_id` INT NOT NULL,
  `uploaded_by` INT NOT NULL,
  `file_path` VARCHAR(500) NOT NULL,
  `original_file_name` VARCHAR(255) NOT NULL,
  `mime_type` VARCHAR(100) NOT NULL,
  `file_size` INT NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  `reviewed_by` INT DEFAULT NULL,
  `reviewed_at` DATETIME DEFAULT NULL,
  `rejection_reason` TEXT DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_submissions_notification_image_id` (`notification_image_id`),
  KEY `idx_submissions_uploaded_by` (`uploaded_by`),
  KEY `idx_submissions_reviewed_by` (`reviewed_by`),
  KEY `idx_submissions_status` (`status`),
  KEY `idx_submissions_created_at` (`created_at`),
  KEY `idx_submissions_image_created` (`notification_image_id`,`created_at`),
  CONSTRAINT `fk_submissions_notification_image`
    FOREIGN KEY (`notification_image_id`) REFERENCES `notification_images` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_submissions_uploaded_by`
    FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_submissions_reviewed_by`
    FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
