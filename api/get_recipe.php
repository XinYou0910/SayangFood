<?php
header('Content-Type: application/json; charset=utf-8');

$DB_HOST='127.0.0.1'; $DB_NAME='sayangfood'; $DB_USER='root'; $DB_PASS='';

try {
  $pdo = new PDO("mysql:host=$DB_HOST;dbname=$DB_NAME;charset=utf8mb4",$DB_USER,$DB_PASS,[
    PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC
  ]);
} catch (Exception $e) {
  http_response_code(500);
  echo json_encode(['ok'=>false,'error'=>'db','msg'=>$e->getMessage()]);
  exit;
}

$recipe_id = isset($_GET['recipe_id']) ? intval($_GET['recipe_id']) : 0;
if ($recipe_id <= 0) {
  echo json_encode(['ok'=>false,'error'=>'missing_recipe_id']);
  exit;
}

try {
  $stmt = $pdo->prepare("SELECT recipe_id, recipe_name FROM recipes WHERE recipe_id = :rid LIMIT 1");
  $stmt->execute([':rid'=>$recipe_id]);
  $rec = $stmt->fetch();
  if (!$rec) {
    echo json_encode(['ok'=>false,'error'=>'not_found']);
    exit;
  }

  // Fetch ingredients; adapt columns if you store qty/unit differently
  $ist = $pdo->prepare("SELECT id, recipe_id, ingredient_name, qty_text, qty_value, qty_unit FROM recipe_ingredient WHERE recipe_id = :rid ORDER BY id");
  $ist->execute([':rid'=>$recipe_id]);
  $ings = $ist->fetchAll();

  // Normalize nulls
  foreach ($ings as &$i) {
    if (!isset($i['qty_text'])) $i['qty_text'] = null;
    if (!isset($i['qty_value'])) $i['qty_value'] = null;
    if (!isset($i['qty_unit'])) $i['qty_unit'] = null;
  }

  echo json_encode(['ok'=>true, 'recipe'=>[
    'recipe_id'=>$rec['recipe_id'],
    'recipe_name'=>$rec['recipe_name'],
    'ingredients'=>$ings
  ]]);

} catch (Exception $e) {
  http_response_code(500);
  echo json_encode(['ok'=>false,'error'=>'query','msg'=>$e->getMessage()]);
  exit;
}
