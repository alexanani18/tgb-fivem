DELETE FROM `user_ranks`;
ALTER TABLE `user_ranks` AUTO_INCREMENT = 1;
INSERT INTO `user_ranks` (`id`, `name`, `sort_order`) VALUES
    (1, 'Blackfold Manager', 1),
    (2, 'Blackfold Specialist', 2),
    (3, 'Blackfold Crew', 3);