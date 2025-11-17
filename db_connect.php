<?php
// Set timezone for PHP
date_default_timezone_set('Asia/Kuala_Lumpur');

// Database connection for XAMPP
$host     = "localhost";   // XAMPP default
$username = "root";        // XAMPP default MySQL user
$password = "";            // default password is empty
$database = "sayangfood";  // your database name in phpMyAdmin

// Create connection
$conn = new mysqli($host, $username, $password, $database);

// Check connection
if ($conn->connect_error) {
    die("❌ Connection failed: " . $conn->connect_error);
}

// Set MySQL timezone to match PHP
$conn->query("SET time_zone = '+08:00'");
?>
