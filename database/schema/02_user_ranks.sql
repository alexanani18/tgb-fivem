CREATE TABLE `user_ranks` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `sort_order` INT NOT NULL,

    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_user_ranks_name` (`name`),
    UNIQUE KEY `uq_user_ranks_sort_order` (`sort_order`)
)
ENGINE = InnoDB
DEFAULT CHARSET = utf8mb4
COLLATE = utf8mb4_unicode_ci;