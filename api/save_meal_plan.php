<?php
// save_meal_plan.php
// Accepts JSON body:
// { user_id:16, meal_date: "2025-10-28", meals: { breakfast: ["Eggs","Cereal"], lunch: [...], dinner: [...], other: [...] } }
// Returns JSON { ok:true, created: { breakfast: id, ... }, message: ...}

header('Content-Type: application/json; charset=utf-8');

$DB_HOST = '127.0.0.1';
$DB_NAME = 'sayangfood';
$DB_USER = 'root';
$DB_PASS = ''; // change to your DB password

try {
  $pdo = new PDO("mysql:host=$DB_HOST;dbname=$DB_NAME;charset=utf8mb4", $DB_USER, $DB_PASS, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
  ]);
} catch (Exception $e) {
  http_response_code(500);
  echo json_encode(['ok'=>false, 'error'=>'DB connect failed', 'msg'=>$e->getMessage()]);
  exit;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input) {
  echo json_encode(['ok'=>false, 'error'=>'invalid_json']);
  exit;
}

$user_id = isset($input['user_id']) ? intval($input['user_id']) : 0;
$meal_date = isset($input['meal_date']) ? $input['meal_date'] : null;
$meals = isset($input['meals']) ? $input['meals'] : null;

if ($user_id <= 0 || !$meal_date || !is_array($meals)) {
  echo json_encode(['ok'=>false, 'error'=>'missing_parameters']);
  exit;
}

try {
  $pdo->beginTransaction();

  // We'll insert a meal_plan row for each non-empty slot. Keep mapping to return.
  $created = [];

  $insertMealSql = "INSERT INTO meal_plan (user_id, meal_name, meal_slot, meal_date, meal_status, meal_remark, created_at)
                    VALUES (:user_id, :meal_name, :meal_slot, :meal_date, 'Planned', :meal_remark, NOW())";
  $insertMealStmt = $pdo->prepare($insertMealSql);

  $insertItemSql = "INSERT INTO meal_plan_item
    (meal_id, item_id, item_name_snapshot, required_qty_value, required_qty_unit, required_qty_text, availability, created_at)
    VALUES (:meal_id, :item_id, :item_name_snapshot, :required_qty_value, :required_qty_unit, :required_qty_text, :availability, NOW())";
  $insertItemStmt = $pdo->prepare($insertItemSql);

  // helper to find an item_id by exact name (first match for this user)
  $findItemStmt = $pdo->prepare("SELECT item_id, quantity AS quantity_text, IFNULL(quantity_value, NULL) AS quantity_value, IFNULL(quantity_unit,'') AS quantity_unit FROM food_item_inventory WHERE user_id=:uid AND item_name=:iname LIMIT 1");

  foreach (['breakfast','lunch','dinner','other'] as $slot) {
    $slotItems = isset($meals[$slot]) && is_array($meals[$slot]) ? $meals[$slot] : [];
    if (count($slotItems) === 0) continue; // skip empty slot

    // create meal_plan parent
    $meal_name = "Plan - " . ucfirst($slot) . " - " . $meal_date;
    $meal_remark = "Auto-saved by planner";
    $insertMealStmt->execute([
      ':user_id' => $user_id,
      ':meal_name' => $meal_name,
      ':meal_slot' => ucfirst($slot),
      ':meal_date' => $meal_date,
      ':meal_remark' => $meal_remark
    ]);
    $meal_id = $pdo->lastInsertId();
    $created[$slot] = $meal_id;

    // insert each item as snapshot (if an inventory match exists, use item_id else null)
    foreach ($slotItems as $itName) {
      // try to find item_id for this user (if present)
      $findItemStmt->execute([':uid' => $user_id, ':iname' => $itName]);
      $found = $findItemStmt->fetch();
      $item_id = $found ? $found['item_id'] : null;
      $qty_val = $found ? $found['quantity_value'] : null;
      $qty_unit = $found ? $found['quantity_unit'] : '';
      $qty_text = $found ? $found['quantity_text'] : null;

      // fallbacks if DB didn't have numeric fields
      $required_qty_value = $qty_val !== null ? $qty_val : null;
      $required_qty_unit = $qty_unit ?: null;
      $required_qty_text = $qty_text ?: null;

      // availability; we mark 'Available' if found, otherwise 'Unknown'
      $availability = $found ? 'Available' : 'Unknown';

      $insertItemStmt->execute([
        ':meal_id' => $meal_id,
        ':item_id' => $item_id,
        ':item_name_snapshot' => $itName,
        ':required_qty_value' => $required_qty_value,
        ':required_qty_unit' => $required_qty_unit,
        ':required_qty_text' => $required_qty_text,
        ':availability' => $availability
      ]);
    }
  }

  $pdo->commit();
  echo json_encode(['ok'=>true, 'created' => $created]);
  exit;

} catch (Exception $e) {
  $pdo->rollBack();
  http_response_code(500);
  echo json_encode(['ok'=>false, 'error'=>'exception', 'msg'=>$e->getMessage()]);
  exit;
}
