<?php
session_start();
if (!isset($_SESSION['user_id'])) {
  header('Location: login.html');
  exit;
}
include 'db_connect.php';

// Get current notifications to show the problem
$currentUserId = $_SESSION['user_id'];
$notifSql = "SELECT notification_id, notification_type, message, notification_status FROM notification WHERE user_id = ? LIMIT 5";
$notifStmt = $conn->prepare($notifSql);
$notifStmt->bind_param("i", $currentUserId);
$notifStmt->execute();
$notifResult = $notifStmt->get_result();

// Check table structure
$structSql = "DESCRIBE notification";
$structResult = $conn->query($structSql);

?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Fix Notifications - Diagnostic</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
    .container { max-width: 900px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; }
    h1 { color: #d32f2f; }
    h2 { color: #1976d2; margin-top: 30px; }
    table { border-collapse: collapse; width: 100%; margin: 15px 0; }
    th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
    th { background: #1976d2; color: white; }
    .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 15px 0; }
    .error { background: #f8d7da; border-left: 4px solid #dc3545; padding: 15px; margin: 15px 0; }
    .success { background: #d4edda; border-left: 4px solid #28a745; padding: 15px; margin: 15px 0; }
    code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; font-family: monospace; }
    .sql-box { background: #f4f4f4; border: 1px solid #ddd; padding: 15px; border-radius: 5px; margin: 15px 0; overflow-x: auto; }
    .copy-btn { background: #1976d2; color: white; border: none; padding: 8px 15px; cursor: pointer; border-radius: 4px; margin-top: 10px; }
    .copy-btn:hover { background: #1565c0; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔧 Notifications - Diagnostic & Fix</h1>
    
    <div class="error">
      <strong>❌ PROBLEM IDENTIFIED:</strong> The <code>notification_id</code> column in your <code>notification</code> table 
      is <strong>missing AUTO_INCREMENT and PRIMARY KEY</strong>. This means:
      <ul>
        <li>All notifications have <code>notification_id = 0</code></li>
        <li>When you click View/Mark/Delete, it sends <code>id=0</code> to the server</li>
        <li>Server rejects requests with <code>id=0</code> as invalid</li>
      </ul>
    </div>

    <h2>📊 Your Current Notifications</h2>
    <table>
      <tr>
        <th>notification_id</th>
        <th>Type</th>
        <th>Message</th>
        <th>Status</th>
      </tr>
      <?php while ($row = $notifResult->fetch_assoc()): ?>
      <tr>
        <td><strong><?= htmlspecialchars($row['notification_id']) ?></strong></td>
        <td><?= htmlspecialchars($row['notification_type']) ?></td>
        <td><?= htmlspecialchars(substr($row['message'], 0, 50)) ?>...</td>
        <td><?= htmlspecialchars($row['notification_status']) ?></td>
      </tr>
      <?php endwhile; ?>
    </table>
    <p><strong style="color: #d32f2f;">Notice: All notification_id values are 0!</strong></p>

    <h2>📋 Table Structure</h2>
    <table>
      <tr>
        <th>Field</th>
        <th>Type</th>
        <th>Key</th>
        <th>Extra</th>
      </tr>
      <?php 
      $structResult->data_seek(0);
      while ($col = $structResult->fetch_assoc()): 
      ?>
      <tr>
        <td><?= htmlspecialchars($col['Field']) ?></td>
        <td><?= htmlspecialchars($col['Type']) ?></td>
        <td><?= htmlspecialchars($col['Key'] ?: '(none)') ?></td>
        <td><?= htmlspecialchars($col['Extra'] ?: '(none)') ?></td>
      </tr>
      <?php endwhile; ?>
    </table>
    <p><strong style="color: #d32f2f;">Notice: notification_id has no Key and no AUTO_INCREMENT Extra!</strong></p>

    <h2>🔨 How to Fix</h2>
    <p><strong>Step 1:</strong> Copy the SQL command below</p>
    
    <div class="sql-box">
      <pre id="sqlCommand">-- Backup existing data
CREATE TABLE notification_backup AS SELECT * FROM notification;

-- Drop and recreate table with proper schema
DROP TABLE notification;

CREATE TABLE notification (
  notification_id INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT(11) NOT NULL,
  notification_type VARCHAR(50) NOT NULL,
  message VARCHAR(255) NOT NULL,
  notification_status VARCHAR(20) NOT NULL DEFAULT 'Unread',
  timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Restore data with auto-generated IDs
INSERT INTO notification (user_id, notification_type, message, notification_status, timestamp)
SELECT user_id, notification_type, message, notification_status, timestamp 
FROM notification_backup;</pre>
      <button class="copy-btn" onclick="copySQL()">📋 Copy SQL Command</button>
    </div>

    <p><strong>Step 2:</strong> Open phpMyAdmin and:
      <ol>
        <li>Go to your database</li>
        <li>Click the <strong>SQL</strong> tab at the top</li>
        <li>Paste the command above</li>
        <li>Click <strong>Go</strong> to execute</li>
      </ol>
    </p>

    <p><strong>Step 3:</strong> Refresh this page to verify the fix worked. You should see unique notification_id values.</p>

    <div class="warning">
      <strong>⚠️ IMPORTANT:</strong> Make sure you have created a backup (the script includes <code>notification_backup</code> table). 
      If something goes wrong, your data is saved in that backup table.
    </div>

    <h2>✅ After Running the Fix</h2>
    <p>Once you've run the SQL command, your notifications should:</p>
    <ul>
      <li>✓ Have unique auto-incremented IDs (1, 2, 3, ...)</li>
      <li>✓ Allow View button to fetch notification details</li>
      <li>✓ Allow Mark as Read to update correctly</li>
      <li>✓ Allow Delete to remove notifications</li>
      <li>✓ Allow Mark All as Read and Delete Read Messages to work</li>
    </ul>

    <button onclick="window.location.href='notification1.php'" class="copy-btn" style="background: #28a745; margin-top: 20px;">
      ← Back to Notifications
    </button>
  </div>

  <script>
    function copySQL() {
      const sqlText = document.getElementById('sqlCommand').innerText;
      navigator.clipboard.writeText(sqlText).then(() => {
        alert('✅ SQL command copied to clipboard! Go to phpMyAdmin and paste it.');
      }).catch(err => {
        alert('❌ Failed to copy. Please manually select and copy the SQL above.');
      });
    }
  </script>
</body>
</html>
