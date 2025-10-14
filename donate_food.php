    <?php
    include 'db_connect.php';

    if ($_SERVER["REQUEST_METHOD"] == "POST") {
        $item_id = $_POST['item_id'];
        $pickup_location = $_POST['pickup_location'];
        $donation_remark = $_POST['donation_remark'];
        $donation_date = date('Y-m-d');

        // Step 1: Get the user_id from the inventory table for this item
        $get_user_query = "SELECT user_id FROM food_item_inventory WHERE item_id = '$item_id'";
        $get_user_result = mysqli_query($conn, $get_user_query);
        
        if ($get_user_result && mysqli_num_rows($get_user_result) > 0) {
            $row = mysqli_fetch_assoc($get_user_result);
            $user_id = $row['user_id'];

            // Step 2: Insert into donation table
            $insert_query = "INSERT INTO donation (user_id, item_id, donation_date, pickup_location, donation_status, donation_remark)
                            VALUES ('$user_id', '$item_id', '$donation_date', '$pickup_location', 'Available', '$donation_remark')";
            
            if (mysqli_query($conn, $insert_query)) {
                // Step 3: Update item status to "Donated" instead of deleting
                $update_query = "UPDATE food_item_inventory SET item_status = 'Donated' WHERE item_id = '$item_id'";
                
                if (mysqli_query($conn, $update_query)) {
                    echo "<script>alert('Donation confirmed! Item marked as Donated and moved to donation list.');
                        window.location.href='donation_list.php';</script>";
                } else {
                    echo "<script>alert('Donation saved, but failed to update item status.');
                        window.location.href='donation_list.php';</script>";
                }
            } else {
                echo "<script>alert('Error occurred while saving donation.'); 
                    window.location.href='inventory_list.php';</script>";
            }
        } else {
            echo "<script>alert('Item not found or user not linked.'); 
                window.location.href='inventory_list.php';</script>";
        }

        mysqli_close($conn);
    }
    ?>
