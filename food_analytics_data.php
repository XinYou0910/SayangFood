<?php
/**
 * food_analytics_data.php
 * Fixed version with proper error handling and data counting
 */
header('Content-Type: application/json; charset=utf-8');
include 'db_connect.php';

$type  = isset($_GET['type']) ? $_GET['type'] : 'trend';
$range = isset($_GET['range']) ? intval($_GET['range']) : 30;

// Check database connection
if (!isset($conn) || $conn->connect_error) {
    http_response_code(500);
    echo json_encode([
        'error'   => 'Database connection failed',
        'details' => $conn->connect_error ?? 'No connection'
    ]);
    exit;
}

// Calculate the date range
$startDate = date('Y-m-d', strtotime("-$range days"));

// ========================
// SUMMARY COUNTS (UPDATED)
// ========================
$summaryQuery = "
  SELECT
    -- Food saved = Used + Planned for Meal
    COUNT(CASE WHEN item_status IN ('Used', 'Planned for Meal') THEN 1 END) AS total_saved,
    -- Food waste = Expired
    COUNT(CASE WHEN item_status = 'Expired' THEN 1 END) AS total_waste,
    -- Donation (unchanged)
    COUNT(CASE WHEN item_status = 'Donated' THEN 1 END) AS total_donation
  FROM food_item_inventory
  WHERE expiry_date >= ?
";

$stmt = $conn->prepare($summaryQuery);
if (!$stmt) {
    http_response_code(500);
    echo json_encode(['error' => 'Prepare failed', 'details' => $conn->error]);
    exit;
}

$stmt->bind_param("s", $startDate);
$stmt->execute();
$summaryRes = $stmt->get_result();
$summary = $summaryRes->fetch_assoc();

// Set defaults if null
$summary = [
    'total_saved'    => (int)($summary['total_saved'] ?? 0),
    'total_waste'    => (int)($summary['total_waste'] ?? 0),
    'total_donation' => (int)($summary['total_donation'] ?? 0)
];

// ======================
// TREND DATA (UPDATED)
// ======================
$trendQuery = "
  SELECT 
    DATE(expiry_date) AS date,
    -- Saved = Used + Planned for Meal (no more Available)
    COUNT(CASE WHEN item_status IN ('Used', 'Planned for Meal') THEN 1 END) AS saved,
    COUNT(CASE WHEN item_status = 'Expired' THEN 1 END) AS wasted,
    COUNT(CASE WHEN item_status = 'Donated' THEN 1 END) AS donated,
    COUNT(CASE WHEN item_status = 'Used' THEN 1 END) AS used
  FROM food_item_inventory
  WHERE expiry_date >= ?
  GROUP BY DATE(expiry_date)
  ORDER BY date ASC
";

$stmt2 = $conn->prepare($trendQuery);
if (!$stmt2) {
    http_response_code(500);
    echo json_encode(['error' => 'Prepare failed (trend)', 'details' => $conn->error]);
    exit;
}

$stmt2->bind_param("s", $startDate);
$stmt2->execute();
$trendRes = $stmt2->get_result();
$trend = [];
while ($row = $trendRes->fetch_assoc()) {
    $trend[] = [
        'date'    => $row['date'],
        'saved'   => (int)$row['saved'],
        'wasted'  => (int)$row['wasted'],
        'donated' => (int)$row['donated'],
        'used'    => (int)$row['used']
    ];
}

// ==========================
// CATEGORY DISTRIBUTION
// ==========================
$categoryQuery = "
  SELECT 
    item_category AS category,
    COUNT(*) AS count,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM food_item_inventory WHERE expiry_date >= ?), 1) AS percentage
  FROM food_item_inventory
  WHERE expiry_date >= ?
  GROUP BY item_category
  ORDER BY count DESC
";

$stmt3 = $conn->prepare($categoryQuery);
if (!$stmt3) {
    http_response_code(500);
    echo json_encode(['error' => 'Prepare failed (category)', 'details' => $conn->error]);
    exit;
}

$stmt3->bind_param("ss", $startDate, $startDate);
$stmt3->execute();
$categoryRes = $stmt3->get_result();
$category = [];
while ($row = $categoryRes->fetch_assoc()) {
    $category[] = [
        'category'   => $row['category'],
        'percentage' => (float)$row['percentage'],
        'count'      => (int)$row['count']
    ];
}

// ==========================
// RETURN JSON RESPONSE
// ==========================
echo json_encode([
    'total_saved'    => $summary['total_saved'],
    'total_waste'    => $summary['total_waste'],
    'total_donation' => $summary['total_donation'],
    'trend'          => $trend,
    'category'       => $category,
    'debug'          => [
        'start_date' => $startDate,
        'range_days' => $range
    ]
], JSON_PRETTY_PRINT);

$conn->close();
?>
