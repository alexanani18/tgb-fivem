DELETE FROM `user_roles`;
ALTER TABLE `user_roles` AUTO_INCREMENT = 1;
INSERT INTO `user_roles` (`id`, `name`) VALUES
    (1, 'GUEST'),
    (2, 'ANGAJAT'),
    (3, 'MAFIA'),
    (4, 'ADMIN');