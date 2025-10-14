<?php
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

// Include PHPMailer files
require 'vendor/autoload.php';
include 'db_connect.php';

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $email = strtolower(trim($_POST['email']));

    if (empty($email)) {
        echo "<script>alert('⚠️ Email not provided. Please try again.'); window.history.back();</script>";
        exit;
    }

    // Check if email exists and not verified
    $stmt = $conn->prepare("SELECT * FROM users WHERE email = ? AND is_verified = 0");
    $stmt->bind_param("s", $email);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows > 0) {
        // Generate new code
        $new_code = rand(100000, 999999);

        // Update the new code
        $update = $conn->prepare("UPDATE users SET verification_code = ? WHERE email = ?");
        $update->bind_param("ss", $new_code, $email);
        $update->execute();

        // Send new code using PHPMailer
        $mail = new PHPMailer(true);
        try {
            // Server settings
            $mail->isSMTP();
            $mail->Host = 'smtp.gmail.com';
            $mail->SMTPAuth = true;
            $mail->Username = 'pxypxy12@gmail.com'; // 🔹 Replace with your Gmail
            $mail->Password = 'fqpr niqh uspd vhaw';   // 🔹 Replace with your Gmail App Password
            $mail->SMTPSecure = 'tls';
            $mail->Port = 587;

            // Recipients
            $mail->setFrom('yourgmail@gmail.com', 'SayangFood');
            $mail->addAddress($email);

            // Content
            $mail->isHTML(true);
            $mail->Subject = 'SayangFood - New Verification Code';
            $mail->Body    = "
                <p>Hi there,</p>
                <p>Your new verification code is: <b>$new_code</b></p>
                <p>Please enter this code on the verification page to activate your account.</p>
                <br>
                <p>Thank you,<br>SayangFood Team</p>
            ";

            $mail->send();

            echo "
            <script>
              alert('✅ A new verification code has been sent to your email!');
              window.history.back();
            </script>";
        } catch (Exception $e) {
            echo "
            <script>
              alert('⚠️ Email could not be sent. Error: {$mail->ErrorInfo}');
              window.history.back();
            </script>";
        }

    } else {
        echo "
        <script>
          alert('⚠️ No unverified account found for this email or it is already verified.');
          window.history.back();
        </script>";
    }

    $stmt->close();
    $conn->close();
} else {
    echo "<script>alert('⚠️ Invalid request.'); window.history.back();</script>";
}
?>
