<?php
// Include DB connection
include 'db_connect.php';

// Check if form was submitted
if ($_SERVER["REQUEST_METHOD"] == "POST") {
    // Collect data from form
    $user_name = $_POST['user_name'];
    $email     = $_POST['email'];
    $password  = $_POST['password'];
    $address   = $_POST['address'];
    $gender    = $_POST['gender'];
    $age       = $_POST['age'];
    $phone_num = $_POST['phone_num'];

    // Hash the password (secure storage)
    $hashed_password = password_hash($password, PASSWORD_DEFAULT);

    // Prepare SQL insert
    $stmt = $conn->prepare("INSERT INTO users 
        (user_name, email, password, address, gender, age, phone_num, is_public) 
        VALUES (?, ?, ?, ?, ?, ?, ?, 1)");

    if ($stmt === false) {
        die("❌ Error in SQL: " . $conn->error);
    }

    // Bind values (s = string, i = integer)
    $stmt->bind_param("sssssis", 
        $user_name, $email, $hashed_password, $address, $gender, $age, $phone_num
    );

    // Execute query
    if ($stmt->execute()) {
        echo "✅ Registration successful! <a href='login.html'>Click here to login</a>";
    } else {
        echo "❌ Error: " . $stmt->error;
    }

    // Close connections
    $stmt->close();
    $conn->close();
} else {
    echo "⚠️ Please submit the form.";
}
?>
