<?php
include 'db_connect.php'; // database connection

$query = "SELECT * FROM food_item_inventory";
$result = mysqli_query($conn, $query);
?>