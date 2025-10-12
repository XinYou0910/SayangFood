<?php
include 'db_connect.php';

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $id = $_POST["item_id"]; // 👈 renamed to match DB column
    $item_name = $_POST["item_name"];
    $item_category = $_POST["item_category"];
    $quantity = $_POST["quantity"];
    $expiry_date = $_POST["expiry_date"];
    $storage_place = $_POST["storage_place"];
    $item_remark = $_POST["item_remark"];
    $item_status = $_POST["item_status"];

    $sql = "UPDATE food_item_inventory 
            SET item_name='$item_name',
                item_category='$item_category',
                quantity='$quantity',
                expiry_date='$expiry_date',
                storage_place='$storage_place',
                item_remark='$item_remark',
                item_status='$item_status'
            WHERE item_id='$id'"; // 👈 use your correct column name

    if (mysqli_query($conn, $sql)) {
        echo "<script>alert('Item updated successfully!'); window.location='inventory_list.php';</script>";
    } else {
        echo "Error updating item: " . mysqli_error($conn);
    }
}
?>
