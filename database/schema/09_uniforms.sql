CREATE TABLE IF NOT EXISTS `uniforms` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `type` ENUM('MALE','FEMALE') NOT NULL,
  `title` VARCHAR(100) NOT NULL,
  `image_path` VARCHAR(255) DEFAULT NULL,
  `store_name` VARCHAR(100) NOT NULL,
  `shoes_rack` INT NOT NULL,
  `pants_rack` INT NOT NULL,
  `jacket_rack` INT NOT NULL,
  `hat_rack` INT NOT NULL,
  `updated_by` INT DEFAULT NULL,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_uniforms_type` (`type`),
  KEY `idx_uniforms_updated_by` (`updated_by`),
  CONSTRAINT `fk_uniform_updated_by`
    FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
