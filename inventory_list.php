<?php
include 'db_connect.php'; // connect to database

$query = "SELECT * FROM food_item_inventory";
$result = mysqli_query($conn, $query);

if (!$result) {
  die("Query failed: " . mysqli_error($conn));
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>SayangFood - Food Inventory</title>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Serif&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="inventory_list.css">
</head>
<body>

  <!-- Hamburger Menu Button -->
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

    <button class="menu-item">
      <img src="pic/home.png" alt="Home Icon" class="icon"> Home
    </button>

    <button class="menu-item dropdown-btn">
      <img src="pic/search.png" alt="Browse Icon" class="icon"> Browse Food Items
    </button>

    <div class="dropdown-container">
      <button>Inventory</button>
      <button>Weekly Meal</button>
      <button>Donations</button>
      <button>Shopping List</button>
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
        <p class="username">ZhiLim</p>
        <p class="role">User Profile</p>
      </div>
    </div>
  </div>

  <!-- Main Content -->
  <div class="main">
    <div class="header">
      <h1>Food Item Inventory</h1>
    </div>

    <!-- Filter + Search -->
    <div class="controls">
      <select>
        <option value="all">View All</option>
        <option value="item">Item Name</option>
        <option value="category">Category</option>
        <option value="quantity">Quantity</option>
        <option value="expiry">Expiry Date</option>
        <option value="storage">Storage Place</option>
        <option value="remark">Remark</option>
        <option value="status">Status</option>
      </select>
      <input type="text" placeholder="Search item name...">
    </div>

    <table>
      <tr>
        <th>Item Name</th>
        <th>Category</th>
        <th>Quantity</th>
        <th>Expiry Date</th>
        <th>Storage Place</th>
        <th>Remark</th>
        <th>Status</th>
        <th>Actions</th>
      </tr>

      <?php while($row = mysqli_fetch_assoc($result)) { ?>
      <tr>
        <td><?= htmlspecialchars($row['item_name']) ?></td>
        <td><?= htmlspecialchars($row['item_category']) ?></td>
        <td><?= htmlspecialchars($row['quantity']) ?></td>
        <td><?= date('d/m/Y', strtotime($row['expiry_date'])) ?></td>
        <td><?= htmlspecialchars($row['storage_place']) ?></td>
        <td><?= htmlspecialchars($row['item_remark']) ?></td>
        <td><?= htmlspecialchars($row['item_status']) ?></td>
        <td>
          <button class="action-btn edit-btn">Edit</button>
          <button class="action-btn donate-btn">Donate</button>
        </td>
      </tr>
      <?php } ?>
    </table>
    <button class="add-btn" onclick="openPopup()">Add New Food</button>
  </div>

  <!-- Popup Form -->
  <div class="popup" id="popupForm">
    <div class="popup-content">
      <h2>Add New Food Item</h2>
      <label for="itemName">Item Name</label>
      <input type="text" id="itemName" placeholder="Item Name">

      <label for="category">Category</label>
      <input type="text" id="category" placeholder="Category">

      <label for="quantity">Quantity</label>
      <input type="text" id="quantity" placeholder="Quantity">

      <label for="expiryDate">Expiry Date</label>
      <input type="date" id="expiryDate">

      <label for="storagePlace">Storage Place</label>
      <input type="text" id="storagePlace" placeholder="Storage Place">

      <label for="remark">Remark</label>
      <textarea id="remark" placeholder="Remark"></textarea>

      <button class="save" onclick="closePopup()">Save</button>
      <button class="cancel" onclick="closePopup()">Cancel</button>
    </div>
  </div>

  <script src="inventory.js"></script>
</body>
</html>

  <!-- Flag for Donation Popup -->
  <div class="popup" id="flagDonationPopup">
    <div class="popup-content">
      <h2>Flag for Donation</h2>
      <form id="flagDonationForm">
        <label for="pickupLocation">Pickup Location</label>
        <input type="text" id="pickupLocation" name="pickupLocation" placeholder="Enter pickup location" required>

        <label for="pickupDate">Pickup Date</label>
        <input type="date" id="pickupDate" name="pickupDate" required>

        <label for="pickupTime">Pickup Time</label>
        <input type="time" id="pickupTime" name="pickupTime" required>

        <button class="save" type="submit">Submit</button>
        <button class="cancel" type="button" onclick="closeFlagDonationPopup()">Cancel</button>
      </form>
    </div>
  </div>

  <!-- Donate Popup -->
  <div class="popup" id="donatePopup">
    <div class="popup-content">
      <h2>Choose an Action</h2>
      <div class="donate-actions">
        <button class="save" onclick="markAsUsed()">Mark as Used</button>
        <button class="save" onclick="planForMeal()">Plan for Meal</button>
        <button class="save" onclick="flagForDonation()">Flag for Donation</button>
      </div>
      <button class="cancel donate-cancel" onclick="closeDonatePopup()">Cancel</button>
    </div>
  </div>
