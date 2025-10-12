<?php
include 'db_connect.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // ------------------------------
    // 1️⃣ Retrieve form inputs safely
    // ------------------------------
    $item_name = trim($_POST['item_name']);

    // Handle category (with Other option)
    $item_category = ($_POST['item_category'] === 'Other' && isset($_POST['item_category_other']) && !empty($_POST['item_category_other']))
        ? trim($_POST['item_category_other'])
        : trim($_POST['item_category']);

    // Handle quantity value + unit (with Other option)
    if (isset($_POST['quantityValue']) && isset($_POST['quantityUnit'])) {
        $quantity_value = intval($_POST['quantityValue']);
        $quantity_unit = ($_POST['quantityUnit'] === 'Other' && isset($_POST['customUnit']) && !empty($_POST['customUnit']))
            ? trim($_POST['customUnit'])
            : trim($_POST['quantityUnit']);
        $quantity = $quantity_value . ' ' . $quantity_unit; // e.g. "3 packs" or "2 bottles"
    } else {
        $quantity = '';
    }

    // Handle expiry date
    $expiry_date = $_POST['expiry_date'];

    // Handle storage place (with Other option)
    $storage_place = ($_POST['storage_place'] === 'Other' && isset($_POST['storage_place_other']) && !empty($_POST['storage_place_other']))
        ? trim($_POST['storage_place_other'])
        : trim($_POST['storage_place']);

    // Handle remark
    $item_remark = trim($_POST['item_remark']);

    // Default values
    $user_id = 1; // demo user
    $item_status = 'Available';

    // ------------------------------
    // 2️⃣ Backend validation
    // ------------------------------
    $today = date('Y-m-d');

    // Check for empty required fields
    if (empty($item_name) || empty($item_category) || empty($quantity) || empty($expiry_date) || empty($storage_place)) {
        echo "<script>alert('Please fill in all required fields.'); window.history.back();</script>";
        exit();
    }

    // Expiry date validation
    if ($expiry_date < $today) {
        echo "<script>alert('Expiry date cannot be earlier than today.'); window.history.back();</script>";
        exit();
    }

    // Quantity validation (must not be 0 or negative)
    if (preg_match('/^0+\s*/', $quantity)) {
        echo "<script>alert('Quantity must be greater than 0.'); window.history.back();</script>";
        exit();
    }

    // ------------------------------
    // 3️⃣ Insert record into database
    // ------------------------------
    $sql = "INSERT INTO food_item_inventory 
            (user_id, item_name, item_category, quantity, expiry_date, item_status, storage_place, item_remark)
            VALUES 
            ('$user_id', '$item_name', '$item_category', '$quantity', '$expiry_date', '$item_status', '$storage_place', '$item_remark')";

    if (mysqli_query($conn, $sql)) {
        echo "<script>alert('✅ New food item added successfully!'); window.location.href='inventory_list.php';</script>";
        exit();
    } else {
        echo "<script>alert('❌ Error adding item: " . mysqli_error($conn) . "'); window.history.back();</script>";
        exit();
    }
}
?>
