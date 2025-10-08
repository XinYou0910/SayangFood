<?php
// Include DB connection
include 'db_connect.php';

// Import PHPMailer classes
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

require 'vendor/autoload.php';


// Check if form was submitted
if ($_SERVER["REQUEST_METHOD"] == "POST") {
    // Collect data from form
    $user_name = $_POST['user_name'];
    $email     = $_POST['email'];
    $user_password  = $_POST['password'];
    $address   = $_POST['address'];
    $gender    = $_POST['gender'];
    $age       = $_POST['age'];
    $phone_num = $_POST['phone_num'];

    // Hash password
    $hashed_password = password_hash($user_password, PASSWORD_DEFAULT);

    // Generate 6-digit verification code
    $verification_code = str_pad(rand(0, 999999), 6, '0', STR_PAD_LEFT);

    // Insert user (unverified)
    $stmt = $conn->prepare("INSERT INTO users 
        (user_name, email, user_password, address, gender, age, phone_num, is_public, verification_code, is_verified) 
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, 0)");

    if ($stmt === false) {
        die("❌ Error in SQL: " . $conn->error);
    }

    $stmt->bind_param("sssssiss", 
    $user_name, $email, $hashed_password, $address, $gender, $age, $phone_num, $verification_code
);

    if ($stmt->execute()) {
        // ✅ Send verification email
        $mail = new PHPMailer(true);
        try {
            //Server settings
            $mail->isSMTP();
            $mail->Host       = 'smtp.gmail.com';
            $mail->SMTPAuth   = true;
            $mail->Username   = 'pxypxy12@gmail.com';      // your Gmail
            $mail->Password   = 'fqpr niqh uspd vhaw';        // your Gmail app password
            $mail->SMTPSecure = 'tls';
            $mail->Port       = 587;

            //Recipients
            $mail->setFrom('pxypxy12@gmail.com', 'SayangFood');
            $mail->addAddress($email, $user_name);

            // Content
            $mail->isHTML(true);
            $mail->Subject = 'Welcome to SayangFood - Verify Your Account';
           // build base URL dynamically
            $base_url = "http://localhost/" . basename(__DIR__);
            $verify_link = "http://localhost/SayangFood/verify.php?email=$email&code=$verification_code";


// email body
            $mail->Body = "
                <h2>Welcome to SayangFood, $user_name!</h2>
                <p>Thank you for registering.</p>
                <p>Your 6-digit verification code is: <b>$verification_code</b></p>
                <p>Please go to the verification page and enter your code:</p>
                <a href='http://localhost/SayangFood/verify.html'>Verify My Account</a>
            ";



            $mail->send();
            echo "✅ Registration successful! Please check your email to verify your account.";
        } catch (Exception $e) {
            echo "❌ Email could not be sent. Mailer Error: {$mail->ErrorInfo}";
        }
    } else {
        echo "❌ Error: " . $stmt->error;
    }

    $stmt->close();
    $conn->close();
} else {
    echo "⚠️ Please submit the form.";
}
?>
