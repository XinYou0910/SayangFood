<?php
include 'db_connect.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

require 'vendor/autoload.php';

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $user_name = trim($_POST['user_name']);
    $email = strtolower(trim($_POST['email']));
    $user_password = trim($_POST['password']);
    $household_size = !empty($_POST['household_size']) ? $_POST['household_size'] : null;

    if (empty($user_name) || empty($email) || empty($user_password)) {
        die("⚠️ Please fill in all required fields.");
    }

    $hashed_password = password_hash($user_password, PASSWORD_DEFAULT);
    $verification_code = str_pad(rand(0, 999999), 6, '0', STR_PAD_LEFT);

    $stmt = $conn->prepare("
        INSERT INTO users (user_name, email, user_password, household_size, verification_code, is_verified, two_factor_enabled)
        VALUES (?, ?, ?, ?, ?, 0, 0)
    ");

    if ($stmt === false) {
        die("❌ SQL error: " . $conn->error);
    }

    $stmt->bind_param("sssss", $user_name, $email, $hashed_password, $household_size, $verification_code);

    if ($stmt->execute()) {
        $mail = new PHPMailer(true);
        try {
            $mail->isSMTP();
            $mail->Host = 'smtp.gmail.com';
            $mail->SMTPAuth = true;
            $mail->Username = 'pxypxy12@gmail.com';
            $mail->Password = 'fqpr niqh uspd vhaw';
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
                <p>Click the link below to verify your account and complete setup:</p>
                <a href='$verify_link'>Verify My Account</a>
            ";

            $mail->send();
            echo "✅ Registration successful! Please check your email for the verification link.";
        } catch (Exception $e) {
            echo "❌ Email could not be sent. Error: {$mail->ErrorInfo}";
        }
    } else {
        echo "❌ Error: " . $stmt->error;
    }

    $stmt->close();
    $conn->close();
} else {
    echo "⚠️ Please submit the form properly.";
}
?>
