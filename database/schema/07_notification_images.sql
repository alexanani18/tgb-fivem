CREATE TABLE `notification_images` (
    `id` INT NOT NULL AUTO_INCREMENT,

    `notification_id` INT NOT NULL,

    `image_path` VARCHAR(255) NOT NULL,

    `position` TINYINT NOT NULL,
    `display_name` VARCHAR(255) DEFAULT NULL,

    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),

    KEY `idx_notification_images_notification_id` (`notification_id`),

    CONSTRAINT `fk_notification_images_notification`
        FOREIGN KEY (`notification_id`)
        REFERENCES `notifications` (`id`)
        ON DELETE CASCADE
        ON UPDATE CASCADE
)
ENGINE = InnoDB
DEFAULT CHARSET = utf8mb4
COLLATE = utf8mb4_unicode_ci;