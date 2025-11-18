<?php
include 'db_connect.php';

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $donation_id = $_POST["donation_id"];
    $pickup_location = $_POST["pickup_location"];
    $donation_status = $_POST["donation_status"];
    $donation_remark = $_POST["donation_remark"];

    // Get previous status and item name for notification
    $prev_sql = "SELECT donation_status, item_id FROM donation WHERE donation_id='$donation_id'";
    $prev_result = mysqli_query($conn, $prev_sql);
    $prev_status = '';
    $item_name = '';
    if ($prev_result && mysqli_num_rows($prev_result) > 0) {
        $prev_row = mysqli_fetch_assoc($prev_result);
        $prev_status = $prev_row['donation_status'];
        $item_id = $prev_row['item_id'];
        $item_name_query = "SELECT item_name FROM food_item_inventory WHERE item_id='$item_id'";
        $item_name_result = mysqli_query($conn, $item_name_query);
        if ($item_name_result && mysqli_num_rows($item_name_result) > 0) {
            $item_row = mysqli_fetch_assoc($item_name_result);
            $item_name = $item_row['item_name'];
        }
    }

    $sql = "UPDATE donation 
            SET pickup_location='$pickup_location',
                donation_status='$donation_status',
                donation_remark='$donation_remark'
            WHERE donation_id='$donation_id'";

    if (mysqli_query($conn, $sql)) {
        // If status changed from Available to Donated, create notification
        if ($prev_status === 'Available' && $donation_status === 'Donated' && !empty($item_name)) {
            $now_timestamp = date('Y-m-d H:i:s');
            // Get user_id for notification
            $user_id_query = "SELECT user_id FROM donation WHERE donation_id='$donation_id'";
            $user_id_result = mysqli_query($conn, $user_id_query);
            $user_id = '';
            if ($user_id_result && mysqli_num_rows($user_id_result) > 0) {
                $user_row = mysqli_fetch_assoc($user_id_result);
                $user_id = $user_row['user_id'];
            }
            if (!empty($user_id)) {
                $notification_type = 'Donation';
                $message = "\"$item_name\" has been donated!";
                $insert_sql = "INSERT INTO notification (user_id, notification_type, message, notification_status, timestamp) VALUES (?, ?, ?, 'Unread', ?)";
                $stmt = $conn->prepare($insert_sql);
                if ($stmt) {
                    $stmt->bind_param('isss', $user_id, $notification_type, $message, $now_timestamp);
                    $stmt->execute();
                    $stmt->close();
                }
            }
        }
        echo "<script>alert('Donation details updated successfully!');
              window.location='donation_list.php';</script>";
    } else {
        echo "Error updating record: " . mysqli_error($conn);
    }
}
?>
