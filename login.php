<?php
session_start();
include 'db_connect.php';

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $email = trim($_POST['email']);
    $user_password = trim($_POST['password']);

    if (empty($email) || empty($user_password)) {
        echo "⚠️ Please fill in both email and password.";
        exit;
    }

    // Find user by email
    $stmt = $conn->prepare("SELECT * FROM users WHERE email = ? LIMIT 1");
    $stmt->bind_param("s", $email);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows === 1) {
        $user = $result->fetch_assoc();

        // Check verification
        if ($user['is_verified'] == 0) {
            echo "⚠️ Your account is not verified yet.<br>
                  Please check your email for the verification link.";
            exit;
        }

        // Check password
        if (password_verify($user_password, $user['user_password'])) {
            // ✅ Successful login
            $_SESSION['user_id'] = $user['user_id'];
            $_SESSION['user_name'] = $user['user_name'];

            echo "✅ Login successful! Welcome back, " . htmlspecialchars($user['user_name']) . ".";
            // header("Location: dashboard.php");
            exit;
        } else {
            // ❌ Wrong password
            echo "❌ Incorrect password. Please try again or reset it <a href='forgot_password.html'>here</a>.";
        }
    } else {
        // ❌ No account found
        echo "⚠️ No account found with that email.<br>
              Would you like to <a href='register_page.html'>create one?</a>";
    }

    $stmt->close();
    $conn->close();
} else {
    echo "⚠️ Please submit the form properly.";
}
?>
