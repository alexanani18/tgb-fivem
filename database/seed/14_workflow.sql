INSERT INTO `workflow_types`
(`code`, `request_prefix`, `name`, `description`)
VALUES
(
  'RESIGNATION',
  'RES',
  'Resignation Request',
  'Employee resignation workflow'
),
(
  'LEAVE',
  'LEV',
  'Leave Request',
  'Employee leave request workflow'
),
(
  'INACTIVITY',
  'INA',
  'Cerere de inactivitate',
  'Cerere de absență pentru o activitate specifică.'
)
ON DUPLICATE KEY UPDATE
  `request_prefix` = VALUES(`request_prefix`),
  `name` = VALUES(`name`),
  `description` = VALUES(`description`);


INSERT INTO `workflow_discord_channels`
(
  `workflow_type_id`,
  `discord_channel_id`,
  `is_enabled`
)
SELECT
  wt.id,
  NULL,
  0
FROM `workflow_types` wt
WHERE wt.code IN (
  'RESIGNATION',
  'LEAVE',
  'INACTIVITY'
)
AND NOT EXISTS (
  SELECT 1
  FROM `workflow_discord_channels` wdc
  WHERE wdc.workflow_type_id = wt.id
);


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
