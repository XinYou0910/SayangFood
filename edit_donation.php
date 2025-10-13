<?php
include 'db_connect.php';

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $donation_id = $_POST["donation_id"];
    $pickup_location = $_POST["pickup_location"];
    $donation_status = $_POST["donation_status"];
    $donation_remark = $_POST["donation_remark"];

    $sql = "UPDATE donation 
            SET pickup_location='$pickup_location',
                donation_status='$donation_status',
                donation_remark='$donation_remark'
            WHERE donation_id='$donation_id'";

    if (mysqli_query($conn, $sql)) {
        echo "<script>alert('Donation details updated successfully!');
              window.location='donation_list.php';</script>";
    } else {
        echo "Error updating record: " . mysqli_error($conn);
    }
}
?>
