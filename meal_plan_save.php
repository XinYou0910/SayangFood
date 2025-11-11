<?php
// meal_plan_save.php — saves "This Week" rows into meal_plan + meal_plan_item
declare(strict_types=1);
header('Content-Type: application/json');

require __DIR__ . '/db_connect.php';
session_start();
if (!isset($_SESSION['user_id'])) {
  echo json_encode(['ok' => false, 'error' => 'Unauthorized']); exit;
}
$uid = (int) $_SESSION['user_id'];

$in = json_decode(file_get_contents('php://input'), true);
$rows = $in['rows'] ?? [];
if (!is_array($rows) || !$rows) {
  echo json_encode(['ok' => false, 'error' => 'Empty payload']); exit;
}

try {
  $conn->begin_transaction();

  // Insert meal (header)
  $stmtMeal = $conn->prepare("
    INSERT INTO meal_plan (user_id, meal_name, meal_slot, meal_date, meal_status, meal_remark)
    VALUES (?, ?, ?, ?, 'Saved', ?)
  ");

  // Insert ingredient row(s)
  $stmtItem = $conn->prepare("
    INSERT INTO meal_plan_item
      (meal_id, item_id, item_name_snapshot, required_qty_text, availability)
    VALUES (?, ?, ?, ?, ?)
  ");

  // Lookup candidate inventory item_id by name for this user (not used/donated/expired)
  $stmtFindInv = $conn->prepare("
    SELECT item_id
    FROM food_item_inventory
    WHERE user_id = ? AND item_name = ?
      AND item_status NOT IN ('Used', 'Donated')
      AND (expiry_date IS NULL OR expiry_date >= CURDATE())
    ORDER BY expiry_date IS NULL, expiry_date ASC
    LIMIT 1
  ");

  // Optionally mark inventory as "Planned for Meal"
  $stmtPlanInv = $conn->prepare("
    UPDATE food_item_inventory
    SET item_status = 'Planned for Meal'
    WHERE item_id = ? AND user_id = ?
  ");

  $statuses = [];

  foreach ($rows as $r) {
    // minimal validation
    $date   = trim((string)($r['date']   ?? ''));
    $slot   = trim((string)($r['slot']   ?? ''));
    $meal   = trim((string)($r['meal']   ?? ''));
    $item   = trim((string)($r['item']   ?? ''));
    $qtyTxt = trim((string)($r['qty']    ?? ''));
    $remark = trim((string)($r['remark'] ?? ''));

    if ($date === '' || $slot === '' || $meal === '') {
      throw new RuntimeException('Missing required fields (date/slot/meal).');
    }

    // 1) insert meal header
    $stmtMeal->bind_param('issss', $uid, $meal, $slot, $date, $remark);
    $stmtMeal->execute();
    $mealId = (int)$conn->insert_id;

    // Default badge until we check inventory
    $badge = 'Ingredient Insufficient';
    $itemId = null;

    if ($item !== '') {
      // 2) try to map to inventory
      $stmtFindInv->bind_param('is', $uid, $item);
      $stmtFindInv->execute();
      $res = $stmtFindInv->get_result();
      if ($row = $res->fetch_assoc()) {
        $itemId = (int)$row['item_id'];
        $badge = 'Available';
      }

      // 3) insert ingredient row (snapshot name + qty text kept)
      $stmtItem->bind_param('iisss', $mealId, $itemId, $item, $qtyTxt, $badge);
      $stmtItem->execute();

      // 4) optionally flag inventory as planned (soft reservation UI signal)
      if ($itemId) {
        $stmtPlanInv->bind_param('ii', $itemId, $uid);
        $stmtPlanInv->execute();
      }
    } else {
      // insert a blank ingredient row if you still want a line linked to the meal
      // (you can skip this if meals without items shouldn't create item rows)
      $null = null;
      $stmtItem->bind_param('iisss', $mealId, $null, $item, $qtyTxt, $badge);
      $stmtItem->execute();
    }

    $statuses[] = $badge;
  }

  $conn->commit();
  echo json_encode(['ok' => true, 'statuses' => $statuses]);

} catch (Throwable $e) {
  if ($conn->errno) { $conn->rollback(); }
  echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}
