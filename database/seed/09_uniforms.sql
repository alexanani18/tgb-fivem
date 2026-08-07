INSERT IGNORE INTO `uniforms` (
  `type`, `title`, `image_path`, `store_name`,
  `shoes_rack`, `pants_rack`, `jacket_rack`, `hat_rack`, `updated_by`
) VALUES
  ('FEMALE', 'Uniformă Fete', 'uniforms/uniform-1.png', 'Suburban', 45, 175, 1936, 18, NULL),
  ('MALE', 'Uniformă Băieți', 'uniforms/uniform-2.png', 'Suburban', 620, 178, 1932, 18, NULL);
