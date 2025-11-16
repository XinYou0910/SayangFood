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

$user_id = isset($_GET['user_id']) ? intval($_GET['user_id']) : 0;
if ($user_id<=0) { echo json_encode(['ok'=>false,'error'=>'missing_user']); exit; }

/*
Plan:
- load user's inventory (only Available items)
- load recipes and their ingredients
- for each recipe compute:
  - total ingredients required
  - how many ingredients are present in inventory
  - the minimum days-to-expiry among matched ingredients
- rank recipes:
  1) those with all ingredients available
  2) those with expiring ingredients sooner (smaller days)
  3) more matched ingredients
Return top N recipes (and a reason/score)
*/

$invSql = "SELECT item_id, item_name, expiry_date, item_status FROM food_item_inventory WHERE user_id=:uid AND item_status IN ('Available','Used','Reserved')";
$stmt = $pdo->prepare($invSql);
$stmt->execute([':uid'=>$user_id]);
$invRows = $stmt->fetchAll();

$inventory = [];
foreach($invRows as $r) {
  $expiryDays = null;
  if (!empty($r['expiry_date'])) {
    $exp = new DateTime($r['expiry_date']);
    $now = new DateTime();
    $interval = $now->diff($exp);
    $expiryDays = (int)$interval->format('%r%a'); // can be negative if expired
  }
  $inventory[] = [
    'item_id'=>$r['item_id'],
    'name'=>$r['item_name'],
    'expiry_days'=>$expiryDays,
    'status'=>$r['item_status']
  ];
}

// load recipes and ingredients
$recipes = [];
$rstmt = $pdo->query("SELECT r.recipe_id, r.recipe_name, ri.ingredient_name
                      FROM recipes r
                      JOIN recipe_ingredient ri ON ri.recipe_id = r.recipe_id
                      ORDER BY r.recipe_id");
while ($row = $rstmt->fetch(PDO::FETCH_ASSOC)) {
  $rid = $row['recipe_id'];
  if (!isset($recipes[$rid])) $recipes[$rid] = ['recipe_id'=>$rid, 'recipe_name'=>$row['recipe_name'], 'ingredients'=>[]];
  $recipes[$rid]['ingredients'][] = $row['ingredient_name'];
}

// match inventory item names with ingredient name (case-insensitive substring)
$matches = [];
foreach ($recipes as $rid => $rec) {
  $total = count($rec['ingredients']);
  $foundCount = 0;
  $minExpiry = PHP_INT_MAX;
  $matchedIngredients = [];
  foreach ($rec['ingredients'] as $ing) {
    $ingLower = mb_strtolower($ing);
    $matched = false;
    foreach ($inventory as $it) {
      if (mb_stripos($it['name'], $ing) !== false || mb_stripos($ing, $it['name']) !== false || mb_strtolower($it['name']) === $ingLower) {
        $matched = true;
        $foundCount++;
        if ($it['expiry_days'] !== null) {
          $minExpiry = min($minExpiry, (int)$it['expiry_days']);
        } else {
          $minExpiry = min($minExpiry, 365); // far future assumed
        }
        $matchedIngredients[] = $it;
        break;
      }
    }
  }
  // if none matched, minExpiry stay large
  if ($minExpiry === PHP_INT_MAX) $minExpiry = 365;

  $score = ($foundCount / max(1,$total)) * 100; // percent matched
  // prioritize recipes that use expiring items: compute priority score
  $priority = ($foundCount===0) ? 0 : ($score * (1 + max(0, (365 - $minExpiry)/365))); // boosts small expiryDays

  $matches[] = [
    'recipe_id'=>$rid,
    'recipe_name'=>$rec['recipe_name'],
    'total_ingredients'=>$total,
    'matched'=>$foundCount,
    'min_expiry_days'=>$minExpiry,
    'score'=>$score,
    'priority'=>$priority
  ];
}

// rank: priority desc, score desc, matched desc
usort($matches, function($a,$b){
  if ($a['priority']==$b['priority']) {
    if ($a['score']==$b['score']) return $b['matched'] - $a['matched'];
    return $b['score'] - $a['score'];
  }
  return ($b['priority'] <=> $a['priority']);
});

echo json_encode(['ok'=>true, 'suggestions'=>array_slice($matches,0,20)]);
exit;
