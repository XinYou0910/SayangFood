<?php
session_start();
include 'db_connect.php';

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $email = strtolower(trim($_POST['email']));
    $user_password = trim($_POST['password']);

    // ⚠️ Check empty fields
    if (empty($email) || empty($user_password)) {
        echo "<script>
            alert('⚠️ Please fill in both email and password.');
            window.history.back();
        </script>";
        exit;
    }

    // 🔍 Check if email exists in database
    $stmt = $conn->prepare("SELECT user_id, user_name, user_password, is_verified FROM users WHERE email = ? LIMIT 1");
    $stmt->bind_param("s", $email);
    $stmt->execute();
    $result = $stmt->get_result();

    // ❌ No account found
    if ($result->num_rows === 0) {
        echo "<script>
            alert('⚠️ No account found with that email. Please register first.');
            window.location.href = 'register_page.html';
        </script>";
        exit;
    }

    // ✅ Account found
    $user = $result->fetch_assoc();

    // ⚠️ Not verified yet
    if ((int)$user['is_verified'] === 0) {
        echo "<script>
            alert('⚠️ Your account has not been verified yet. Please check your email.');
            window.history.back();
        </script>";
        exit;
    }

    // 🔐 Check password (plain text version)
    if ($user_password === $user['user_password']) {
        // ✅ Login success
        $_SESSION['user_id'] = $user['user_id'];
        $_SESSION['user_name'] = $user['user_name'];

        echo "<script>
            alert('✅ Login successful! Redirecting to your dashboard...');
            localStorage.setItem('user_name', '" . addslashes($user['user_name']) . "');
            window.location.href = 'dashboard_page.html';
        </script>";
        exit;
    } else {
        // ❌ Incorrect password
        echo "<script>
            alert('❌ Incorrect password. Please try again.');
            window.history.back();
        </script>";
        exit;
    }

    $stmt->close();
    $conn->close();
} else {
    echo "<script>
        alert('⚠️ Please submit the form properly.');
        window.history.back();
    </script>";
}
?>
