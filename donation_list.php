<?php
include 'db_connect.php';

// ✅ Query joins donation + food_item_inventory
// It works safely even when items are still present with status 'Donated'
$query = "SELECT d.*, 
                (SELECT item_name FROM food_item_inventory WHERE item_id = d.item_id) AS item_name,
                (SELECT quantity FROM food_item_inventory WHERE item_id = d.item_id) AS quantity,
                (SELECT expiry_date FROM food_item_inventory WHERE item_id = d.item_id) AS expiry_date
          FROM donation d
          ORDER BY d.donation_id DESC";

$result = mysqli_query($conn, $query);
if (!$result) {
  die('Query failed: ' . mysqli_error($conn));
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>SayangFood - Donation List</title>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Serif&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="inventory_list.css">
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

    <button class="menu-item" onclick="window.location.href='home.php'">
      <img src="pic/home.png" class="icon"> Home
    </button>

    <!-- Dropdown main button -->
    <button class="menu-item dropdown-btn" onclick="toggleDropdown()">
      <img src="pic/search.png" class="icon"> Browse Food Items
      <span class="arrow" id="arrowIcon">▼</span>
    </button>

    <!-- Dropdown sub-menu -->
    <div class="dropdown-container" id="dropdownMenu">
      <button class="submenu-item" data-page="inventory_list.php" onclick="window.location.href='inventory_list.php'">Inventory</button>
      <button class="submenu-item" data-page="weekly_meal.php" onclick="window.location.href='weekly_meal.php'">Weekly Meal</button>
      <button class="submenu-item" data-page="donation_list.php" onclick="window.location.href='donation_list.php'">Donations</button>
    </div>

    <button class="menu-item">
      <img src="pic/data-analytics.png" class="icon"> Food Analytics
    </button>
    <button class="menu-item">
      <img src="pic/notification.png" class="icon"> Notification
    </button>

    <div class="profile">
      <img src="pic/user.png" alt="User" class="profile-img">
      <div class="profile-info">
        <p class="username">ZhiLim</p>
        <p class="role">User Profile</p>
      </div>
    </div>
  </div>

  <!-- Main -->
  <div class="main-content">
    <div class="header">
      <h1>Donation Listing</h1>
    </div>

    <div class="controls">
      <select>
        <option value="all">View All</option>
        <option value="donated">Donated</option>
        <option value="available">Available</option>
      </select>
      <input type="text" placeholder="Search donation item...">
    </div>

    <table>
      <tr>
        <th>Item Name</th>
        <th>Quantity</th>
        <th>Expiry Date</th>
        <th>Pickup Location</th>
        <th>Status</th>
        <th>Remark</th>
        <th>Actions</th>
      </tr>

      <?php while($row = mysqli_fetch_assoc($result)) { ?>
      <tr>
        <td><?= htmlspecialchars($row['item_name'] ?? 'N/A') ?></td>
        <td><?= htmlspecialchars($row['quantity'] ?? 'N/A') ?></td>
        <td><?= $row['expiry_date'] ? htmlspecialchars(date('Y-m-d', strtotime($row['expiry_date']))) : 'N/A' ?></td>
        <td><?= htmlspecialchars($row['pickup_location']) ?></td>

        <?php
          $statusClass = strtolower($row['donation_status']) === 'donated'
                         ? 'status-available'
                         : 'status-expired';
        ?>
        <td class="<?= $statusClass ?>">
          <?= htmlspecialchars($row['donation_status']) ?>
        </td> 

        <td><?= htmlspecialchars($row['donation_remark']) ?></td>
        <td>
          <button class="action-btn edit-btn" onclick='openEditDonatePopup(<?= json_encode($row) ?>)'>Edit</button>
        </td>
      </tr>
      <?php } ?>
    </table>
  </div>

  <!-- Edit Donation Popup -->
  <div class="popup" id="editDonatePopup">
    <div class="popup-content">
      <h2>Edit Donation Item</h2>
      <form id="editDonateForm" method="POST" action="edit_donation.php">
        <input type="hidden" name="donation_id" id="editDonationId">

        <div class="inline-name">
          <label>Item Name:</label>
          <span id="editDonateItemName"></span>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Pickup Location</label>
            <input type="text" id="editPickup" name="pickup_location" required>
          </div>

          <div class="form-group">
            <label>Status</label>
            <select id="editDonateStatus" name="donation_status" required>
              <option value="Available">Available</option>
              <option value="Donated">Donated</option>
            </select>
          </div>
        </div>

        <label>Remark</label>
        <textarea id="editDonateRemark" name="donation_remark"></textarea>

        <div class="form-buttons">
          <button type="submit" class="save">Save</button>
          <button type="button" class="cancel" onclick="closeEditDonatePopup()">Cancel</button>
        </div>
      </form>
    </div>
  </div>

<script src="script.js"></script>

<!-- JS for Edit Popup -->
<script>
function openEditDonatePopup(item) {
  document.getElementById("editDonationId").value = item.donation_id;
  document.getElementById("editDonateItemName").textContent = item.item_name || 'N/A';
  document.getElementById("editPickup").value = item.pickup_location || '';
  document.getElementById("editDonateRemark").value = item.donation_remark || '';
  document.getElementById("editDonateStatus").value = item.donation_status || 'Available';
  document.getElementById("editDonatePopup").style.display = "flex";
}

function closeEditDonatePopup() {
  document.getElementById("editDonatePopup").style.display = "none";
}

function toggleDropdown() {
  const dropdown = document.getElementById("dropdownMenu");
  const arrow = document.getElementById("arrowIcon");
  if (dropdown.style.display === "flex") {
    dropdown.style.display = "none";
    arrow.style.transform = "rotate(0deg)";
  } else {
    dropdown.style.display = "flex";
    arrow.style.transform = "rotate(180deg)";
  }
}
</script>

</body>
</html>
