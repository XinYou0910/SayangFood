<?php
header('Content-Type: application/json; charset=utf-8');
session_start();

$user_id = isset($_GET['user_id']) ? intval($_GET['user_id']) : 0;
$date    = isset($_GET['date']) ? $_GET['date'] : date('Y-m-d');

if (!$user_id) {
  echo json_encode(['ok'=>false, 'message'=>'missing user_id']);
  exit;
}

// DB config - change if needed
$host = '127.0.0.1';
$db   = 'sayangfood';
$user = 'root';
$pass = '';
$dsn = "mysql:host=$host;dbname=$db;charset=utf8mb4";

try {
  $pdo = new PDO($dsn, $user, $pass, [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
} catch (Exception $e) {
  echo json_encode(['ok'=>false, 'message'=>'db error', 'detail'=>$e->getMessage()]);
  exit;
}

// fetch meals for user & date
$stmt = $pdo->prepare('SELECT meal_id, meal_name, meal_slot, meal_remark FROM meal_plan WHERE user_id = ? AND meal_date = ? ORDER BY meal_id ASC');
$stmt->execute([$user_id, $date]);
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

$out = [];
if ($rows) {
  // prepare ingredient query against your table meal_plan_item
  $stmt2 = $pdo->prepare('SELECT item_id, item_name_snapshot, required_qty_value, required_qty_unit, required_qty_text, availability FROM meal_plan_item WHERE meal_id = ? ORDER BY mp_item_id ASC');

  foreach ($rows as $r) {
    // normalize slot to capitalized form (frontend maps lower-case prefixes)
    $slot = isset($r['meal_slot']) ? $r['meal_slot'] : '';
    $slot_norm = ucfirst(strtolower($slot));

    $meal = [
      'meal_id'     => $r['meal_id'],
      'meal_name'   => $r['meal_name'],
      'meal_slot'   => $slot_norm,
      'meal_remark' => $r['meal_remark'] ?? '',
      'ingredients' => []
    ];

    // fetch ingredient rows from meal_plan_item (your DB)
    try {
      $stmt2->execute([$r['meal_id']]);
      $ings = $stmt2->fetchAll(PDO::FETCH_ASSOC);
      if ($ings) {
        // map DB column names to what the frontend expects
        $meal['ingredients'] = array_map(function($row){
          return [
            'item_id'    => $row['item_id'] ?? null,
            'name'       => $row['item_name_snapshot'] ?? ($row['item_name'] ?? ''),
            'qty_value'  => $row['required_qty_value'] ?? null,
            'qty_unit'   => $row['required_qty_unit'] ?? ($row['required_qty_unit'] ?? ''),
            'qty_text'   => $row['required_qty_text'] ?? ($row['required_qty_text'] ?? ''),
            'availability' => $row['availability'] ?? null
          ];
        }, $ings);
      }
    } catch (Exception $e) {
      // if ingredient table or columns differ, ignore and return empty ingredients
      $meal['ingredients'] = [];
    }

    $out[] = $meal;
  }
}

echo json_encode(['ok'=>true, 'meals' => $out]);
