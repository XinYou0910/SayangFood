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

  <button class="menu-toggle" onclick="toggleSidebar()">☰</button>

  <div class="sidebar">
    <div class="logo-container">
      <img src="pic/logo.png" alt="SayangFood Logo" class="logo-img">
      <div class="logo-text">
        <span class="brand">SayangFood</span><br>
        <small>Food Management System</small>
      </div>
    </div>

    <button class="menu-item"><img src="pic/home.png" class="icon"> Home</button>
    <button class="menu-item dropdown-btn"><img src="pic/search.png" class="icon"> Browse Food Items</button>

    <div class="dropdown-container">
      <button>Inventory</button>
      <button>Weekly Meal</button>
      <button>Donations</button>
      <button>Shopping List</button>
    </div>

    <button class="menu-item"><img src="pic/data-analytics.png" class="icon"> Food Analytics</button>
    <button class="menu-item"><img src="pic/notification.png" class="icon"> Notification</button>

    <div class="profile">
      <img src="pic/user.png" alt="User" class="profile-img">
      <div class="profile-info">
        <p class="username">ZhiLim</p>
        <p class="role">User Profile</p>
      </div>
    </div>
  </div>

  <div class="main">
    <div class="header">
      <h1>Food Item Inventory</h1>
    </div>

    <div class="controls">
      <select>
        <option value="all">View All</option>
        <option value="item">Item Name</option>
        <option value="category">Category</option>
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
      <form action="add_food.php" method="POST">
        <label for="itemName">Item Name</label>
        <input type="text" name="item_name" id="itemName" placeholder="Item Name" required>

        <label for="category">Category</label>
        <input type="text" name="item_category" id="category" placeholder="Category" required>

        <label for="quantity">Quantity</label>
        <input type="text" name="quantity" id="quantity" placeholder="Quantity" required>

        <label for="expiryDate">Expiry Date</label>
        <input type="date" name="expiry_date" id="expiryDate" required>

        <label for="storagePlace">Storage Place</label>
        <input type="text" name="storage_place" id="storagePlace" placeholder="Storage Place" required>

        <label for="remark">Remark</label>
        <textarea name="item_remark" id="remark" placeholder="Remark"></textarea>

        <button type="submit" class="save">Save</button>
        <button type="button" class="cancel" onclick="closePopup()">Cancel</button>
      </form>
    </div>
  </div>

  <script>
    function openPopup() {
      document.getElementById("popupForm").style.display = "flex";
    }
    function closePopup() {
      document.getElementById("popupForm").style.display = "none";
    }
  </script>
</body>
</html>
