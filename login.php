<?php
session_start();
include 'db_connect.php';

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $email = $_POST['email'];
    $user_password = $_POST['password'];

    $stmt = $conn->prepare("SELECT * FROM users WHERE email=? LIMIT 1");
    $stmt->bind_param("s", $email);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows == 1) {
        $user = $result->fetch_assoc();

        if ($user['is_verified'] == 0) {
            echo "<script>alert('⚠️ Please verify your email before logging in.'); window.location.href='login.html';</script>";
            exit;
        }

        if (password_verify($user_password, $user['user_password'])) {
            // Store username in localStorage via JS
            $user_name = addslashes($user['user_name']);
            echo "<script>
                    localStorage.setItem('user_name', '$user_name');
                    window.location.href = 'dashboard_page.html';
                  </script>";
            exit();
        } else {
            echo "<script>alert('❌ Invalid password.'); window.location.href='login.html';</script>";
        }
    } else {
        echo "<script>alert('❌ No account found with that email.'); window.location.href='login.html';</script>";
    }
}
?>
