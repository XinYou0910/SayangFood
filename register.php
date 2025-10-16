<?php
include 'db_connect.php';
require __DIR__ . '/vendor/autoload.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $user_name = trim($_POST['user_name']);
    $email = strtolower(trim($_POST['email']));
    $user_password = trim($_POST['password']);
    $household_size = !empty($_POST['household_size']) ? $_POST['household_size'] : null;

    // ⚠️ Basic validation
    if (empty($user_name) || empty($email) || empty($user_password)) {
        echo "<script>alert('⚠️ Please fill in all required fields.'); window.history.back();</script>";
        exit;
    }

    // ⚠️ Validate email format
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        echo "<script>alert('❌ Invalid email address format. Please enter a valid email.'); window.history.back();</script>";
        exit;
    }

    // ⚠️ Validate password length
    if (strlen($user_password) < 8) {
        echo "<script>alert('⚠️ Password must be at least 8 characters long.'); window.history.back();</script>";
        exit;
    }

    // 🧩 Check if email already exists
    $check_stmt = $conn->prepare("SELECT email FROM users WHERE email = ?");
    $check_stmt->bind_param("s", $email);
    $check_stmt->execute();
    $check_stmt->store_result();

    if ($check_stmt->num_rows > 0) {
        echo "<script>alert('⚠️ This email address is already registered. Please use another email or log in.'); window.history.back();</script>";
        $check_stmt->close();
        $conn->close();
        exit;
    }
    $check_stmt->close();

    // ✅ Generate 6-digit verification code
    $verification_code = str_pad(rand(0, 999999), 6, '0', STR_PAD_LEFT);

    // ✅ Insert user (unverified)
    $stmt = $conn->prepare("
        INSERT INTO users (user_name, email, user_password, household_size, verification_code, is_verified, two_factor_enabled)
        VALUES (?, ?, ?, ?, ?, 0, 0)
    ");
    if ($stmt === false) {
        die("❌ SQL error: " . $conn->error);
    }

    $stmt->bind_param("sssss", $user_name, $email, $user_password, $household_size, $verification_code);

    if ($stmt->execute()) {
        // ✉️ Send verification email
        $mail = new PHPMailer(true);
        try {
            $mail->isSMTP();
            $mail->Host = 'smtp.gmail.com';
            $mail->SMTPAuth = true;
            $mail->Username = 'pxypxy12@gmail.com';
            $mail->Password = 'fqpr niqh uspd vhaw'; // Gmail app password
            $mail->SMTPSecure = 'tls';
            $mail->Port = 587;

            $mail->setFrom('pxypxy12@gmail.com', 'SayangFood');
            $mail->addAddress($email, $user_name);
            $mail->isHTML(true);
            $mail->Subject = 'SayangFood - Verify Your Account';

            $verify_link = "http://localhost/SayangFood/verify.html?email=$email";

            $mail->Body = "
                <h2>Welcome to SayangFood, $user_name!</h2>
                <p>Thank you for registering your household account.</p>
                <p>Your 6-digit verification code is: <b>$verification_code</b></p>
                <p>Please enter this code on the verification page to activate your account:</p>
                <a href='$verify_link'>Verify My Account</a>
            ";

            $mail->send();

            echo "
            <script>
              alert('✅ Registration successful! Please check your email for the verification code.');
              window.location.href = 'verify.html?email=" . urlencode($email) . "';
            </script>";
            exit;
        } catch (Exception $e) {
            echo "<script>alert('❌ Email could not be sent. Error: {$mail->ErrorInfo}'); window.history.back();</script>";
        }
    } else {
        echo "<script>alert('❌ Database error: " . addslashes($stmt->error) . "'); window.history.back();</script>";
    }

    $stmt->close();
    $conn->close();
} else {
    echo "<script>alert('⚠️ Please submit the form properly.'); window.history.back();</script>";
}
?>
