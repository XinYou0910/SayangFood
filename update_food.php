<?php
include 'db_connect.php';

$item_id = $_POST['item_id'];
$item_name = $_POST['item_name'];
$item_category = $_POST['item_category'];
$quantityValue = $_POST['quantityValue'];
$quantityUnit = $_POST['quantityUnit'];
$expiry_date = $_POST['expiry_date'];
$storage_place = $_POST['storage_place'];
$item_remark = $_POST['item_remark'];
$item_status = $_POST['item_status'];

// ✅ Combine value + unit
$quantity = trim($quantityValue . ' ' . $quantityUnit);

$query = "UPDATE food_item_inventory 
          SET item_name='$item_name',
              item_category='$item_category',
              quantity='$quantity',
              expiry_date='$expiry_date',
              storage_place='$storage_place',
              item_remark='$item_remark',
              item_status='$item_status'
          WHERE item_id='$item_id'";

if (mysqli_query($conn, $query)) {
  header("Location: inventory_list.php");
  exit;
} else {
  echo "Error updating record: " . mysqli_error($conn);
}
?>
