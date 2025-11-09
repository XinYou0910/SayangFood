<?php
session_start();
if (!isset($_SESSION['user_id'])) {
  header('Location: login.html');
  exit;
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>SayangFood - Notifications</title>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Serif&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="notification1.css">
</head>
<body>
  <div id="pageContent">
    <button class="menu-toggle" onclick="toggleSidebar()">☰</button>

    <!-- Sidebar -->
    <div class="sidebar">
      <div class="logo-container">
        <img src="pic/logo.png" alt="SayangFood Logo" class="logo-img">
        <div class="logo-text">
          <span class="brand">SayangFood</span><br>
          <small style="font-size: 12px;">Food Management System</small>
        </div>
      </div>

      <button class="menu-item" onclick="location.href='dashboard_page.html'">
        <img src="pic/home.png" alt="Home Icon" class="icon"> Dashboard
      </button>

      <button class="menu-item dropdown-btn" onclick="toggleDropdown()">
        <img src="pic/search.png" class="icon"> Browse Food Items
        <span class="arrow" id="arrowIcon">▼</span>
      </button>

      <div class="dropdown-container" id="dropdownMenu">
        <button class="submenu-item" data-page="inventory_list.php" onclick="window.location.href='inventory_list.php'">Inventory</button>
        <button class="submenu-item" data-page="weekly_meal.php" onclick="window.location.href='weekly_meal.php'">Weekly Meal</button>
        <button class="submenu-item" data-page="donation_list.php" onclick="window.location.href='donation_list.php'">Donations</button>
      </div>

      <button class="menu-item">
        <img src="pic/data-analytics.png" alt="Analytics Icon" class="icon"> Food Analytics
      </button>

      <button class="menu-item">
        <img src="pic/notification.png" alt="Notification Icon" class="icon"> Notification
      </button>

      <div class="profile">
        <img src="pic/user.png" alt="User" class="profile-img">
        <div class="profile-info">
          <p class="username" id="username">User</p>
          <p class="role">User Profile</p>
          <button onclick="logout()" class="logout-btn">Logout</button>
        </div>
      </div>
    </div>

      <!-- Main Content -->
    <div class="main-content">
      <div class="header">
        <h1 style="color: var(--primary-green); font-size: 28px; font-weight: bold; text-shadow: 1px 1px 2px var(--shadow-light);">Notifications</h1>
      </div>
      
      <div class="controls">
        <div class="controls-left" style="display:flex;gap:10px;align-items:center;">
          <button class="action-btn edit-btn" style="min-width:140px;max-width:140px;" onclick="markAllAsRead()">Mark All as Read</button>
          <button class="action-btn edit-btn" style="min-width:140px;max-width:140px;" onclick="deleteReadMessages()">Delete Read Messages</button>
        </div>
      </div>

      <div class="notification-list">
        <div class="notification-card">
          <div class="notification-content">
            <div class="notification-title">Donation Alert</div>
            <div class="notification-message">Donation confirmed (5 food items).</div>
            <div class="notification-actions">
              <a href="#">View</a>
              <a href="#">Mark As Read</a>
              <a href="#">Delete</a>
            </div>
          </div>
          <div class="notification-time">20:12</div>
        </div>

        <div class="notification-card">
          <div class="notification-content">
            <div class="notification-title">Weekly Meal Plan Alert</div>
            <div class="notification-message">It is time for your planned meal!</div>
            <div class="notification-actions">
              <a href="#">View</a>
              <a href="#">Mark As Read</a>
              <a href="#">Delete</a>
            </div>
          </div>
          <div class="notification-time">19:17</div>
        </div>

        <div class="notification-card">
          <div class="notification-content">
            <div class="notification-title">Expiry Alert</div>
            <div class="notification-message">A food item is expiring soon — please check your inventory.</div>
            <div class="notification-actions">
              <a href="#">View</a>
              <a href="#">Mark As Read</a>
              <a href="#">Delete</a>
            </div>
          </div>
          <div class="notification-time">14:55</div>
        </div>
      </div>
      <!-- We'll add notification content here later -->
    </div>
  </div>

<script src="script.js"></script>
<script>
  document.addEventListener("DOMContentLoaded", () => {
    const username = localStorage.getItem("user_name");
    if (username) {
      document.getElementById("username").textContent = username;
    } else {
      window.location.href = "login.html";
    }
  });
</script>

</body>
</html>
