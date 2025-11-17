<?php
// get_inventory.php
// Returns JSON inventory for a given user_id (GET param user_id).
// Usage: api/get_inventory.php?user_id=16

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
  echo json_encode(['ok'=>false, 'error'=>'DB connection failed', 'msg'=>$e->getMessage()]);
  exit;
}

$user_id = isset($_GET['user_id']) ? intval($_GET['user_id']) : 0;
if ($user_id <= 0) {
  echo json_encode(['ok'=>false, 'error'=>'missing_user_id']);
  exit;
}

// Fetch inventory rows for the user; include the raw quantity string and expiry_date
$sql = "SELECT item_id, user_id, item_name, item_category, quantity, expiry_date, item_status, storage_place, item_remark,
               -- optional numeric fields if present
               IFNULL(quantity_value, NULL) AS quantity_value,
               IFNULL(quantity_unit, '') AS quantity_unit,
               IFNULL(planned_qty, 0) AS planned_qty
        FROM food_item_inventory
        WHERE user_id = :uid
        ORDER BY expiry_date ASC, item_name ASC";
$stmt = $pdo->prepare($sql);
$stmt->execute([':uid' => $user_id]);
$rows = $stmt->fetchAll();

echo json_encode(['ok'=>true, 'rows' => $rows]);
