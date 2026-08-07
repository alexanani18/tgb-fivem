CREATE TABLE IF NOT EXISTS `employee_discord_roles` (
  `user_id` INT NOT NULL,
  `discord_role_id` INT NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`,`discord_role_id`),
  CONSTRAINT `fk_employee_discord_roles_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_employee_discord_roles_role`
    FOREIGN KEY (`discord_role_id`) REFERENCES `discord_roles` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
