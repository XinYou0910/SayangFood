<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SayangFood - Notifications</title>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Serif&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="notification.css">
  <style>/* small inline fallback if needed */</style>
</head>
<body>

  <button class="menu-toggle" onclick="toggleSidebar()">☰</button>

  <!-- Sidebar -->
    <div class="sidebar">
      <div class="logo-container">
        <img src="pic/logo.png" alt="SayangFood Logo" class="logo-img">
        <div class="logo-text">
          <span class="brand">SayangFood</span><br>
          <small>Food Management System</small>
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

      <button class="menu-item active">
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
  <div class="main">
    <div class="header">
      <h1>Notifications</h1>
    </div>

    <div class="controls" style="margin-bottom:18px;display:flex;justify-content:space-between;align-items:center">
      <div>
        <button class="btn-green" id="markAll">Mark All as Read</button>
        <button class="btn-green" id="deleteRead">Delete Read</button>
      </div>
      <div>
        <button class="btn-green" onclick="location.href='inventory_list.php'">Go to Inventory</button>
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

  </div>

  <script src="script.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
  <script>
    // set username from localStorage (same as inventory page)
    document.addEventListener('DOMContentLoaded', function(){
      var username = localStorage.getItem('user_name');
      if(username){
        var el = document.getElementById('username'); if(el) el.textContent = username;
      }
    });

    function toggleDropdown(){
      var el = document.getElementById('dropdownMenu');
      el.classList.toggle('show');
      document.getElementById('arrowIcon').classList.toggle('open');
    }
    function toggleSidebar(){
      document.querySelector('.sidebar').classList.toggle('active');
    }
    function logout(){
      localStorage.removeItem('user_name');
      window.location.href = 'login.html';
    }
  </script>
</body>
</html>
