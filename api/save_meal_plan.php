<?php
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
  echo json_encode(['ok'=>false, 'error'=>'DB connect failed', 'msg'=>$e->getMessage()]);
  exit;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input) {
  echo json_encode(['ok'=>false, 'error'=>'invalid_json']);
  exit;
}

$user_id  = isset($input['user_id']) ? intval($input['user_id']) : 0;
$meal_date = isset($input['meal_date']) ? $input['meal_date'] : null;
$meals     = isset($input['meals']) ? $input['meals'] : null;

if ($user_id <= 0 || !$meal_date || !is_array($meals)) {
  echo json_encode(['ok'=>false, 'error'=>'missing_parameters']);
  exit;
}

try {
  $pdo->beginTransaction();

  // prepare statements
  $insertMealSql = "INSERT INTO meal_plan (user_id, meal_name, meal_slot, meal_date, meal_status, meal_remark, created_at)
                    VALUES (:user_id, :meal_name, :meal_slot, :meal_date, 'Planned', :meal_remark, NOW())";
  $insertMealStmt = $pdo->prepare($insertMealSql);

  $insertItemSql = "INSERT INTO meal_plan_item
    (meal_id, item_id, item_name_snapshot, required_qty_value, required_qty_unit, required_qty_text, availability, created_at)
    VALUES (:meal_id, :item_id, :item_name_snapshot, :required_qty_value, :required_qty_unit, :required_qty_text, :availability, NOW())";
  $insertItemStmt = $pdo->prepare($insertItemSql);

  // lookup by item_id (fast)
  $findByIdStmt = $pdo->prepare("SELECT item_id, item_name, quantity, quantity_value, quantity_unit, item_status FROM food_item_inventory WHERE item_id = :item_id AND user_id = :uid LIMIT 1");

  // lookup by exact/like name (case-insensitive)
  $findByNameStmt = $pdo->prepare("SELECT item_id, item_name, quantity, quantity_value, quantity_unit, item_status FROM food_item_inventory WHERE user_id = :uid AND LOWER(item_name) LIKE :iname LIMIT 1");

  $created = [];
  $inserted_items = [];

  // helper to sanitize/normalize qty value
  function normalize_qty_val($v) {
    if ($v === null || $v === '') return null;
    // cast numeric strings to float if possible
    if (is_numeric($v)) return (float)$v;
    // try to extract numeric prefix
    if (preg_match('/([\d.]+)/', $v, $m)) return (float)$m[1];
    return null;
  }

  // Iterate slots
  foreach (['breakfast','lunch','dinner','other'] as $slot) {
    $slotItems = isset($meals[$slot]) && is_array($meals[$slot]) ? $meals[$slot] : [];
    if (count($slotItems) === 0) continue;

    // create meal_plan parent row
    // meal_name: if the payload item has a meal name string, we can use first item snapshot name or a default
    // We'll set a descriptive meal_name: "Planner - {Slot} - {date}" by default
    $meal_name = "Planner - " . ucfirst($slot) . " - " . $meal_date;
    // If the user sent a top-level remark for the slot? we check first item snapshot for remark.
    $meal_remark = "Planned from Meal Planner";

    $insertMealStmt->execute([
      ':user_id' => $user_id,
      ':meal_name' => $meal_name,
      ':meal_slot' => ucfirst($slot),
      ':meal_date' => $meal_date,
      ':meal_remark' => $meal_remark
    ]);
    $meal_id = $pdo->lastInsertId();
    $created[$slot] = $meal_id;
    $inserted_items[$slot] = 0;

    // each entry in slotItems may be:
    // - a string (meal name only) : we will attempt to find that item in DB by exact name
    // - an object: { name: "...", snapshot: { ingredients: [...] } }
    // - an object representing an ingredient itself (legacy) - handle carefully
    foreach ($slotItems as $entry) {
      // If entry is a plain string, create one meal_plan_item with that name (no qty)
      // BUT more likely your payload will include snapshot with ingredients; so entry may represent a meal (with list of ingredients) instead.
      // We'll support two cases:
      // 1) entry is string -> try find inventory item with that name and create single meal_plan_item snapshot
      // 2) entry is object && entry.snapshot && entry.snapshot.ingredients -> loop ingredients and insert meal_plan_item rows
      // 3) entry is object representing ingredient directly (rare) -> handle like 1 ingredient

      // Helper to insert one ingredient item snapshot row
      $insertIngredient = function($meal_id, $ingredient, $user_id, $pdo, $findByIdStmt, $findByNameStmt, $insertItemStmt) use (&$inserted_items, $slot) {
        // ingredient must have at least name; qty_value, qty_unit, qty_text optional; item_id optional
        $iname = isset($ingredient['name']) ? trim($ingredient['name']) : '';
        if ($iname === '') return false;

        $provided_id = isset($ingredient['item_id']) && $ingredient['item_id'] !== '' ? $ingredient['item_id'] : null;
        $qty_text = isset($ingredient['qty_text']) ? trim($ingredient['qty_text']) : (isset($ingredient['qty_text_alt']) ? trim($ingredient['qty_text_alt']) : '');
        $qty_unit = isset($ingredient['qty_unit']) ? trim($ingredient['qty_unit']) : (isset($ingredient['unit']) ? trim($ingredient['unit']) : '');
        $qty_value = isset($ingredient['qty_value']) ? $ingredient['qty_value'] : (isset($ingredient['qty_val']) ? $ingredient['qty_val'] : '');

        $required_qty_value = normalize_qty_val($qty_value);
        $required_qty_unit  = $qty_unit ?: null;
        $required_qty_text  = $qty_text ?: null;

        $found = false;
        $db_row = null;

        if ($provided_id) {
          $findByIdStmt->execute([':item_id' => $provided_id, ':uid' => $user_id]);
          $db_row = $findByIdStmt->fetch();
          if ($db_row) $found = true;
        }

        if (!$found) {
          // try by name (case-insensitive substring)
          $likeName = '%' . mb_strtolower($iname, 'UTF-8') . '%';
          $findByNameStmt->execute([':uid' => $user_id, ':iname' => $likeName]);
          $db_row = $findByNameStmt->fetch();
          if ($db_row) $found = true;
        }

        $item_id = $found ? $db_row['item_id'] : null;

        // determine availability
        $availability = 'Unknown';
        if ($found && isset($db_row['item_status'])) {
          $st = strtolower(trim($db_row['item_status']));
          if (strpos($st, 'avail') !== false) $availability = 'Available';
          elseif (strpos($st, 'expir') !== false) $availability = 'Expired';
          else $availability = ucfirst($db_row['item_status']);
        } else {
          $availability = 'Not found';
        }

        // If DB has a numeric quantity_value and we didn't receive one, prefer DB's value
        if ($found) {
          if (($required_qty_value === null || $required_qty_value === '') && isset($db_row['quantity_value']) && $db_row['quantity_value'] !== null && $db_row['quantity_value'] !== '') {
            $required_qty_value = normalize_qty_val($db_row['quantity_value']);
          }
          if ((!$required_qty_unit || $required_qty_unit === '') && isset($db_row['quantity_unit']) && $db_row['quantity_unit'] !== null && $db_row['quantity_unit'] !== '') {
            $required_qty_unit = $db_row['quantity_unit'];
          }
          if ((!$required_qty_text || $required_qty_text === '') && isset($db_row['quantity']) && $db_row['quantity'] !== null && $db_row['quantity'] !== '') {
            $required_qty_text = $db_row['quantity'];
          }
        }

        // execute insert
        $insertItemStmt->execute([
          ':meal_id' => $meal_id,
          ':item_id' => $item_id,
          ':item_name_snapshot' => $iname,
          ':required_qty_value' => $required_qty_value,
          ':required_qty_unit'  => $required_qty_unit,
          ':required_qty_text'  => $required_qty_text,
          ':availability'       => $availability
        ]);

        $inserted_items[$slot] = ($inserted_items[$slot] ?? 0) + 1;
        return true;
      }; // end insertIngredient

      // CASE A: entry is a string -> treat as single ingredient (name)
      if (is_string($entry)) {
        $ingredient = ['name' => $entry];
        $insertIngredient($meal_id, $ingredient, $user_id, $pdo, $findByIdStmt, $findByNameStmt, $insertItemStmt);
        continue;
      }

      // CASE B: entry is object
      if (is_array($entry)) {
        // If it looks like a meal object with snapshot.ingredients
        if (isset($entry['snapshot']) && is_array($entry['snapshot'])) {
          // if snapshot has remark and contains a friendly meal name, update meal_remark and meal_name if present
          $snap = $entry['snapshot'];
          if (isset($snap['remark']) && $snap['remark'] !== '') {
            // update meal_plan.remark for this meal row
            $upd = $pdo->prepare("UPDATE meal_plan SET meal_remark = :remark WHERE meal_id = :mid");
            $upd->execute([':remark' => $snap['remark'], ':mid' => $meal_id]);
          }
          if (isset($entry['name']) && trim($entry['name']) !== '') {
            // update meal_name to something more useful
            $upd2 = $pdo->prepare("UPDATE meal_plan SET meal_name = :mname WHERE meal_id = :mid");
            $upd2->execute([':mname' => trim($entry['name']), ':mid' => $meal_id]);
          }
          // Process ingredients (array)
          $ingList = [];
          if (isset($snap['ingredients']) && is_array($snap['ingredients'])) {
            $ingList = $snap['ingredients'];
          } elseif (isset($entry['ingredients']) && is_array($entry['ingredients'])) {
            $ingList = $entry['ingredients'];
          }
          foreach ($ingList as $ing) {
            // normalize ingredient structure
            if (is_string($ing)) {
              $ingObj = ['name' => $ing];
            } elseif (is_array($ing)) {
              // map keys variations
              $ingObj = [
                'name' => $ing['name'] ?? ($ing['item_name'] ?? ''),
                'item_id' => $ing['item_id'] ?? ($ing['id'] ?? null),
                'qty_value' => $ing['qty_value'] ?? $ing['quantity_value'] ?? $ing['required_qty_value'] ?? '',
                'qty_unit'  => $ing['qty_unit'] ?? $ing['quantity_unit'] ?? $ing['required_qty_unit'] ?? '',
                'qty_text'  => $ing['qty_text'] ?? $ing['quantity'] ?? $ing['required_qty_text'] ?? ''
              ];
            } else {
              continue;
            }
            $insertIngredient($meal_id, $ingObj, $user_id, $pdo, $findByIdStmt, $findByNameStmt, $insertItemStmt);
          }
          continue;
        }

        // CASE C: entry is object representing a single ingredient (has name) -> insert it
        if (isset($entry['name'])) {
          $ingObj = [
            'name' => $entry['name'],
            'item_id' => $entry['item_id'] ?? null,
            'qty_value' => $entry['qty_value'] ?? $entry['quantity_value'] ?? '',
            'qty_unit' => $entry['qty_unit'] ?? $entry['quantity_unit'] ?? '',
            'qty_text' => $entry['qty_text'] ?? $entry['quantity'] ?? ''
          ];
          $insertIngredient($meal_id, $ingObj, $user_id, $pdo, $findByIdStmt, $findByNameStmt, $insertItemStmt);
          continue;
        }

        // fallback: skip unknown object shape
        continue;
      }

      // otherwise skip entry
    } // foreach slotItems
  } // foreach slots

  $pdo->commit();

  echo json_encode([
    'ok' => true,
    'created_meals' => $created,
    'items_inserted' => $inserted_items
  ]);
  exit;

} catch (Exception $e) {
  $pdo->rollBack();
  http_response_code(500);
  echo json_encode(['ok'=>false, 'error'=>'exception', 'msg'=>$e->getMessage()]);
  exit;
}