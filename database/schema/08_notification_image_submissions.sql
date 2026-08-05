CREATE TABLE `notification_image_submissions` (
    `id` INT NOT NULL AUTO_INCREMENT,

    `notification_image_id` INT NOT NULL,

    `user_id` INT NOT NULL,

    `image_path` VARCHAR(500) NOT NULL,

    `submitted_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),

    KEY `idx_notification_image_submissions_image` (`notification_image_id`),
    KEY `idx_notification_image_submissions_user` (`user_id`),

    CONSTRAINT `fk_notification_image_submissions_image`
        FOREIGN KEY (`notification_image_id`)
        REFERENCES `notification_images` (`id`)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT `fk_notification_image_submissions_user`
        FOREIGN KEY (`user_id`)
        REFERENCES `users` (`id`)
        ON DELETE CASCADE
        ON UPDATE CASCADE
)
ENGINE = InnoDB
DEFAULT CHARSET = utf8mb4
COLLATE = utf8mb4_unicode_ci;