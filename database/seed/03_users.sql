INSERT INTO `users` (
  `username`,
  `password_hash`,
  `user_role`,
  `user_role_id`,
  `user_rank_id`,
  `is_active`
)
SELECT
  'admin',
  '$2b$12$yskiE6hSCgxCU7dQvMFJse5wodP5vUHcSWpHqOlI0mjEEP4vjwUEe',
  'ADMIN',
  (SELECT `id` FROM `user_roles` WHERE `name` = 'ADMIN' LIMIT 1),
  (SELECT `id` FROM `user_ranks` WHERE `name` = 'Blackfold Manager' LIMIT 1),
  1
WHERE NOT EXISTS (
  SELECT 1 FROM `users` WHERE `username` = 'admin'
);
