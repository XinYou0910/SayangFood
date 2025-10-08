<?php
include 'db_connect.php';

if ($_SERVER["REQUEST_METHOD"] === "POST") {
    $email = $_POST['email'];
    $code  = $_POST['code'];

    $stmt = $conn->prepare("SELECT verification_code FROM users WHERE email=? AND is_verified=0");
    $stmt->bind_param("s", $email);
    $stmt->execute();
    $stmt->bind_result($db_code);
    $stmt->fetch();
    $stmt->close();

    if ($db_code && $db_code === $code) {
        $update = $conn->prepare("UPDATE users SET is_verified=1 WHERE email=?");
        $update->bind_param("s", $email);
        $update->execute();
        echo "✅ Your account has been verified! <a href='login.html'>Login Now</a>";
    } else {
        echo "❌ Invalid or expired verification code.";
    }
} else {
    echo "⚠️ Please submit the form.";
}
?>
