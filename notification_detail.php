<?php
$started = session_start();
header('Content-Type: application/json');
if (!$started || !isset($_SESSION['user_id'])) {
  http_response_code(401);
  error_log("notification_detail.php: Unauthorized access - session_started=" . ($started ? '1' : '0') . "\n");
  echo json_encode(['error' => 'Unauthorized']);
  exit;
}

include 'db_connect.php';
$currentUserId = $_SESSION['user_id'];
error_log("notification_detail.php: called by user_id={$currentUserId}, GET=" . json_encode($_GET) . "\n");
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
// Try to extract quoted name first
if (preg_match('/"([^"]+)"/', $message, $matches)) {
  $itemName = $matches[1];
} else {
  // Fallback: try to capture text before common verbs like ' is ', ' has ', ' will '
  if (preg_match('/^"?([^"\n]+?)"?\s+(is|has|will)\b/i', $message, $m2)) {
    $itemName = trim($m2[1]);
  }
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
    $found = false;
    if (!empty($itemName)) {
      // 1) Exact match with user_id
      $inventorySql = "SELECT * FROM food_item_inventory WHERE user_id = ? AND item_name = ? LIMIT 1";
      $inventoryStmt = $conn->prepare($inventorySql);
      $inventoryStmt->bind_param("is", $currentUserId, $itemName);
      $inventoryStmt->execute();
      $inventoryResult = $inventoryStmt->get_result();
      if ($inventoryResult && $inventoryResult->num_rows > 0) {
        $item = $inventoryResult->fetch_assoc();
        $responseData['item_data'] = $item;
        $responseData['item_type'] = 'inventory';
        $found = true;
      }

      // 2) Exact match ignoring user (fallback if user_id is NULL or different)
      if (!$found) {
        $inventorySql2 = "SELECT * FROM food_item_inventory WHERE item_name = ? LIMIT 1";
        $inventoryStmt2 = $conn->prepare($inventorySql2);
        $inventoryStmt2->bind_param("s", $itemName);
        $inventoryStmt2->execute();
        $inventoryResult2 = $inventoryStmt2->get_result();
        if ($inventoryResult2 && $inventoryResult2->num_rows > 0) {
          $item = $inventoryResult2->fetch_assoc();
          $responseData['item_data'] = $item;
          $responseData['item_type'] = 'inventory';
          $found = true;
        }
      }

      // 3) Case-insensitive LIKE search across item_name (last resort)
      if (!$found) {
        $likeName = '%' . $itemName . '%';
        $fallbackSql = "SELECT * FROM food_item_inventory WHERE LOWER(item_name) LIKE LOWER(?) ORDER BY item_id DESC LIMIT 1";
        $fallbackStmt = $conn->prepare($fallbackSql);
        $fallbackStmt->bind_param("s", $likeName);
        $fallbackStmt->execute();
        $fallbackResult = $fallbackStmt->get_result();
        if ($fallbackResult && $fallbackResult->num_rows > 0) {
          $item = $fallbackResult->fetch_assoc();
          $responseData['item_data'] = $item;
          $responseData['item_type'] = 'inventory';
          $found = true;
        }
      }
    }

    if (!$found) {
      $responseData['item_data'] = null;
      $responseData['item_type'] = 'inventory';
      $responseData['error'] = 'Food item details not found. The item may have been deleted or ownership may differ.';
    }
  } elseif (strcasecmp($notifType, 'Donation') === 0) {
    $foundDonation = false;
    $itemId = null;
    if (!empty($itemName)) {
      // Try to find the inventory item_id by user first
      $inventorySql = "SELECT item_id FROM food_item_inventory WHERE user_id = ? AND item_name = ? LIMIT 1";
      $inventoryStmt = $conn->prepare($inventorySql);
      $inventoryStmt->bind_param("is", $currentUserId, $itemName);
      $inventoryStmt->execute();
      $inventoryResult = $inventoryStmt->get_result();
      if ($inventoryResult && $inventoryResult->num_rows > 0) {
        $inventoryRow = $inventoryResult->fetch_assoc();
        $itemId = $inventoryRow['item_id'];
      } else {
        // fallback: find by name ignoring user
        $inventorySql2 = "SELECT item_id FROM food_item_inventory WHERE item_name = ? LIMIT 1";
        $inventoryStmt2 = $conn->prepare($inventorySql2);
        $inventoryStmt2->bind_param("s", $itemName);
        $inventoryStmt2->execute();
        $inventoryResult2 = $inventoryStmt2->get_result();
        if ($inventoryResult2 && $inventoryResult2->num_rows > 0) {
          $inventoryRow = $inventoryResult2->fetch_assoc();
          $itemId = $inventoryRow['item_id'];
        }
      }
    }

    if (!empty($itemId)) {
      // Fetch donation record preferring donations by this user
      $donationSql = "
        SELECT d.*, f.item_name, f.quantity, f.expiry_date
        FROM donation d
        JOIN food_item_inventory f ON f.item_id = d.item_id
        WHERE d.item_id = ?
        ORDER BY (d.user_id = ?) DESC, d.donation_id DESC
        LIMIT 1
      ";
      $donationStmt = $conn->prepare($donationSql);
      $donationStmt->bind_param("ii", $itemId, $currentUserId);
      $donationStmt->execute();
      $donationResult = $donationStmt->get_result();
      if ($donationResult && $donationResult->num_rows > 0) {
        $donation = $donationResult->fetch_assoc();
        $responseData['item_data'] = $donation;
        $responseData['item_type'] = 'donation';
        $foundDonation = true;
      }
    }

    if (!$foundDonation) {
      $responseData['item_data'] = null;
      $responseData['item_type'] = 'donation';
      $responseData['error'] = 'Donation details not found. The donation may have been deleted or ownership may differ.';
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
