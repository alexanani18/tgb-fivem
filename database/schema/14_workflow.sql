CREATE TABLE IF NOT EXISTS `workflow_types` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `request_prefix` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_workflow_types_code` (`code`),
  UNIQUE KEY `uq_workflow_types_request_prefix` (`request_prefix`)
) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS `workflow_statuses` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `display_order` int NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_workflow_statuses_code` (`code`)
) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS `workflow_requests` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `request_number` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `workflow_type_id` int NOT NULL,
  `user_id` int NOT NULL,
  `status_id` int NOT NULL,

  `reviewed_by` int DEFAULT NULL,
  `reviewed_at` datetime DEFAULT NULL,
  `rejection_reason` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,

  `discord_channel_id` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `discord_message_id` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,

  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),

  UNIQUE KEY `uq_workflow_requests_request_number` (`request_number`),

  KEY `idx_workflow_requests_type` (`workflow_type_id`),
  KEY `idx_workflow_requests_user` (`user_id`),
  KEY `idx_workflow_requests_status` (`status_id`),
  KEY `idx_workflow_requests_reviewed_by` (`reviewed_by`),
  KEY `idx_workflow_requests_created_at` (`created_at`),

  CONSTRAINT `fk_workflow_requests_type`
    FOREIGN KEY (`workflow_type_id`)
    REFERENCES `workflow_types` (`id`),

  CONSTRAINT `fk_workflow_requests_status`
    FOREIGN KEY (`status_id`)
    REFERENCES `workflow_statuses` (`id`),

  CONSTRAINT `fk_workflow_requests_user`
    FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`),

  CONSTRAINT `fk_workflow_requests_reviewed_by`
    FOREIGN KEY (`reviewed_by`)
    REFERENCES `users` (`id`)
) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS `workflow_request_history` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `workflow_request_id` bigint NOT NULL,

  `action` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `performed_by` int DEFAULT NULL,

  `old_status_id` int DEFAULT NULL,
  `new_status_id` int DEFAULT NULL,

  `comment` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `metadata` json DEFAULT NULL,

  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),

  KEY `idx_workflow_history_request` (`workflow_request_id`),
  KEY `idx_workflow_history_performed_by` (`performed_by`),
  KEY `idx_workflow_history_old_status` (`old_status_id`),
  KEY `idx_workflow_history_new_status` (`new_status_id`),
  KEY `idx_workflow_history_created_at` (`created_at`),

  CONSTRAINT `fk_workflow_history_request`
    FOREIGN KEY (`workflow_request_id`)
    REFERENCES `workflow_requests` (`id`),

  CONSTRAINT `fk_workflow_history_performed_by`
    FOREIGN KEY (`performed_by`)
    REFERENCES `users` (`id`),

  CONSTRAINT `fk_workflow_history_old_status`
    FOREIGN KEY (`old_status_id`)
    REFERENCES `workflow_statuses` (`id`),

  CONSTRAINT `fk_workflow_history_new_status`
    FOREIGN KEY (`new_status_id`)
    REFERENCES `workflow_statuses` (`id`)
) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS `resignation_requests` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `workflow_request_id` bigint NOT NULL,

  `effective_date` date NOT NULL,
  `reason` varchar(1000) COLLATE utf8mb4_unicode_ci NOT NULL,

  `uniform_returned` tinyint(1) NOT NULL DEFAULT '0',
  `uniform_returned_at` datetime DEFAULT NULL,
  `uniform_returned_confirmed_by` int DEFAULT NULL,

  `completed_at` datetime DEFAULT NULL,
  `completed_by` int DEFAULT NULL,

  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),

  UNIQUE KEY `uq_resignation_workflow_request` (`workflow_request_id`),

  KEY `idx_resignation_effective_date` (`effective_date`),
  KEY `idx_resignation_uniform_confirmed_by` (`uniform_returned_confirmed_by`),
  KEY `idx_resignation_completed_by` (`completed_by`),

  CONSTRAINT `fk_resignation_workflow_request`
    FOREIGN KEY (`workflow_request_id`)
    REFERENCES `workflow_requests` (`id`),

  CONSTRAINT `fk_resignation_uniform_confirmed_by`
    FOREIGN KEY (`uniform_returned_confirmed_by`)
    REFERENCES `users` (`id`),

  CONSTRAINT `fk_resignation_completed_by`
    FOREIGN KEY (`completed_by`)
    REFERENCES `users` (`id`)
) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `leave_requests` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `workflow_request_id` bigint NOT NULL,

  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `reason` varchar(1000) COLLATE utf8mb4_unicode_ci NOT NULL,

  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),

  UNIQUE KEY `uq_leave_workflow_request` (`workflow_request_id`),

  KEY `idx_leave_start_date` (`start_date`),
  KEY `idx_leave_end_date` (`end_date`),

  CONSTRAINT `fk_leave_workflow_request`
    FOREIGN KEY (`workflow_request_id`)
    REFERENCES `workflow_requests` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;
