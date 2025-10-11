<?php
include 'db_connect.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $item_name = $_POST['item_name'];
    $item_category = ($_POST['item_category'] === 'Other') ? $_POST['item_category_other'] : $_POST['item_category'];
    $quantity = $_POST['quantity'];
    $expiry_date = $_POST['expiry_date'];
    $storage_place = ($_POST['storage_place'] === 'Other') ? $_POST['storage_place_other'] : $_POST['storage_place'];
    $item_remark = $_POST['item_remark'];

    $user_id = 1;
    $item_status = 'Available';

    $sql = "INSERT INTO food_item_inventory 
    (user_id, item_name, item_category, quantity, expiry_date, item_status, storage_place, item_remark)
    VALUES 
    ('$user_id', '$item_name', '$item_category', '$quantity', '$expiry_date', '$item_status', '$storage_place', '$item_remark')";

    if (mysqli_query($conn, $sql)) {
        header("Location: inventory_list.php");
        exit();
    } else {
        echo "Error: " . mysqli_error($conn);
    }
}
?>
