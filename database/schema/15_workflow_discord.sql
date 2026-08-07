CREATE TABLE IF NOT EXISTS `workflow_discord_channels` (
  `id` int NOT NULL AUTO_INCREMENT,
  `workflow_type_id` int NOT NULL,
  `discord_channel_id` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_enabled` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),

  UNIQUE KEY `uq_workflow_discord_channels_type` (`workflow_type_id`),

  CONSTRAINT `fk_workflow_discord_channels_type`
    FOREIGN KEY (`workflow_type_id`)
    REFERENCES `workflow_types` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS `workflow_discord_messages` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `workflow_request_id` bigint NOT NULL,
  `discord_channel_id` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `discord_message_id` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),

  UNIQUE KEY `uq_workflow_discord_messages_request` (`workflow_request_id`),
  UNIQUE KEY `uq_workflow_discord_messages_message` (`discord_message_id`),

  KEY `idx_workflow_discord_messages_channel` (`discord_channel_id`),

  CONSTRAINT `fk_workflow_discord_messages_request`
    FOREIGN KEY (`workflow_request_id`)
    REFERENCES `workflow_requests` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;
