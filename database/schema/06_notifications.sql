CREATE TABLE `notifications` (
    `id` INT NOT NULL AUTO_INCREMENT,

    `recipient_id` INT NOT NULL,
    `created_by` INT NOT NULL,

    `title` VARCHAR(150) NOT NULL,
    `message` TEXT NOT NULL,

    `is_read` TINYINT(1) NOT NULL DEFAULT 0,

    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),

    KEY `idx_notifications_recipient_id` (`recipient_id`),
    KEY `idx_notifications_created_by` (`created_by`),
    KEY `idx_notifications_is_read` (`is_read`),
    KEY `idx_notifications_created_at` (`created_at`),

    CONSTRAINT `fk_notifications_recipient`
        FOREIGN KEY (`recipient_id`)
        REFERENCES `users` (`id`)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT `fk_notifications_created_by`
        FOREIGN KEY (`created_by`)
        REFERENCES `users` (`id`)
        ON UPDATE CASCADE
)
ENGINE = InnoDB
DEFAULT CHARSET = utf8mb4
COLLATE = utf8mb4_unicode_ci;