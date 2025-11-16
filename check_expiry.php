<?php
/**
 * check_expiry.php
 * 
 * This script checks for food items that are:
 * 1. Expiring within 72 hours (3 days) - creates "about to expire" notification
 * 2. Already expired - creates "expired" notification
 * 
 * This script should be called periodically via cron job or task scheduler.
 * It prevents duplicate notifications by checking if one already exists for the same item.
 */

include 'db_connect.php';

// Get current timestamp
$now = new DateTime();
$today = $now->format('Y-m-d');
$now_timestamp = $now->format('Y-m-d H:i:s');

// Get all active food items (not yet used, donated, or marked expired)
$query = "
  SELECT 
    item_id, 
    user_id, 
    item_name, 
    expiry_date
  FROM food_item_inventory
  WHERE item_status NOT IN ('Used', 'Donated', 'Expired')
    AND user_id IS NOT NULL
";

$result = $conn->query($query);

if (!$result) {
  error_log('check_expiry.php - Database query error: ' . $conn->error);
  exit;
}

while ($row = $result->fetch_assoc()) {
  $item_id = $row['item_id'];
  $user_id = $row['user_id'];
  $item_name = $row['item_name'];
  $expiry_date = $row['expiry_date'];

  // Calculate days until expiry
  $expiry = new DateTime($expiry_date);
  $interval = $now->diff($expiry);
  $days_remaining = $interval->days;
  $is_expired = $interval->invert === 1; // invert=1 means expiry is in the past

  // Determine notification type and message
  $notification_type = '';
  $message = '';

  if ($is_expired) {
    // Item has already expired
    $notification_type = 'Inventory';
    $message = "\"$item_name\" is expired!";
  } elseif ($days_remaining <= 3 && $days_remaining >= 0) {
    // Item will expire within 3 days (1, 2, or 3 days remaining)
    $notification_type = 'Inventory';
    $day_word = ($days_remaining === 1) ? 'day' : 'days';
    $message = "\"$item_name\" is going to expire in $days_remaining $day_word! Would you want to plan it as meal or donate it?";
  } else {
    // Item is fine, skip
    continue;
  }

  // Check if notification already exists for this item to prevent duplicates
  // We check for today's notifications for this item
  $check_sql = "
    SELECT notification_id 
    FROM notification
    WHERE user_id = ?
      AND message LIKE CONCAT('%', ?, '%')
      AND DATE(timestamp) = ?
  ";
  $check_stmt = $conn->prepare($check_sql);
  if (!$check_stmt) {
    error_log('check_expiry.php - Prepare error: ' . $conn->error);
    continue;
  }

  $check_stmt->bind_param('iss', $user_id, $item_name, $today);
  $check_stmt->execute();
  $existing = $check_stmt->get_result();

  if ($existing->num_rows > 0) {
    // Notification already exists for this item today, skip
    $check_stmt->close();
    continue;
  }
  $check_stmt->close();

  // Insert the notification
  $insert_sql = "
    INSERT INTO notification 
    (user_id, notification_type, message, notification_status, timestamp)
    VALUES (?, ?, ?, 'Unread', ?)
  ";
  $insert_stmt = $conn->prepare($insert_sql);
  if (!$insert_stmt) {
    error_log('check_expiry.php - Insert prepare error: ' . $conn->error);
    continue;
  }

  $insert_stmt->bind_param('isss', $user_id, $notification_type, $message, $now_timestamp);
  if (!$insert_stmt->execute()) {
    error_log('check_expiry.php - Insert execute error: ' . $insert_stmt->error . ' for user_id=' . $user_id . ', item_id=' . $item_id);
  }
  $insert_stmt->close();
}

$result->free_result();

// Optionally, update item_status to 'Expired' for items past their expiry date
$expire_sql = "
  UPDATE food_item_inventory
  SET item_status = 'Expired'
  WHERE expiry_date < CURDATE()
    AND item_status NOT IN ('Used', 'Donated', 'Expired')
";

if (!$conn->query($expire_sql)) {
  error_log('check_expiry.php - Update status error: ' . $conn->error);
}

// Log successful run
error_log('check_expiry.php completed at ' . date('Y-m-d H:i:s'));

// Return success response (useful if called via AJAX or API)
header('Content-Type: application/json');
echo json_encode(['success' => true, 'message' => 'Expiry check completed']);
?>
