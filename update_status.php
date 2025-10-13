<?php
include 'db_connect.php';

if (isset($_POST['item_id'], $_POST['item_status'])) {
  $item_id = intval($_POST['item_id']);
  $item_status = mysqli_real_escape_string($conn, $_POST['item_status']);

  $query = "UPDATE food_item_inventory 
            SET item_status = '$item_status'
            WHERE item_id = $item_id";

  if (mysqli_query($conn, $query)) {
    echo "success";
  } else {
    echo "error: " . mysqli_error($conn);
  }
}
?>
