CREATE TABLE `employee_details` (
    `user_id` INT NOT NULL,

    `status` ENUM(
        'ACTIV',
        'CONCEDIU',
        'DEMISIONAT'
    ) NOT NULL DEFAULT 'ACTIV',

    `meeting_attendance` TINYINT(1) NOT NULL DEFAULT 0,
    `has_uniform` TINYINT(1) NOT NULL DEFAULT 0,
    `has_car` TINYINT(1) NOT NULL DEFAULT 0,

    `discord_id` VARCHAR(30) DEFAULT NULL,
    `observations` VARCHAR(1000) DEFAULT NULL,

    PRIMARY KEY (`user_id`),

    CONSTRAINT `fk_employee_details_user`
        FOREIGN KEY (`user_id`)
        REFERENCES `users` (`id`)
        ON DELETE CASCADE
        ON UPDATE CASCADE
)
ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;