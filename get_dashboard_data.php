<?php
include 'db_connect.php';
session_start();
header('Content-Type: application/json');

// Check if user is logged in
if (!isset($_SESSION['user_id'])) {
    echo json_encode(["error" => "User not logged in"]);
    exit;
}

$user_id = $_SESSION['user_id'];

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
$categoryQuery = "SELECT item_category, COUNT(*) AS count 
                  FROM food_item_inventory 
                  WHERE user_id = ?
                  GROUP BY item_category";
$stmt = $conn->prepare($categoryQuery);
$stmt->bind_param("i", $user_id);
$stmt->execute();
$categoryResult = $stmt->get_result();
while ($row = $categoryResult->fetch_assoc()) {
    $response["foodCategory"][$row["item_category"]] = (int)$row["count"];
    $response["totalFoodItems"] += (int)$row["count"];
}
$stmt->close();

// 2️⃣ Expiry Status
$expiryQuery = "
    SELECT 
        SUM(CASE WHEN expiry_date > NOW() THEN 1 ELSE 0 END) AS fresh,
        SUM(CASE WHEN expiry_date BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) AS expiring_soon,
        SUM(CASE WHEN expiry_date < NOW() THEN 1 ELSE 0 END) AS expired
    FROM food_item_inventory
    WHERE user_id = ?";
$stmt = $conn->prepare($expiryQuery);
$stmt->bind_param("i", $user_id);
$stmt->execute();
$expiryResult = $stmt->get_result();
if ($row = $expiryResult->fetch_assoc()) {
    $response["expiryStatus"] = [
        "fresh" => (int)$row["fresh"],
        "expiring_soon" => (int)$row["expiring_soon"],
        "expired" => (int)$row["expired"]
    ];
    $response["expiringSoon"] = (int)$row["expiring_soon"];
}
$stmt->close();

// 3️⃣ Monthly Trend
$trendQuery = "SELECT DATE_FORMAT(expiry_date, '%M') AS month, COUNT(*) AS count
               FROM food_item_inventory
               WHERE user_id = ?
               GROUP BY MONTH(expiry_date)
               ORDER BY MONTH(expiry_date)";
$stmt = $conn->prepare($trendQuery);
$stmt->bind_param("i", $user_id);
$stmt->execute();
$trendResult = $stmt->get_result();
while ($row = $trendResult->fetch_assoc()) {
    $response["monthlyTrend"][$row["month"]] = (int)$row["count"];
}
$stmt->close();

// 4️⃣ Donations Made
$donationQuery = "SELECT COUNT(*) AS count FROM donation WHERE user_id = ?";
$stmt = $conn->prepare($donationQuery);
$stmt->bind_param("i", $user_id);
$stmt->execute();
$donationResult = $stmt->get_result();
if ($row = $donationResult->fetch_assoc()) {
    $response["donationsMade"] = (int)$row["count"];
}
$stmt->close();

echo json_encode($response, JSON_PRETTY_PRINT);
$conn->close();
?>
