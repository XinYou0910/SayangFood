<?php
// api/add_meal.php
header('Content-Type: application/json; charset=utf-8');

$DB_HOST = '127.0.0.1';
$DB_NAME = 'sayangfood';
$DB_USER = 'root';
$DB_PASS = ''; // change if needed

try {
  $pdo = new PDO("mysql:host=$DB_HOST;dbname=$DB_NAME;charset=utf8mb4", $DB_USER, $DB_PASS, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
  ]);
} catch (Exception $e) {
  http_response_code(500);
  echo json_encode(['ok'=>false, 'error'=>'db_connect','msg'=>$e->getMessage()]);
  exit;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input || !is_array($input)) {
  echo json_encode(['ok'=>false, 'error'=>'invalid_json']);
  exit;
}

$user_id    = isset($input['user_id']) ? intval($input['user_id']) : 0;
$meal_date  = isset($input['meal_date']) ? $input['meal_date'] : null;
$meal_slot  = isset($input['meal_slot']) ? $input['meal_slot'] : null;
$meal_name  = isset($input['meal_name']) ? trim($input['meal_name']) : '';
$remark     = isset($input['remark']) ? trim($input['remark']) : '';
$ingredients= isset($input['ingredients']) && is_array($input['ingredients']) ? $input['ingredients'] : [];

if ($user_id <= 0 || !$meal_date || !$meal_slot || $meal_name === '') {
  echo json_encode(['ok'=>false, 'error'=>'missing_parameters']);
  exit;
}

// Normalizer for numeric qty
function normalize_qty_val($v) {
  if ($v === null || $v === '') return null;
  if (is_numeric($v)) return (float)$v;
  if (preg_match('/([\d.]+)/', (string)$v, $m)) return (float)$m[1];
  return null;
}

