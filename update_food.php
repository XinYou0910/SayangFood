<?php
include 'db_connect.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  $id = $_POST['id'];
  $quantity = $_POST['quantity'];
  $expiry_date = $_POST['expiry_date'];

  // Auto-update status
  $today = date('Y-m-d');
  $item_status = ($expiry_date < $today) ? 'Expired' : 'Available';

  $sql = "UPDATE food_item_inventory 
          SET quantity = '$quantity', expiry_date = '$expiry_date', item_status = '$item_status'
          WHERE id = '$id'";

  if (mysqli_query($conn, $sql)) {
    echo "success";
  } else {
    echo "error: " . mysqli_error($conn);
  }
}
?>
