<?php
include 'db_connect.php';
header('Content-Type: application/json');

// Initialize response
$response = [
    "totalFoodItems" => 0,
    "expiringSoon" => 0,
    "donationsMade" => 0,
    "foodCategory" => [],
    "expiryStatus" => ["fresh" => 0, "expiring_soon" => 0, "expired" => 0],
    "monthlyTrend" => []
];

// 1️⃣ Food Category
$categoryQuery = "SELECT item_category, COUNT(*) AS count FROM food_item_inventory GROUP BY item_category";
$categoryResult = $conn->query($categoryQuery);
if ($categoryResult) {
    while ($row = $categoryResult->fetch_assoc()) {
        $response["foodCategory"][$row["item_category"]] = (int)$row["count"];
        $response["totalFoodItems"] += (int)$row["count"];
    }
}

// 2️⃣ Expiry Status
$expiryQuery = "
    SELECT 
        SUM(CASE WHEN expiry_date > NOW() THEN 1 ELSE 0 END) AS fresh,
        SUM(CASE WHEN expiry_date BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) AS expiring_soon,
        SUM(CASE WHEN expiry_date < NOW() THEN 1 ELSE 0 END) AS expired
    FROM food_item_inventory";
$expiryResult = $conn->query($expiryQuery);
if ($expiryResult) {
    $row = $expiryResult->fetch_assoc();
    $response["expiryStatus"] = [
        "fresh" => (int)$row["fresh"],
        "expiring_soon" => (int)$row["expiring_soon"],
        "expired" => (int)$row["expired"]
    ];
    $response["expiringSoon"] = (int)$row["expiring_soon"];
}

// 3️⃣ Monthly Trend
$trendQuery = "SELECT DATE_FORMAT(expiry_date, '%M') AS month, COUNT(*) AS count
               FROM food_item_inventory
               GROUP BY MONTH(expiry_date)
               ORDER BY MONTH(expiry_date)";
$trendResult = $conn->query($trendQuery);
if ($trendResult) {
    while ($row = $trendResult->fetch_assoc()) {
        $response["monthlyTrend"][$row["month"]] = (int)$row["count"];
    }
}

// 4️⃣ Donations Made (assuming donations table exists)
$donationQuery = "SELECT COUNT(*) AS count FROM donation";
$donationResult = $conn->query($donationQuery);
if ($donationResult) {
    $row = $donationResult->fetch_assoc();
    $response["donationsMade"] = (int)$row["count"];
}

// Output JSON
echo json_encode($response, JSON_PRETTY_PRINT);
$conn->close();
?>
