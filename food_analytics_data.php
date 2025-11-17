<?php
/**
 * food_analytics_data.php
 * Version with:
 *  - range OR custom date filter
 *  - proper counting rules for saved/waste
 *  - cleaned syntax
 */
header('Content-Type: application/json; charset=utf-8');
include 'db_connect.php';

$type  = isset($_GET['type']) ? $_GET['type'] : 'trend';
$range = isset($_GET['range']) ? intval($_GET['range']) : 30;

$startParam = $_GET['start'] ?? null;
$endParam   = $_GET['end'] ?? null;

// --------------------------
// Find the latest expiry_date IN THE DATA
// --------------------------
$maxDateSql = "SELECT MAX(expiry_date) AS max_date FROM food_item_inventory";
$maxRes = $conn->query($maxDateSql);
$maxRow = $maxRes ? $maxRes->fetch_assoc() : null;
$maxExpiryDate = $maxRow['max_date'] ?? date('Y-m-d');

// --------------------------
// Date range calculation
// --------------------------
if ($startParam && $endParam) {
    // Custom calendar range from JS
    $startDate = date('Y-m-d', strtotime($startParam));
    $endDate   = date('Y-m-d', strtotime($endParam));
} else {
    // Quick filter: "last X days" relative to LAST date in the data
    $endDate = $maxExpiryDate;

    // last N days inclusive → subtract (range-1)
    $daysBack = max($range - 1, 0);
    $startDate = date('Y-m-d', strtotime($endDate . " -{$daysBack} days"));
}

// =======================================================
// EXPIRY SOON (next 7 days from today)
// =======================================================
  $expirySoonQuery = "
    SELECT 
      item_name,
      quantity,        -- this already contains '1 kg', '500 g', etc
      expiry_date
    FROM food_item_inventory
    WHERE expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)
      AND item_status NOT IN ('Used', 'Expired', 'Donated')
    ORDER BY expiry_date ASC
    LIMIT 10
  ";

  $expirySoon = [];
  $expiryRes = $conn->query($expirySoonQuery);
  if ($expiryRes) {
      while ($row = $expiryRes->fetch_assoc()) {
          $expirySoon[] = [
              'item_name'   => $row['item_name'],
              'quantity'    => $row['quantity'],   // 👈 no casting, keep the full string
              'expiry_date' => $row['expiry_date']
          ];
      }
  }



// --------------------------
// Check DB connection
// --------------------------
if (!isset($conn) || $conn->connect_error) {
    http_response_code(500);
    echo json_encode([
        'error'   => 'Database connection failed',
        'details' => $conn->connect_error ?? 'No connection'
    ]);
    exit;
}

// =======================================================
// SUMMARY COUNTS
// Food Saved = Used + Planned for Meal
// Food Waste = Expired
// Donation   = Donated
// =======================================================
$summaryQuery = "
  SELECT
    COUNT(CASE WHEN item_status IN ('Used', 'Planned for Meal') THEN 1 END) AS total_saved,
    COUNT(CASE WHEN item_status = 'Expired' THEN 1 END) AS total_waste,
    COUNT(CASE WHEN item_status = 'Donated' THEN 1 END) AS total_donation
  FROM food_item_inventory
  WHERE expiry_date BETWEEN ? AND ?
";

$stmt = $conn->prepare($summaryQuery);
if (!$stmt) {
    http_response_code(500);
    echo json_encode(['error' => 'Prepare failed (summary)', 'details' => $conn->error]);
    exit;
}

$stmt->bind_param("ss", $startDate, $endDate);
$stmt->execute();
$summaryRes = $stmt->get_result();
$summary = $summaryRes->fetch_assoc() ?: [];

$summary = [
    'total_saved'    => (int)($summary['total_saved'] ?? 0),
    'total_waste'    => (int)($summary['total_waste'] ?? 0),
    'total_donation' => (int)($summary['total_donation'] ?? 0)
];

// =======================================================
// TREND DATA
// Saved = Used + Planned for Meal (per day)
// Waste = Expired
// =======================================================
$trendQuery = "
  SELECT 
    DATE(expiry_date) AS date,
    COUNT(CASE WHEN item_status IN ('Used', 'Planned for Meal') THEN 1 END) AS saved,
    COUNT(CASE WHEN item_status = 'Expired' THEN 1 END) AS wasted,
    COUNT(CASE WHEN item_status = 'Donated' THEN 1 END) AS donated,
    COUNT(CASE WHEN item_status = 'Used' THEN 1 END) AS used
  FROM food_item_inventory
  WHERE expiry_date BETWEEN ? AND ?
  GROUP BY DATE(expiry_date)
  ORDER BY date ASC
";

$stmt2 = $conn->prepare($trendQuery);
if (!$stmt2) {
    http_response_code(500);
    echo json_encode(['error' => 'Prepare failed (trend)', 'details' => $conn->error]);
    exit;
}

$stmt2->bind_param("ss", $startDate, $endDate);
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

// =======================================================
// CATEGORY DISTRIBUTION
// =======================================================
$categoryQuery = "
  SELECT 
    item_category AS category,
    COUNT(*) AS count,
    ROUND(
      COUNT(*) * 100.0 / (
        SELECT COUNT(*) 
        FROM food_item_inventory 
        WHERE expiry_date BETWEEN ? AND ?
      ),
      1
    ) AS percentage
  FROM food_item_inventory
  WHERE expiry_date BETWEEN ? AND ?
  GROUP BY item_category
  ORDER BY count DESC
";

$stmt3 = $conn->prepare($categoryQuery);
if (!$stmt3) {
    http_response_code(500);
    echo json_encode(['error' => 'Prepare failed (category)', 'details' => $conn->error]);
    exit;
}

$stmt3->bind_param("ssss", $startDate, $endDate, $startDate, $endDate);
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

// =======================================================
// OUTPUT JSON
// =======================================================
echo json_encode([
    'total_saved'    => $summary['total_saved'],
    'total_waste'    => $summary['total_waste'],
    'total_donation' => $summary['total_donation'],
    'trend'          => $trend,
    'category'       => $category,
    'expiry_soon'    => $expirySoon,
    'debug'          => [
        'start_date' => $startDate,
        'end_date'   => $endDate,
        'range_days' => $range
    ]
], JSON_PRETTY_PRINT);


$conn->close();
?>
