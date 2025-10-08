<?php
session_start();
include 'db_connect.php';

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $email = $_POST['email'];
    $user_password = $_POST['password'];

    // Find user by email
    $stmt = $conn->prepare("SELECT * FROM users WHERE email=? LIMIT 1");
    $stmt->bind_param("s", $email);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows == 1) {
        $user = $result->fetch_assoc();

        // Check if verified
        if ($user['is_verified'] == 0) {
            echo "⚠️ Please verify your email before logging in.";
            exit;
        }

        // Check password
        if (password_verify($user_password, $user['user_password'])) {
            $_SESSION['user_id'] = $user['id'];
            $_SESSION['user_name'] = $user['user_name'];
            echo "✅ Login successful! Welcome, " . $user['user_name'];
            // header("Location: dashboard.php"); // redirect to homepage
        } else {
            echo "❌ Invalid password.";
        }
    } else {
        echo "❌ No account found with that email.";
    }
}
?>
