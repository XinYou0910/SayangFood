<?php
session_start();
if (!isset($_SESSION['user_id'])) {
  header('Location: dashboard_page.html'); exit;
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>SayangFood — Meal Plan</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Serif&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="meal_plan.css?v=9"/>
</head>
<body>
  <div id="pageContent">
    <!-- Sidebar -->
    <aside class="sidebar">
      <div class="logo-container">
        <img class="logo-img" src="pic/logo.png" alt="SayangFood"/>
        <div class="logo-text">
          <div class="brand">SayangFood</div>
          <div class="tagline">Food Management System</div>
        </div>
      </div>

      <button class="menu-item" onclick="location.href='dashboard_page.html'">
        <img class="icon" src="pic/home.png" alt=""> Dashboard
      </button>

      <button class="menu-item dropdown-btn">
        <img class="icon" src="pic/search.png" alt=""> Browse Food Items
        <span class="arrow">▾</span>
      </button>

      <div class="dropdown-container show" id="dropdownMenu">
        <button class="submenu-item" onclick="location.href='inventory_list.php'">Inventory</button>
        <button class="submenu-item active" onclick="location.href='meal_plan.php'">Meal Plan</button>
        <button class="submenu-item" onclick="location.href='donation_list.php'">Donations</button>
      </div>

      <button class="menu-item"><img class="icon" src="pic/data-analytics.png" alt=""> Food Analytics</button>
      <button class="menu-item"><img class="icon" src="pic/notification.png"  alt=""> Notification</button>

      <div class="profile">
        <img class="profile-img" src="pic/user.png" alt="">
        <div class="profile-info">
          <p class="username" id="username">User</p>
          <p class="role">User Profile</p>
          <button class="logout-btn" onclick="localStorage.removeItem('user_name');location.href='Homepage.html'">Logout</button>
        </div>
      </div>
    </aside>

    <!-- Main -->
    <main class="main-content">
      <header class="header">
        <h1>Meal Plan</h1>
        <div class="month-under-title" id="monthYear"></div>

        <!-- Date selector bar -->
        <div class="date-bar">
          <button class="calendar-btn" id="calendarBtn" aria-label="Pick a date">📅</button>
          <button class="nav-arrow" id="prevDay" aria-label="Previous day">‹</button>
          <div id="pillsRow" class="pills-row"><!-- filled by JS --></div>
          <input type="date" id="jumpDate" hidden />
        </div>
      </header>

      <section class="board">
        <div class="grid-2">
          <div class="day-card">
            <h3 id="dayTitle"></h3>
            <p class="day-sub">Plan your meals for this day</p>

            <div class="slot-actions">
              <button class="chip" data-add="breakfast">+ Breakfast</button>
              <button class="chip" data-add="lunch">+ Lunch</button>
              <button class="chip" data-add="dinner">+ Dinner</button>
              <button class="chip" data-add="other">+ Other</button>
            </div>

            <div class="slots-2">
              <div class="slot">
                <div class="slot-title">Breakfast</div>
                <div id="slot-breakfast" class="slot-body" contenteditable="true" placeholder="Type meal items…"></div>
              </div>
              <div class="slot">
                <div class="slot-title">Lunch</div>
                <div id="slot-lunch" class="slot-body" contenteditable="true" placeholder="Type meal items…"></div>
              </div>
              <div class="slot">
                <div class="slot-title">Dinner</div>
                <div id="slot-dinner" class="slot-body" contenteditable="true" placeholder="Type meal items…"></div>
              </div>
              <div class="slot">
                <div class="slot-title">Other</div>
                <div id="slot-other" class="slot-body" contenteditable="true" placeholder="Snacks, dessert, etc…"></div>
              </div>
            </div>
          </div>

          <aside class="suggestions">
            <h3>Suggestions</h3>
            <p class="muted">No suggestions right now — add your own meals.</p>
          </aside>
        </div>

        <div class="footer-actions">
          <button class="action-btn primary-btn" id="saveBtn">Save Meal Plan</button>
        </div>
      </section>
    </main>
  </div>

  <script src="meal_plan.js?v=9"></script>
</body>
</html>
