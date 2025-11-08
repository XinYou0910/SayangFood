<?php
/**
 * food_analytics_data.php
 * Returns JSON with basic analytics. Adjusted to actual schema:
 * - uses `item_status`, `expiry_date`, `item_category` and counts items
 * - added error handling and JSON header so front-end can parse reliably
 */
header('Content-Type: application/json; charset=utf-8');
include 'db_connect.php';

$type = isset($_GET['type']) ? $_GET['type'] : 'trend';
$range = isset($_GET['range']) ? intval($_GET['range']) : 30;

// Defensive: ensure $conn exists
if (!isset($conn) || $conn->connect_error) {
    http_response_code(500);
    echo json_encode(['error' => 'Database connection not available', 'details' => $conn->connect_error ?? null]);
    exit;
}

// Summary counts mapped to keys expected by the front-end
$summaryQuery = "
  SELECT
    SUM(CASE WHEN item_status LIKE 'Available' OR item_status LIKE 'Planned%' OR item_status LIKE 'Planned for Meal' THEN 1 ELSE 0 END) AS total_saved,
    SUM(CASE WHEN item_status LIKE 'Expired' THEN 1 ELSE 0 END) AS total_waste,
    SUM(CASE WHEN item_status LIKE 'Used' THEN 1 ELSE 0 END) AS total_used,
    SUM(CASE WHEN item_status LIKE 'Donated' THEN 1 ELSE 0 END) AS total_donation
  FROM food_item_inventory
  WHERE expiry_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
";
$stmt = $conn->prepare($summaryQuery);
if (!$stmt) {
    http_response_code(500);
    echo json_encode(['error' => 'Prepare failed', 'details' => $conn->error]);
    exit;
}
$stmt->bind_param("i", $range);
$stmt->execute();
$summaryRes = $stmt->get_result();
$summary = $summaryRes ? $summaryRes->fetch_assoc() : ['total_saved' => 0, 'total_waste' => 0, 'total_used' => 0, 'total_donation' => 0];

// Trend by expiry_date (since there is no date_added column in schema)
$trendQuery = "
  SELECT expiry_date AS date,
    SUM(CASE WHEN item_status NOT LIKE 'Expired' AND item_status NOT LIKE 'Donated' THEN 1 ELSE 0 END) AS saved,
    SUM(CASE WHEN item_status LIKE 'Expired' THEN 1 ELSE 0 END) AS wasted
  FROM food_item_inventory
  WHERE expiry_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
  GROUP BY expiry_date
  ORDER BY date ASC
";
$stmt2 = $conn->prepare($trendQuery);
if (!$stmt2) {
    http_response_code(500);
    echo json_encode(['error' => 'Prepare failed (trend)', 'details' => $conn->error]);
    exit;
}
$stmt2->bind_param("i", $range);
$stmt2->execute();
$trendRes = $stmt2->get_result();
$trend = $trendRes ? $trendRes->fetch_all(MYSQLI_ASSOC) : [];

// Category distribution (percentage)
$categoryQuery = "
  SELECT item_category AS category,
    ROUND(COUNT(*) / (SELECT GREATEST(COUNT(*),1) FROM food_item_inventory WHERE expiry_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)) * 100, 1) AS percentage
  FROM food_item_inventory
  WHERE expiry_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
  GROUP BY item_category
";
$stmt3 = $conn->prepare($categoryQuery);
if (!$stmt3) {
    http_response_code(500);
    echo json_encode(['error' => 'Prepare failed (category)', 'details' => $conn->error]);
    exit;
}
$stmt3->bind_param("i", $range);
$stmt3->execute();
$categoryRes = $stmt3->get_result();
$category = $categoryRes ? $categoryRes->fetch_all(MYSQLI_ASSOC) : [];

echo json_encode([
  'total_saved' => (int)($summary['total_saved'] ?? 0),
  'total_waste' => (int)($summary['total_waste'] ?? 0),
  'total_used' => (int)($summary['total_used'] ?? 0),
  'total_donation' => (int)($summary['total_donation'] ?? 0),
  'trend' => $trend,
  'category' => $category
]);
?>
