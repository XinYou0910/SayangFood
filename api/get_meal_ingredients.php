<?php
session_start();
header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'Unauthorized']);
    exit;
}

include '../db_connect.php';
$currentUserId = $_SESSION['user_id'];
$mealId = isset($_GET['meal_id']) ? (int)$_GET['meal_id'] : 0;

if (!$mealId) {
    echo json_encode(['ok' => false, 'error' => 'meal_id required', 'ingredients' => []]);
    exit;
}

try {
    // Fetch meal ingredients
    $sql = "
        SELECT 
            mpi.mp_item_id,
            mpi.item_name_snapshot,
            mpi.required_qty_value,
            mpi.required_qty_unit,
            mpi.required_qty_text,
            fii.item_name,
            fii.expiry_date,
            fii.storage_place,
            mpi.availability
        FROM meal_plan_item mpi
        LEFT JOIN food_item_inventory fii ON fii.item_id = mpi.item_id
        WHERE mpi.meal_id = ?
        ORDER BY mpi.mp_item_id
    ";
    
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new Exception("Prepare failed: " . $conn->error);
    }
    
    $stmt->bind_param("i", $mealId);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $ingredients = [];
    while ($row = $result->fetch_assoc()) {
        $ingredients[] = [
            'item_name_snapshot' => $row['item_name_snapshot'] ?? '',
            'item_name' => $row['item_name'] ?? $row['item_name_snapshot'] ?? '',
            'required_qty_value' => $row['required_qty_value'],
            'required_qty_unit' => $row['required_qty_unit'] ?? '',
            'required_qty_text' => $row['required_qty_text'] ?? '',
            'expiry_date' => $row['expiry_date'] ?? null,
            'storage_place' => $row['storage_place'] ?? null,
            'availability' => $row['availability'] ?? 'Unknown'
        ];
    }
    
    echo json_encode(['ok' => true, 'ingredients' => $ingredients]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => $e->getMessage(), 'ingredients' => []]);
}
?>
