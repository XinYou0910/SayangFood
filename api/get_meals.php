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
foreach ($rows as $r) {
  $meal = [
    'meal_id' => $r['meal_id'],
    'meal_name' => $r['meal_name'],
    'meal_slot' => $r['meal_slot'],
    'meal_remark' => $r['meal_remark'],
    'ingredients' => []
  ];

  // fetch meal_plan_item rows and join to food_item_inventory to get expiry/storage if available
  $stmt2 = $pdo->prepare('
    SELECT 
      mpi.mp_item_id AS mp_item_id,
      mpi.item_id,
      mpi.item_name_snapshot,
      mpi.required_qty_value,
      mpi.required_qty_unit,
      mpi.required_qty_text,
      mpi.availability,
      fi.quantity_value AS inv_quantity_value,
      fi.quantity_unit  AS inv_quantity_unit,
      fi.quantity       AS inv_quantity_text,
      fi.expiry_date,
      fi.storage_place
    FROM meal_plan_item mpi
    LEFT JOIN food_item_inventory fi ON mpi.item_id = fi.item_id AND fi.user_id = :uid
    WHERE mpi.meal_id = :mid
    ORDER BY mpi.mp_item_id ASC
  ');
  $stmt2->execute([':mid' => $r['meal_id'], ':uid' => $user_id]);
  $ings = $stmt2->fetchAll(PDO::FETCH_ASSOC);
  if ($ings) $meal['ingredients'] = $ings;

  $out[] = $meal;
}

echo json_encode(['ok'=>true, 'meals' => $out]);
exit;
