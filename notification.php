<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Notification | SayangFood</title>
  <link rel="stylesheet" href="notification.css">
</head>
<body>

  <!-- Sidebar -->
  <div class="sidebar">
    <h2>SayangFood</h2>
    <a href="home.php"><i>🏠</i> Home</a>
    <a href="browse_food.php"><i>🔍</i> Browse Food Items</a>
    <a href="food_analytics.php"><i>📊</i> Food Analytics</a>
    <a href="notification.php" class="active"><i>🔔</i> Notification</a>
    <div class="user-profile">
      <i>👤</i> User Profile
    </div>
  </div>

  <!-- Main Content -->
  <div class="main">
    <h1>Notification</h1>

    <div class="btn-group">
      <button>Mark All As Read</button>
      <button>Delete All Read Message</button>
    </div>

    <!-- Notification Cards -->
    <div class="notification-card">
      <div class="notification-content">
        <div class="notification-title">Donation Alert</div>
        <div class="notification-message">Donation confirm (5 food items).</div>
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
        <div class="notification-message">Food item is expiring soon!</div>
        <div class="notification-actions">
          <a href="#">View</a>
          <a href="#">Mark As Read</a>
          <a href="#">Delete</a>
        </div>
      </div>
      <div class="notification-time">14:55</div>
    </div>

    <div class="notification-card">
      <div class="notification-content">
        <div class="notification-title">Donation Alert</div>
        <div class="notification-message">Donation confirm (2 food items).</div>
        <div class="notification-actions">
          <a href="#">View</a>
          <a href="#">Mark As Read</a>
          <a href="#">Delete</a>
        </div>
      </div>
      <div class="notification-time">07:30</div>
    </div>

  </div>
</body>
</html>
