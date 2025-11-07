<?php
include 'db_connect.php';

$type = isset($_GET['type']) ? $_GET['type'] : 'trend';
$range = isset($_GET['range']) ? intval($_GET['range']) : 30;

$summaryQuery = "
  SELECT 
    SUM(CASE WHEN status='saved' THEN weight ELSE 0 END) AS total_saved,
    SUM(CASE WHEN status='wasted' THEN weight ELSE 0 END) AS total_waste,
    SUM(CASE WHEN status='used' THEN weight ELSE 0 END) AS total_used,
    COUNT(CASE WHEN status='donated' THEN 1 END) AS total_donation
  FROM food_item_inventory
  WHERE date_added >= DATE_SUB(NOW(), INTERVAL ? DAY)
";
$stmt = $conn->prepare($summaryQuery);
$stmt->bind_param("i", $range);
$stmt->execute();
$summary = $stmt->get_result()->fetch_assoc();

$trendQuery = "
  SELECT DATE(date_added) AS date,
    SUM(CASE WHEN status='saved' THEN weight ELSE 0 END) AS saved,
    SUM(CASE WHEN status='wasted' THEN weight ELSE 0 END) AS wasted
  FROM food_item_inventory
  WHERE date_added >= DATE_SUB(NOW(), INTERVAL ? DAY)
  GROUP BY DATE(date_added)
  ORDER BY date ASC
";
$stmt = $conn->prepare($trendQuery);
$stmt->bind_param("i", $range);
$stmt->execute();
$trend = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

$categoryQuery = "
  SELECT category, 
  ROUND(SUM(weight) / (SELECT SUM(weight) FROM food_item_inventory WHERE date_added >= DATE_SUB(NOW(), INTERVAL ? DAY)) * 100, 1) AS percentage
  FROM food_item_inventory
  WHERE date_added >= DATE_SUB(NOW(), INTERVAL ? DAY)
  GROUP BY category
";
$stmt = $conn->prepare($categoryQuery);
$stmt->bind_param("i", $range);
$stmt->execute();
$category = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

echo json_encode([
  'total_saved' => $summary['total_saved'] ?? 0,
  'total_waste' => $summary['total_waste'] ?? 0,
  'total_used' => $summary['total_used'] ?? 0,
  'total_donation' => $summary['total_donation'] ?? 0,
  'trend' => $trend,
  'category' => $category
]);
?>
