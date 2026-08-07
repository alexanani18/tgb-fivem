INSERT INTO `workflow_types`
  (`code`, `request_prefix`, `name`, `description`)
VALUES
  (
    'RESIGNATION',
    'RES',
    'Resignation Request',
    'Employee resignation workflow'
  )
ON DUPLICATE KEY UPDATE
  `request_prefix` = VALUES(`request_prefix`),
  `name` = VALUES(`name`),
  `description` = VALUES(`description`);


INSERT INTO `workflow_statuses`
  (`code`, `name`, `display_order`)
VALUES
  ('PENDING', 'Pending', 1),
  ('APPROVED', 'Approved', 2),
  ('REJECTED', 'Rejected', 3),
  ('CANCELLED', 'Cancelled', 4)
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `display_order` = VALUES(`display_order`);
