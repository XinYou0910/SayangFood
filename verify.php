<?php
include 'db_connect.php';

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    // 🧹 Clean and normalize input
    $email = strtolower(trim($_POST['email']));
    $verification_code = trim($_POST['verification_code']);
    $new_password = trim($_POST['new_password']);

    if (empty($email) || empty($verification_code) || empty($new_password)) {
        die("⚠️ All fields are required.");
    }


    // 🔍 Main query to find unverified account
    $stmt = $conn->prepare("SELECT verification_code FROM users WHERE email = ? AND is_verified = 0");
    $stmt->bind_param("s", $email);
    $stmt->execute();
    $stmt->store_result();

    if ($stmt->num_rows > 0) {
        $stmt->bind_result($db_code);
        $stmt->fetch();

        if ($verification_code === $db_code) {
            $hashed_new_password = password_hash($new_password, PASSWORD_DEFAULT);

            // ✅ Update user and clear verification code
            $update = $conn->prepare("
                UPDATE users 
                SET user_password = ?, is_verified = 1, two_factor_enabled = 1, verification_code = NULL 
                WHERE email = ?
            ");
            $update->bind_param("ss", $hashed_new_password, $email);
            $update->execute();

            echo "✅ Account verified and 2FA activated! <a href='login.html'>Login now</a>.";
        } else {
            echo "❌ Invalid verification code.";
        }
    } else {
        echo "⚠️ No pending verification found for this email.";
    }

    $stmt->close();
    $conn->close();
} else {
    echo "⚠️ Please submit the form properly.";
}
?>
