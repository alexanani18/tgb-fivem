INSERT INTO `workflow_discord_channels` (
  `workflow_type_id`,
  `discord_channel_id`,
  `is_enabled`
)
SELECT
  `id`,
  NULL,
  0
FROM `workflow_types`
WHERE `code` = 'RESIGNATION'
ON DUPLICATE KEY UPDATE
  `workflow_type_id` = VALUES(`workflow_type_id`);
