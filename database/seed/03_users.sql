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
    '$2b$12$yskiE6hSCgxCU7dQvMFJse5wodP5vUHcSWpHqOlI0mjEEP4vjwUEe',
    'ADMIN',
    4,
    1,
    1
);