CREATE TABLE IF NOT EXISTS `users` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `username` VARCHAR(100) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `user_role` VARCHAR(20) NOT NULL DEFAULT 'GUEST',
  `user_role_id` INT DEFAULT NULL,
  `user_rank_id` INT DEFAULT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_username` (`username`),
  KEY `idx_users_role_id` (`user_role_id`),
  KEY `idx_users_rank_id` (`user_rank_id`),
  CONSTRAINT `fk_users_user_role`
    FOREIGN KEY (`user_role_id`) REFERENCES `user_roles` (`id`)
    ON UPDATE CASCADE,
  CONSTRAINT `fk_users_user_rank`
    FOREIGN KEY (`user_rank_id`) REFERENCES `user_ranks` (`id`)
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
