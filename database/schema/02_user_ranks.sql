CREATE TABLE IF NOT EXISTS `user_ranks` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `salary` INT NOT NULL DEFAULT 0,
  `salary_type` ENUM('PUBLIC','CONFIDENTIAL') NOT NULL DEFAULT 'PUBLIC',
  `sort_order` INT NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_ranks_name` (`name`),
  UNIQUE KEY `uq_user_ranks_sort_order` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
