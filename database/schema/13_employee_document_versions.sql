CREATE TABLE IF NOT EXISTS `employee_document_versions` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `document_id` INT NOT NULL,
  `version_number` INT NOT NULL,
  `png_path` VARCHAR(500) NOT NULL,
  `pdf_path` VARCHAR(500) NOT NULL,
  `employee_name` VARCHAR(255) NOT NULL,
  `game_id` VARCHAR(50) NOT NULL,
  `phone_number` VARCHAR(30) NOT NULL,
  `employee_address` VARCHAR(255) NOT NULL DEFAULT 'Los Santos',
  `employment_date` DATE NOT NULL,
  `job_title` VARCHAR(100) NOT NULL DEFAULT 'Angajat Blackfold',
  `rank_name` VARCHAR(100) NOT NULL,
  `salary` INT NOT NULL,
  `work_schedule` VARCHAR(50) NOT NULL DEFAULT '17:00 - 00:00',
  `contract_type` VARCHAR(50) NOT NULL DEFAULT 'Nedeterminat',
  `signature_name` VARCHAR(255) NOT NULL,
  `generated_by_user_id` INT DEFAULT NULL,
  `generated_by_name` VARCHAR(255) NOT NULL,
  `generated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_document_version` (`document_id`,`version_number`),
  KEY `idx_document_versions_generated_by` (`generated_by_user_id`),
  CONSTRAINT `fk_document_versions_document`
    FOREIGN KEY (`document_id`) REFERENCES `employee_documents` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_document_versions_generated_by`
    FOREIGN KEY (`generated_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
