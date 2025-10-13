<?php
include 'db_connect.php';

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $email = strtolower(trim($_POST['email']));
    $verification_code = trim($_POST['verification_code']);
    $new_password = trim($_POST['new_password']);

    if (empty($email) || empty($verification_code) || empty($new_password)) {
        die("⚠️ All fields are required.");
    }

    // Find unverified user with matching email
    $stmt = $conn->prepare("SELECT verification_code FROM users WHERE email = ? AND is_verified = 0");
    $stmt->bind_param("s", $email);
    $stmt->execute();
    $stmt->store_result();

    if ($stmt->num_rows > 0) {
        $stmt->bind_result($db_code);
        $stmt->fetch();

        // Compare the entered code
        if ($verification_code === $db_code) {
            // ✅ Update user as verified and save new password
            $update = $conn->prepare("
                UPDATE users 
                SET user_password = ?, is_verified = 1, two_factor_enabled = 1, verification_code = NULL 
                WHERE email = ?
            ");
            $update->bind_param("ss", $new_password, $email);
            $update->execute();

            // ✅ Redirect to login page after success
            echo "
            <script>
              alert('✅ Account verified successfully! Please log in.');
              window.location.href = 'login.html';
            </script>";
            exit;
        } else {
            echo "❌ Invalid verification code. Please try again.";
        }
    } else {
        echo "⚠️ No pending verification found for this email or account already verified.";
    }

    $stmt->close();
    $conn->close();
} else {
    echo "⚠️ Please submit the form properly.";
}
?>
