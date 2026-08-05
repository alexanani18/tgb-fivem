DELETE FROM `users`;
ALTER TABLE `users` AUTO_INCREMENT = 1;
INSERT INTO `users` (
    `id`,
    `username`,
    `password_hash`,
    `user_role`,
    `user_role_id`,
    `user_rank_id`,
    `is_active`
)
VALUES
(
    1,
    'admin',
    '$2b$12$OEUJFdnsJS.rDw.j0h9ej.HDxfbyAqV28ZOi1cjXq/kLFSm.jQ9RW',
    'ADMIN',
    4,
    1,
    1
);