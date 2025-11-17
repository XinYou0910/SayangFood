<?php
session_start();
if (!isset($_SESSION['user_id'])) {
  die('Not logged in');
}
include 'db_connect.php';
$currentUserId = $_SESSION['user_id'];
?>
<!DOCTYPE html>
<html>
<head>
  <title>Debug Notifications</title>
  <style>
    body { font-family: Arial; margin: 20px; }
    table { border-collapse: collapse; margin: 20px 0; }
    th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
    th { background: #f0f0f0; }
  </style>
</head>
<body>

<h2>Your Notifications (user_id = <?= $currentUserId ?>)</h2>

<table>
  <tr>
    <th>notification_id</th>
    <th>user_id</th>
    <th>notification_type</th>
    <th>message</th>
    <th>notification_status</th>
    <th>timestamp</th>
  </tr>
  <?php
    $sql = "SELECT * FROM notification WHERE user_id = ? ORDER BY notification_id DESC LIMIT 20";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("i", $currentUserId);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $count = 0;
    while ($row = $result->fetch_assoc()) {
      $count++;
      echo "<tr>";
      echo "<td>" . htmlspecialchars($row['notification_id']) . "</td>";
      echo "<td>" . htmlspecialchars($row['user_id']) . "</td>";
      echo "<td>" . htmlspecialchars($row['notification_type']) . "</td>";
      echo "<td>" . htmlspecialchars(substr($row['message'], 0, 50)) . "...</td>";
      echo "<td>" . htmlspecialchars($row['notification_status']) . "</td>";
      echo "<td>" . htmlspecialchars($row['timestamp']) . "</td>";
      echo "</tr>";
    }
    
    if ($count === 0) {
      echo "<tr><td colspan='6' style='text-align:center; color: red;'>No notifications found</td></tr>";
    }
  ?>
</table>

<h2>Table Structure</h2>
<pre>
<?php
  $result = $conn->query("DESCRIBE notification");
  while ($row = $result->fetch_assoc()) {
    echo $row['Field'] . " | " . $row['Type'] . " | " . $row['Null'] . " | " . $row['Key'] . " | " . $row['Extra'] . "\n";
  }
?>
</pre>

<h2>What to do:</h2>
<p><strong>If all notification_id values are 0:</strong></p>
<ol>
  <li>Open phpMyAdmin</li>
  <li>Go to your sayangfood database</li>
  <li>Click the SQL tab</li>
  <li>Copy and paste this SQL command:</li>
</ol>

<pre style="background: #f5f5f5; padding: 10px; border-radius: 4px;">
-- Create backup first
CREATE TABLE notification_backup_final AS SELECT * FROM notification;

-- Drop and recreate the notification table with proper AUTO_INCREMENT
DROP TABLE notification;

CREATE TABLE `notification` (
  `notification_id` INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT(11) NOT NULL,
  `notification_type` VARCHAR(50) NOT NULL,
  `message` VARCHAR(255) NOT NULL,
  `notification_status` VARCHAR(20) NOT NULL DEFAULT 'Unread',
  `timestamp` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Restore data from backup (if any rows had non-zero ids, they'll be restored)
INSERT INTO notification (user_id, notification_type, message, notification_status, timestamp)
SELECT user_id, notification_type, message, notification_status, timestamp FROM notification_backup_final;
</pre>

<p><strong>Then come back here and refresh this page to verify notification_id values are now correct.</strong></p>

</body>
</html>
