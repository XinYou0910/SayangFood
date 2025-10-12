<?php
include 'db_connect.php';

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $user_id = $_POST["user_id"];
    $item_id = $_POST["item_id"];
    $pickup_location = $_POST["pickup_location"];
    $donation_remark = $_POST["donation_remark"];
    $donation_date = date("Y-m-d");
    $donation_status = "Pending";

    // Get item details before moving
    $item_query = mysqli_query($conn, "SELECT * FROM food_item_inventory WHERE item_id = '$item_id'");
    $item = mysqli_fetch_assoc($item_query);

    if ($item) {
        // Insert into donation table
        $insert_sql = "INSERT INTO donation (user_id, item_id, donation_date, pickup_location, donation_status, donation_remark)
                       VALUES ('$user_id', '$item_id', '$donation_date', '$pickup_location', '$donation_status', '$donation_remark')";
        if (mysqli_query($conn, $insert_sql)) {
            // Option 1️⃣: Delete from inventory (to "move")
            // mysqli_query($conn, "DELETE FROM food_item_inventory WHERE item_id = '$item_id'");

            // Option 2️⃣: Just mark as 'Donated' instead of deleting
            mysqli_query($conn, "UPDATE food_item_inventory SET item_status='Donated' WHERE item_id='$item_id'");

            echo "<script>
                    alert('Donation confirmed! Item moved to donation list.');
                    window.location='donation_list.php';
                  </script>";
        } else {
            echo 'Error inserting donation: ' . mysqli_error($conn);
        }
    } else {
        echo "<script>alert('Item not found.'); window.location='inventory_list.php';</script>";
    }
}
?>
