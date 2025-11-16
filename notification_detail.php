<?php
session_start();
if (!isset($_SESSION['user_id'])) {
  http_response_code(401);
  echo json_encode(['error' => 'Unauthorized']);
  exit;
}

include 'db_connect.php';
$currentUserId = $_SESSION['user_id'];
$notificationId = isset($_GET['id']) ? (int)$_GET['id'] : 0;

if (!$notificationId) {
  http_response_code(400);
  echo json_encode(['error' => 'Notification ID is required']);
  exit;
}

// Fetch notification details
$notifSql = "SELECT * FROM notification WHERE notification_id = ? AND user_id = ?";
$notifStmt = $conn->prepare($notifSql);
$notifStmt->bind_param("ii", $notificationId, $currentUserId);
$notifStmt->execute();
$notifResult = $notifStmt->get_result();

if ($notifResult->num_rows === 0) {
  http_response_code(404);
  echo json_encode(['error' => 'Notification not found']);
  exit;
}

$notification = $notifResult->fetch_assoc();
$notifType = trim($notification['notification_type'] ?? '');

// Parse message to extract item_id or other identifiers
// Notification messages format:
// Inventory: "itemname" is going to expire in X day(s)! or "itemname" is expired!
// Donation: "itemname" is ready for donation! or "itemname" has been donated!

$message = $notification['message'];
// Extract item name from message (assuming it's quoted or at the beginning)
$itemName = '';
if (preg_match('/"([^"]+)"/', $message, $matches)) {
  $itemName = $matches[1];
}

$responseData = [
  'notification_id' => $notification['notification_id'],
  'notification_type' => $notification['notification_type'],
  'message' => $notification['message'],
  'timestamp' => $notification['timestamp'],
  'notification_status' => $notification['notification_status'],
  'extracted_item_name' => $itemName
];

// Based on notification type, fetch related item details
if (strcasecmp($notifType, 'Inventory') === 0) {
  // Fetch from food_item_inventory using item_name and user_id
  $inventorySql = "SELECT * FROM food_item_inventory WHERE user_id = ? AND item_name = ? LIMIT 1";
  $inventoryStmt = $conn->prepare($inventorySql);
  $inventoryStmt->bind_param("is", $currentUserId, $itemName);
  $inventoryStmt->execute();
  $inventoryResult = $inventoryStmt->get_result();

  if ($inventoryResult->num_rows > 0) {
    $item = $inventoryResult->fetch_assoc();
    $responseData['item_data'] = $item;
    $responseData['item_type'] = 'inventory';
  } else {
    $responseData['item_data'] = null;
    $responseData['item_type'] = 'inventory';
    $responseData['error'] = 'Food item details not found. The item may have been deleted.';
  }
} elseif (strcasecmp($notifType, 'Donation') === 0) {
  // Fetch from donation table using item_name
  // First, get item_id from food_item_inventory
  $inventorySql = "SELECT item_id FROM food_item_inventory WHERE user_id = ? AND item_name = ? LIMIT 1";
  $inventoryStmt = $conn->prepare($inventorySql);
  $inventoryStmt->bind_param("is", $currentUserId, $itemName);
  $inventoryStmt->execute();
  $inventoryResult = $inventoryStmt->get_result();

  if ($inventoryResult->num_rows > 0) {
    $inventoryRow = $inventoryResult->fetch_assoc();
    $itemId = $inventoryRow['item_id'];

    // Now fetch donation record
    $donationSql = "
      SELECT d.*, f.item_name, f.quantity, f.expiry_date
      FROM donation d
      JOIN food_item_inventory f ON f.item_id = d.item_id
      WHERE d.user_id = ? AND d.item_id = ?
      LIMIT 1
    ";
    $donationStmt = $conn->prepare($donationSql);
    $donationStmt->bind_param("ii", $currentUserId, $itemId);
    $donationStmt->execute();
    $donationResult = $donationStmt->get_result();

    if ($donationResult->num_rows > 0) {
      $donation = $donationResult->fetch_assoc();
      $responseData['item_data'] = $donation;
      $responseData['item_type'] = 'donation';
    } else {
      $responseData['item_data'] = null;
      $responseData['item_type'] = 'donation';
      $responseData['error'] = 'Donation details not found. The donation may have been deleted.';
    }
  } else {
    $responseData['item_data'] = null;
    $responseData['item_type'] = 'donation';
    $responseData['error'] = 'Food item details not found. The item may have been deleted.';
  }
} elseif (strcasecmp($notifType, 'Meal Planning') === 0) {
  // Extract meal name and date from message
  // Message formats:
  // "meal_name" has been planned for DD MMM YYYY!
  // "meal_name" is planned for tomorrow "slot"!
  
  $mealName = $itemName; // Already extracted from quoted text
  $mealDate = null;
  $mealSlot = null;

  // Try to extract date from message (format: "DD MMM YYYY")
  if (preg_match('/planned for (\d{1,2}\s+\w+\s+\d{4})/i', $message, $matches)) {
    $dateStr = $matches[1];
    $mealDate = date('Y-m-d', strtotime($dateStr));
  }

  // Try to extract slot from message (format: "tomorrow "slot"")
  if (preg_match('/tomorrow\s+"(\w+)"/i', $message, $matches)) {
    $mealSlot = ucfirst(strtolower($matches[1]));
  }

  // Query meal_plan table
  $mealSql = "
    SELECT * FROM meal_plan
    WHERE user_id = ? AND LOWER(meal_name) = LOWER(?)
    ORDER BY meal_date DESC, meal_id DESC
    LIMIT 1
  ";
  
  $mealStmt = $conn->prepare($mealSql);
  $mealStmt->bind_param("is", $currentUserId, $mealName);
  $mealStmt->execute();
  $mealResult = $mealStmt->get_result();

  if ($mealResult->num_rows > 0) {
    $meal = $mealResult->fetch_assoc();
    $responseData['item_data'] = $meal;
    $responseData['item_type'] = 'meal_plan';
  } else {
    $responseData['item_data'] = null;
    $responseData['item_type'] = 'meal_plan';
    $responseData['error'] = 'Meal plan details not found. The meal plan may have been deleted.';
  }
}

header('Content-Type: application/json');
echo json_encode($responseData);
?>
