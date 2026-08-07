DELETE FROM `uniforms`;
ALTER TABLE `uniforms` AUTO_INCREMENT = 1;
INSERT INTO `uniforms` (
    `id`,
    `type`,
    `title`
) VALUES
(
    1,
    'FEMALE',
    'Uniformă Fete'
),
(
    2,
    'MALE',
    'Uniformă Băieți'
);