try {
  $pdo->beginTransaction();

  // insert meal_plan parent row
  $insertMealSql = "INSERT INTO meal_plan (user_id, meal_name, meal_slot, meal_date, meal_status, meal_remark, created_at)
                    VALUES (:user_id, :meal_name, :meal_slot, :meal_date, 'Planned', :meal_remark, NOW())";
  $stmtMeal = $pdo->prepare($insertMealSql);
  $stmtMeal->execute([
    ':user_id' => $user_id,
    ':meal_name' => $meal_name,
    ':meal_slot' => ucfirst($meal_slot),
    ':meal_date' => $meal_date,
    ':meal_remark' => $remark
  ]);
  $meal_id = $pdo->lastInsertId();

  // prepare item insert
  $insertItemSql = "INSERT INTO meal_plan_item
    (meal_id, item_id, item_name_snapshot, required_qty_value, required_qty_unit, required_qty_text, availability, created_at)
    VALUES (:meal_id, :item_id, :item_name_snapshot, :required_qty_value, :required_qty_unit, :required_qty_text, :availability, NOW())";
  $stmtInsertItem = $pdo->prepare($insertItemSql);

  // lookup statements
  $findByIdStmt = $pdo->prepare("SELECT * FROM food_item_inventory WHERE item_id = :item_id AND user_id = :uid LIMIT 1");
  $findByNameStmt = $pdo->prepare("SELECT * FROM food_item_inventory WHERE user_id = :uid AND LOWER(item_name) LIKE :iname LIMIT 1");

  // update inventory statement (update quantity_value, quantity text and item_status)
  $updateInventoryStmt = $pdo->prepare("UPDATE food_item_inventory
      SET quantity_value = :quantity_value, quantity = :quantity_text, item_status = :item_status
      WHERE item_id = :item_id AND user_id = :uid");

  $itemsInserted = [];
  foreach ($ingredients as $ing) {
    // normalize structure
    $name = isset($ing['name']) ? trim($ing['name']) : '';
    if ($name === '') continue;
    $provided_id = isset($ing['item_id']) && $ing['item_id'] !== '' ? $ing['item_id'] : null;
    $qty_val_raw = $ing['qty_value'] ?? ($ing['qty_value_alt'] ?? ($ing['qty'] ?? ''));
    $qty_unit    = $ing['qty_unit'] ?? ($ing['unit'] ?? '');
    $qty_text    = $ing['qty_text'] ?? ($ing['qty_text_alt'] ?? '');

    $required_qty_value = normalize_qty_val($qty_val_raw);
    $required_qty_unit = $qty_unit ?: null;
    $required_qty_text = $qty_text ?: null;

    // try to find inventory entry
    $found = false;
    $dbrow = null;
    if ($provided_id) {
      $findByIdStmt->execute([':item_id'=>$provided_id, ':uid'=>$user_id]);
      $dbrow = $findByIdStmt->fetch();
      if ($dbrow) $found = true;
    }
    if (!$found) {
      $likeName = '%' . mb_strtolower($name,'UTF-8') . '%';
      $findByNameStmt->execute([':uid'=>$user_id, ':iname'=>$likeName]);
      $dbrow = $findByNameStmt->fetch();
      if ($dbrow) $found = true;
    }

    $availability = $found ? (isset($dbrow['item_status']) ? $dbrow['item_status'] : 'Available') : 'Not found';
    $item_id = $found ? $dbrow['item_id'] : null;

    // If DB has quantity_value and user didn't provide numeric qty_value, we can fallback
    if ($found) {
      if (($required_qty_value === null || $required_qty_value === '') && isset($dbrow['quantity_value']) && $dbrow['quantity_value'] !== null && $dbrow['quantity_value'] !== '') {
        $required_qty_value = normalize_qty_val($dbrow['quantity_value']);
      }
      if ((!$required_qty_unit || $required_qty_unit === '') && isset($dbrow['quantity_unit']) && $dbrow['quantity_unit'] !== '') {
        $required_qty_unit = $dbrow['quantity_unit'];
      }
      if ((!$required_qty_text || $required_qty_text === '') && isset($dbrow['quantity']) && $dbrow['quantity'] !== '') {
        $required_qty_text = $dbrow['quantity'];
      }
    }

    // insert meal_plan_item
    $stmtInsertItem->execute([
      ':meal_id' => $meal_id,
      ':item_id' => $item_id,
      ':item_name_snapshot' => $name,
      ':required_qty_value' => $required_qty_value,
      ':required_qty_unit'  => $required_qty_unit,
      ':required_qty_text'  => $required_qty_text,
      ':availability'       => $availability
    ]);
    $itemsInserted[] = [
      'item_name' => $name,
      'item_id'   => $item_id,
      'required_qty_value' => $required_qty_value,
      'required_qty_unit'  => $required_qty_unit,
      'availability' => $availability
    ];

    // Now deduct inventory quantity_value if possible
    if ($found && $item_id !== null && $required_qty_value !== null && is_numeric($required_qty_value)) {
      // get current numeric quantity_value
      $current_num = null;
      if (isset($dbrow['quantity_value']) && $dbrow['quantity_value'] !== null && $dbrow['quantity_value'] !== '') {
        $current_num = floatval($dbrow['quantity_value']);
      } else {
        // try to parse from quantity text
        if (!empty($dbrow['quantity']) && preg_match('/([\d.]+)/', $dbrow['quantity'], $m)) {
          $current_num = floatval($m[1]);
        }
      }
      if ($current_num !== null) {
        $new_qty = $current_num - floatval($required_qty_value);
        if ($new_qty <= 0) {
          $new_qty = 0;
          $new_status = 'Used';
        } else {
          $new_status = isset($dbrow['item_status']) ? $dbrow['item_status'] : 'Available';
        }

        // build a friendly quantity text (preserve unit if available)
        $unit_text = $required_qty_unit ?: ($dbrow['quantity_unit'] ?? '');
        $new_quantity_text = ($new_qty > 0) ? (rtrim(rtrim((string)$new_qty, '0'), '.') . ($unit_text ? ' ' . $unit_text : '')) : ('0' . ($unit_text ? ' ' . $unit_text : ''));

        $updateInventoryStmt->execute([
          ':quantity_value' => $new_qty,
          ':quantity_text'  => $new_quantity_text,
          ':item_status'    => $new_status,
          ':item_id'        => $item_id,
          ':uid'            => $user_id
        ]);
      }
    }

  } // each ingredient

  $pdo->commit();

  echo json_encode([
    'ok' => true,
    'meal_id' => $meal_id,
    'inserted_items' => $itemsInserted
  ]);
  exit;

} catch (Exception $e) {
  $pdo->rollBack();
  http_response_code(500);
  echo json_encode(['ok'=>false, 'error'=>'exception', 'msg'=>$e->getMessage()]);
  exit;
}
