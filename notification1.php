<?php
session_start();
if (!isset($_SESSION['user_id'])) {
  header('Location: login.html');
  exit;
}
include 'db_connect.php';
// Fetch notifications for current user
$currentUserId = $_SESSION['user_id'];
// Use correct table and columns - Sort by timestamp DESC (newest first), then by notification_id DESC for tiebreaker
$sql = "SELECT * FROM notification WHERE user_id = ? ORDER BY timestamp DESC, notification_id DESC";
$stmt = $conn->prepare($sql);
$stmt->bind_param("i", $currentUserId);
$stmt->execute();
$result = $stmt->get_result();
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>SayangFood - Notifications</title>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Serif&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="notification1.css">
  <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
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
        <button class="submenu-item" data-page="meal_plan.php" onclick="window.location.href='meal_plan.php'">Meal Plan</button>
        <button class="submenu-item" data-page="donation_list.php" onclick="window.location.href='donation_list.php'">Donations</button>
      </div>

      <button class="menu-item" onclick="location.href='food_analytics.html'">
        <img src="pic/data-analytics.png" alt="Analytics Icon" class="icon"> Food Analytics
      </button>

      <button class="menu-item" onclick="location.href='notification1.php'">
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
        <?php if ($result->num_rows === 0): ?>
          <div class="no-notifications" style="text-align:center;color:#b00020;font-weight:500;padding:18px;">No new notification</div>
        <?php else: ?>
          <?php while ($row = $result->fetch_assoc()): ?>
          <?php
            $statusClass = '';
            if ($row['notification_status'] === 'Unread') {
              $statusClass = 'notification-unread';
            } elseif ($row['notification_status'] === 'Read') {
              $statusClass = 'notification-read';
            }

            // choose image based on notification type
            $type = trim($row['notification_type'] ?? '');
            $imgSrc = 'pic/notification.png';
            if (strcasecmp($type, 'Inventory') === 0) {
              $imgSrc = 'pic/inventory.png';
            } elseif (strcasecmp($type, 'Donation') === 0) {
              $imgSrc = 'pic/donation.png';
            } elseif (strcasecmp($type, 'Meal Planning') === 0 || strcasecmp($type, 'MealPlanner') === 0 || strcasecmp($type, 'MealPlanning') === 0) {
              $imgSrc = 'pic/mealplanning.png';
            }
          ?>
          <div class="notification-card <?= $statusClass ?>">
            <div class="notification-media">
              <img src="<?= htmlspecialchars($imgSrc) ?>" alt="<?= htmlspecialchars($row['notification_type']) ?>" class="notification-img">
            </div>
            <div class="notification-content">
              <div class="notification-title"><?= htmlspecialchars($row['notification_type']) ?></div>
              <div class="notification-message"><?= htmlspecialchars($row['message']) ?></div>
              <div class="notification-actions">
                <a href="#" class="view-notification" data-id="<?= $row['notification_id'] ?>" data-type="<?= htmlspecialchars($row['notification_type']) ?>">View</a>
                <a href="#" class="mark-read" data-id="<?= $row['notification_id'] ?>">Mark As Read</a>
                <a href="#" class="delete-notification" data-id="<?= $row['notification_id'] ?>">Delete</a>
              </div>
            </div>
            <div class="notification-sidebar">
              <div class="notification-time"><?= date('d M Y, H:i', strtotime($row['timestamp'])) ?></div>
              <?php if ($row['notification_status']): ?>
                <div class="notification-status"><?= htmlspecialchars($row['notification_status']) ?></div>
              <?php endif; ?>
            </div>
          </div>
          <?php endwhile; ?>
        <?php endif; ?>
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

    // View notification (fetch details and open item)
    document.querySelectorAll('.view-notification').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        const notificationId = this.dataset.id;
        const notificationType = this.dataset.type;
        console.log('View clicked:', { notificationId, notificationType, rawId: this.getAttribute('data-id'), element: this });

        // Fetch notification details
        fetch(`notification_detail.php?id=${notificationId}`, { credentials: 'same-origin' })
          .then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
          })
          .then(data => {
            // Check for error first
            if (data.error) {
              Swal.fire({
                icon: 'error',
                title: 'Error',
                text: data.error || 'Unable to fetch item details',
                timer: 3000,
                showConfirmButton: true
              });
              return;
            }

            // Route based on notification type (tolerant matching)
            const notifTypeNormalized = (notificationType || '').toLowerCase().trim();
            let hasValidData = false;

            // Accept variants like 'inventory', 'item', 'food inventory'
            if (notifTypeNormalized.includes('inventory') || notifTypeNormalized.includes('item')) {
              // Go to inventory_list.php and open view popup
              if (data.item_data && Object.keys(data.item_data).length > 0) {
                hasValidData = true;
                sessionStorage.setItem('viewItemData', JSON.stringify(data.item_data));
                sessionStorage.setItem('shouldOpenViewPopup', 'true');
              }
            } else if (notifTypeNormalized.includes('donation')) {
              // Go to donation_list.php and open edit popup
              if (data.item_data && Object.keys(data.item_data).length > 0) {
                hasValidData = true;
                sessionStorage.setItem('editDonationData', JSON.stringify(data.item_data));
                sessionStorage.setItem('shouldOpenEditDonatePopup', 'true');
              }
            } else if (notifTypeNormalized.includes('meal')) {
              // Go to meal_plan.php and open meal details
              if (data.item_data && Object.keys(data.item_data).length > 0) {
                hasValidData = true;
                sessionStorage.setItem('mealPlanData', JSON.stringify(data.item_data));
                sessionStorage.setItem('shouldOpenMealDetail', 'true');
              }
            }

            // If no valid data found, show error
            if (!hasValidData) {
              Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Unable to load item details. The item may have been deleted.',
                timer: 3000,
                showConfirmButton: true
              });
              return;
            }

            // Mark notification as read (fire and forget)
            fetch('notification_actions.php', {
              method: 'POST',
              credentials: 'same-origin',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: `action=mark_read&id=${notificationId}`
            }).catch(err => console.error('Failed to mark as read:', err));

            // Debug: log the sessionStorage keys we're about to set/navigate with
            try {
              console.log('Session storage keys before navigation:', {
                viewItemData: sessionStorage.getItem('viewItemData'),
                editDonationData: sessionStorage.getItem('editDonationData'),
                mealPlanData: sessionStorage.getItem('mealPlanData'),
                shouldOpenViewPopup: sessionStorage.getItem('shouldOpenViewPopup'),
                shouldOpenEditDonatePopup: sessionStorage.getItem('shouldOpenEditDonatePopup'),
                shouldOpenMealDetail: sessionStorage.getItem('shouldOpenMealDetail')
              });
            } catch (e) { console.warn('SessionStorage unavailable', e); }

            // Navigate to appropriate page (use substring matching for robustness)
            if (notifTypeNormalized.includes('inventory') || notifTypeNormalized.includes('item')) {
              window.location.href = 'inventory_list.php';
            } else if (notifTypeNormalized.includes('donation')) {
              window.location.href = 'donation_list.php';
            } else if (notifTypeNormalized.includes('meal')) {
              window.location.href = 'meal_plan.php';
            }
          })
          .catch(error => {
            console.error('Error:', error);
            Swal.fire({
              icon: 'error',
              title: 'Error',
              text: 'Failed to fetch item details',
              timer: 3000,
              showConfirmButton: true
            });
          });
      });
    });

    // Mark as read (single)
    document.querySelectorAll('.mark-read').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        const id = this.dataset.id;
        fetch('notification_actions.php', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `action=mark_read&id=${id}`
        })
        .then(res => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then(data => {
          if (data.success) {
            location.reload();
          } else {
            Swal.fire({
              icon: 'error',
              title: 'Error',
              text: 'Failed to mark as read',
              timer: 2000,
              showConfirmButton: false
            });
          }
        })
        .catch(err => {
          console.error('Error:', err);
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Failed to mark as read',
            timer: 2000,
            showConfirmButton: false
          });
        });
      });
    });

    // Delete (single)
    document.querySelectorAll('.delete-notification').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        const id = this.dataset.id;
        Swal.fire({
          icon: 'warning',
          title: 'Delete Notification',
          text: 'Are you sure you want to delete this notification?',
          showCancelButton: true,
          confirmButtonColor: '#d33',
          confirmButtonText: 'Delete',
          cancelButtonText: 'Cancel'
        }).then(result => {
          if (result.isConfirmed) {
            fetch('notification_actions.php', {
              method: 'POST',
              credentials: 'same-origin',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: `action=delete&id=${id}`
            })
            .then(res => {
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              return res.json();
            })
            .then(data => {
              if (data.success) {
                location.reload();
              } else {
                Swal.fire({
                  icon: 'error',
                  title: 'Error',
                  text: 'Failed to delete notification',
                  timer: 2000,
                  showConfirmButton: false
                });
              }
            })
            .catch(err => {
              console.error('Error:', err);
              Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Failed to delete notification',
                timer: 2000,
                showConfirmButton: false
              });
            });
          }
        });
      });
    });

    // Mark all as read
    document.querySelector('.action-btn.edit-btn[onclick*="markAllAsRead"]')?.addEventListener('click', function(e) {
      e.preventDefault();
      fetch('notification_actions.php', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'action=mark_all_read'
      })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        if (data.success) {
          location.reload();
        } else {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Failed to mark all as read',
            timer: 2000,
            showConfirmButton: false
          });
        }
      })
      .catch(err => {
        console.error('Error:', err);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Failed to mark all as read',
          timer: 2000,
          showConfirmButton: false
        });
      });
    });

    // Delete read messages
    document.querySelector('.action-btn.edit-btn[onclick*="deleteReadMessages"]')?.addEventListener('click', function(e) {
      e.preventDefault();
      Swal.fire({
        icon: 'warning',
        title: 'Delete All Read Notifications',
        text: 'Are you sure you want to delete all read notifications? This action cannot be undone.',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'Delete All',
        cancelButtonText: 'Cancel'
      }).then(result => {
        if (result.isConfirmed) {
          fetch('notification_actions.php', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: 'action=delete_read'
          })
          .then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
          })
          .then(data => {
            if (data.success) {
              location.reload();
            } else {
              Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Failed to delete read notifications',
                timer: 2000,
                showConfirmButton: false
              });
            }
          })
          .catch(err => {
            console.error('Error:', err);
            Swal.fire({
              icon: 'error',
              title: 'Error',
              text: 'Failed to delete read notifications',
              timer: 2000,
              showConfirmButton: false
            });
          });
        }
      });
    });
  });
</script>

</body>
</html>
