<?php
// save_meal_plan.php
header('Content-Type: application/json; charset=utf-8');

// --- DB config: EDIT these to match your environment ---
$dbHost = '127.0.0.1';
$dbName = 'sayangfood';
$dbUser = 'root';       // Change if necessary
$dbPass = '';           // Change if necessary
$dbDsn  = "mysql:host={$dbHost};dbname={$dbName};charset=utf8mb4";

// helper to send JSON and exit
function out($arr) {
    echo json_encode($arr, JSON_UNESCAPED_UNICODE);
    exit;
}

// Read data: prefer $_POST (FormData) but allow raw JSON too
$input = [];

if (!empty($_POST)) {
    $input = $_POST;
} else {
    $raw  = file_get_contents('php://input');
    $json = json_decode($raw, true);
    if (is_array($json)) {
        $input = $json;
    }
}

// Validate required fields
$required = ['user_id', 'meal_date', 'meal_slot', 'meal_name'];
foreach ($required as $r) {
    if (!isset($input[$r]) || trim((string)$input[$r]) === '') {
        out([
            'ok' => false,
            'error_code' => 'missing_parameters',
            'message' => "Missing parameter: $r"
        ]);
    }
}

// Normalize values
$user_id     = intval($input['user_id']);
$meal_date   = trim($input['meal_date']);
$meal_slot   = trim($input['meal_slot']);
$meal_name   = trim($input['meal_name']);
$meal_remark = isset($input['meal_remark']) ? trim($input['meal_remark']) : '';

// Decode ingredients
$ingredients = [];

if (isset($input['ingredients'])) {
    // If ingredients is a JSON string (from FormData)
    if (is_string($input['ingredients'])) {
        $decoded = json_decode($input['ingredients'], true);
        if ($decoded === null && json_last_error() !== JSON_ERROR_NONE) {
            out([
                'ok' => false,
                'error_code' => 'invalid_json',
                'message' => 'Could not parse ingredients JSON'
            ]);
        }
        $ingredients = $decoded;
    }
    // If already decoded
    elseif (is_array($input['ingredients'])) {
        $ingredients = $input['ingredients'];
    }
}

// Ensure ingredients is array
if (!is_array($ingredients)) {
    $ingredients = [];
}

try {
    // Connect to DB
    $pdo = new PDO($dbDsn, $dbUser, $dbPass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);

    $pdo->beginTransaction();

    // Insert into meal_plan
    $stmt = $pdo->prepare("
        INSERT INTO meal_plan (user_id, meal_name, meal_slot, meal_date, meal_status, meal_remark, created_at)
        VALUES (:user_id, :meal_name, :meal_slot, :meal_date, 'Planned', :meal_remark, NOW())
    ");

    $stmt->execute([
        ':user_id'      => $user_id,
        ':meal_name'    => $meal_name,
        ':meal_slot'    => $meal_slot,
        ':meal_date'    => $meal_date,
        ':meal_remark'  => $meal_remark
    ]);

    $meal_id = (int)$pdo->lastInsertId();

    // Insert ingredients
    if (!empty($ingredients)) {
        $stmtItem = $pdo->prepare("
            INSERT INTO meal_plan_item
            (meal_id, item_id, item_name_snapshot, required_qty_value, required_qty_unit, required_qty_text, availability, created_at)
            VALUES (:meal_id, :item_id, :item_name_snapshot, :required_qty_value, :required_qty_unit, :required_qty_text, 'Available', NOW())
        ");

        foreach ($ingredients as $ing) {
            $iname = $ing['name']       ?? $ing['item_name_snapshot'] ?? '';
            $qtyV  = $ing['qty_value']  ?? $ing['required_qty_value'] ?? '';
            $qtyU  = $ing['qty_unit']   ?? $ing['required_qty_unit']  ?? '';
            $iID   = isset($ing['item_id']) ? intval($ing['item_id']) : null;
            $qtyTxt = trim("$qtyV $qtyU");

            $stmtItem->execute([
                ':meal_id'             => $meal_id,
                ':item_id'             => $iID,
                ':item_name_snapshot'  => trim($iname),
                ':required_qty_value'  => $qtyV,
                ':required_qty_unit'   => $qtyU,
                ':required_qty_text'   => $qtyTxt
            ]);
        }
    }

    $pdo->commit();

    out([
        'ok'       => true,
        'meal_id'  => $meal_id,
        'message'  => 'Saved'
    ]);

} catch (PDOException $ex) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    out([
        'ok'         => false,
        'error_code' => 'db_error',
        'message'    => $ex->getMessage()
    ]);

} catch (Exception $ex) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    out([
        'ok'         => false,
        'error_code' => 'unknown_error',
        'message'    => $ex->getMessage()
    ]);
}

