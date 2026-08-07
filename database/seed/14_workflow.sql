INSERT INTO `workflow_types`
  (`code`, `name`, `description`)
VALUES
  (
    'RESIGNATION',
    'Resignation Request',
    'Employee resignation workflow'
  )
ON DUPLICATE KEY UPDATE
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
