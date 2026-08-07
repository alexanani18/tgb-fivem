CREATE TABLE IF NOT EXISTS `employee_documents` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `contract_id` INT NOT NULL,
  `document_type` VARCHAR(50) NOT NULL DEFAULT 'EMPLOYMENT_CONTRACT',
  `document_number` VARCHAR(50) DEFAULT NULL,
  `current_version` INT NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_employee_documents_contract_id` (`contract_id`),
  UNIQUE KEY `uq_employee_documents_number` (`document_number`),
  KEY `idx_employee_documents_user_id` (`user_id`),
  CONSTRAINT `fk_employee_documents_contract`
    FOREIGN KEY (`contract_id`) REFERENCES `employee_contracts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_employee_documents_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
