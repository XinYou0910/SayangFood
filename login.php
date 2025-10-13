<?php
session_start();
include 'db_connect.php';

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $email = strtolower(trim($_POST['email']));
    $user_password = trim($_POST['password']);

    if (empty($email) || empty($user_password)) {
        echo "⚠️ Please fill in both email and password.";
        exit;
    }

    $stmt = $conn->prepare("SELECT user_id, user_name, user_password, is_verified FROM users WHERE email = ? LIMIT 1");
    $stmt->bind_param("s", $email);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows === 1) {
        $user = $result->fetch_assoc();

        if ((int)$user['is_verified'] === 0) {
            echo "⚠️ Your account has not been verified yet.<br>Please check your email.";
            exit;
        }

        if ($user_password === $user['user_password']) {
            $_SESSION['user_id'] = $user['user_id'];
            $_SESSION['user_name'] = $user['user_name'];

            // ✅ Set localStorage and redirect using JS
            echo "
            <script>
              localStorage.setItem('user_name', '" . addslashes($user['user_name']) . "');
              window.location.href = 'dashboard_page.html';
            </script>";
            exit;
        } else {
            echo "❌ Incorrect password. Please try again.";
        }
    } else {
        echo "⚠️ No account found with that email.<br>Would you like to <a href='register_page.html'>create one?</a>";
    }

    $stmt->close();
    $conn->close();
} else {
    echo '⚠️ Please submit the form properly.';
}
?>
