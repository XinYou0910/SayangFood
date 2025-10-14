<?php
include 'db_connect.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  $item_id = $_POST['item_id'];
  $quantity = $_POST['quantityValue'];
  $unit = $_POST['quantityUnit'];
  $expiry_date = $_POST['expiry_date'];
  $category = $_POST['item_category'];
  $storage_place = $_POST['storage_place'];
  $remark = $_POST['item_remark'];
  $status = $_POST['item_status'];

  $query = "UPDATE food_item_inventory 
            SET quantity = '$quantity $unit',
                expiry_date = '$expiry_date',
                item_category = '$category',
                storage_place = '$storage_place',
                item_remark = '$remark',
                item_status = '$status'
            WHERE item_id = '$item_id'";

  if (mysqli_query($conn, $query)) {
    echo "<script>alert('Item updated successfully!'); window.location.href='inventory_list.php';</script>";
  } else {
    echo "Error updating item: " . mysqli_error($conn);
  }
}
?>
