<?php
/**
 * check_meal_plan.php
 * 
 * Checks for meal plans scheduled for tomorrow (within 24 hours from now)
 * and creates notifications for users.
 * 
 * This file should be called periodically via cron job or Windows Task Scheduler.
 * Example: Run daily at 6:00 PM to notify users about tomorrow's meals
 */

include 'db_connect.php';

// Get tomorrow's date
$tomorrow = date('Y-m-d', strtotime('+1 day'));
$today = date('Y-m-d');

// Query for all meal plans scheduled for tomorrow
$sql = "
  SELECT DISTINCT
    mp.meal_id,
    mp.user_id,
    mp.meal_name,
    mp.meal_date,
    mp.meal_slot
  FROM meal_plan mp
  WHERE mp.meal_date = ?
    AND mp.meal_status = 'Planned'
  ORDER BY mp.user_id, mp.meal_slot
";

$stmt = $conn->prepare($sql);
$stmt->bind_param("s", $tomorrow);
$stmt->execute();
$result = $stmt->get_result();

$notificationsCreated = 0;
$errors = [];

while ($row = $result->fetch_assoc()) {
  $user_id = intval($row['user_id']);
  $meal_name = $row['meal_name'];
  $meal_date = $row['meal_date'];
  $meal_slot = $row['meal_slot'];
  $meal_id = intval($row['meal_id']);

  try {
    // Check if we already created a reminder notification for this meal today
    $checkSql = "
      SELECT notification_id FROM notification
      WHERE user_id = ?
        AND notification_type = 'Meal Planning'
        AND message LIKE ?
        AND DATE(timestamp) = ?
      LIMIT 1
    ";
    
    $checkStmt = $conn->prepare($checkSql);
    if (!$checkStmt) {
      throw new Exception("Prepare failed: " . $conn->error);
    }
    
    // Search pattern: look for message mentioning meal name, tomorrow, and the slot
    $searchPattern = "%" . $meal_name . "%tomorrow%";
    $checkStmt->bind_param("iss", $user_id, $searchPattern, $today);
    $checkStmt->execute();
    $checkResult = $checkStmt->get_result();

    // If notification already exists for this meal today, skip
    if ($checkResult->num_rows > 0) {
      error_log("[check_meal_plan] Reminder already created for meal_id=$meal_id, user_id=$user_id today");
      continue;
    }

    // Create the reminder notification
    $notificationMsg = "\"$meal_name\" is planned for tomorrow \"" . ucfirst(strtolower($meal_slot)) . "\"!";
    
    $insertSql = "
      INSERT INTO notification (user_id, notification_type, message, notification_status, timestamp)
      VALUES (?, ?, ?, ?, NOW())
    ";
    
    $insertStmt = $conn->prepare($insertSql);
    if (!$insertStmt) {
      throw new Exception("Prepare failed: " . $conn->error);
    }
    
    $notifStatus = 'Unread';
    $insertStmt->bind_param("isss", $user_id, $type, $notificationMsg, $notifStatus);
    $type = 'Meal Planning';
    
    if (!$insertStmt->execute()) {
      throw new Exception("Execute failed: " . $insertStmt->error);
    }

    $notificationsCreated++;
    error_log("[check_meal_plan] Created reminder for meal_id=$meal_id, user_id=$user_id, message: $notificationMsg");

  } catch (Exception $e) {
    $errMsg = "Failed to create reminder for meal_id={$row['meal_id']}, user_id={$row['user_id']}: " . $e->getMessage();
    error_log("[check_meal_plan] " . $errMsg);
    $errors[] = $errMsg;
  }
}

// Log summary
error_log("[check_meal_plan] Completed: Created $notificationsCreated notifications, " . count($errors) . " errors");

// Return JSON response if called via HTTP
if (php_sapi_name() !== 'cli') {
  header('Content-Type: application/json');
  http_response_code(200);
  echo json_encode([
    'success' => true,
    'notifications_created' => $notificationsCreated,
    'errors' => $errors,
    'message' => "Meal plan reminder check completed. Created $notificationsCreated notifications."
  ]);
}
?>
