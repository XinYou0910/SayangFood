<?php
include 'db_connect.php'; // connect to database

// Automatically mark expired items in the database
mysqli_query($conn, "
  UPDATE food_item_inventory
  SET item_status = 'Expired'
  WHERE expiry_date < CURDATE()
    AND item_status NOT IN ('Used', 'Donated', 'Expired')
");

$query = "SELECT * FROM food_item_inventory WHERE item_status != 'Donated'";
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
  <title>SayangFood - Food Inventory</title>
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

    <button class="menu-item" onclick="window.location.href='dashboard_page.html'">
      <img src="pic/home.png" class="icon"> Home
    </button>

    <!-- Dropdown -->
    <button class="menu-item dropdown-btn" onclick="toggleDropdown()">
      <img src="pic/search.png" class="icon"> Browse Food Items
      <span class="arrow" id="arrowIcon">▼</span>
    </button>

    <div class="dropdown-container" id="dropdownMenu">
      <button class="submenu-item" onclick="window.location.href='inventory_list.php'">Inventory</button>
      <button class="submenu-item" onclick="window.location.href='weekly_meal.php'">Weekly Meal</button>
      <button class="submenu-item" onclick="window.location.href='donation_list.php'">Donations</button>
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

  <!-- Main -->
  <div class="main">
    <div class="header"><h1>Food Item Inventory</h1></div>

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
        <?php
          $status = $row['item_status'];
          $expiryDate = strtotime($row['expiry_date']);
          $today = strtotime(date('Y-m-d'));
          if (strtolower($status) !== "used") {
            $status = ($expiryDate < $today) ? "Expired" : "Available";
          }
        ?>
        <tr>
          <td><?= htmlspecialchars($row['item_name']) ?></td>
          <td><?= htmlspecialchars($row['item_category']) ?></td>
          <td><?= htmlspecialchars($row['quantity']) ?></td>
          <td><?= date('Y-m-d', strtotime($row['expiry_date'])) ?></td>
          <td><?= htmlspecialchars($row['storage_place']) ?></td>
          <td class="remark-cell">
            <div class="truncate" title="<?= htmlspecialchars($row['item_remark']) ?>">
              <?= htmlspecialchars($row['item_remark']) ?>
            </div>
          </td>
          <td class="<?= strtolower($status) === 'expired' ? 'status-expired' : 'status-available' ?>">
            <?= htmlspecialchars($status) ?>
          </td>
          <td>
            <button class="action-btn view-btn" onclick='openViewPopup(<?= json_encode($row) ?>)'>View</button>
          </td>
        </tr>
      <?php } ?>
    </table>

    <button class="add-btn" onclick="openPopup()">Add New Food</button>
  </div>

  <!-- Edit Popup -->
  <div class="popup" id="editPopup">
    <div class="popup-content">
      <h2>Edit Food Item</h2>
      <button class="close-btn" onclick="closeEditPopup()">×</button>

      <form id="editForm">
        <input type="hidden" name="item_id" id="editId">

        <div class="inline-name">
          <label>Item Name:</label>
          <span id="editItemName"></span>
          <input type="hidden" name="item_name" id="editItemNameInput">
        </div>

        <div class="form-row">
          <div class="form-group quantity">
            <label>Quantity</label>
            <input type="number" id="editQuantityValue" name="quantityValue" min="1" required>
          </div>
          <div class="form-group unit">
            <label>Unit</label>
            <select id="editQuantityUnit" name="quantityUnit" required>
              <option value="">-- Select Unit --</option>
              <option value="pcs">pcs</option>
              <option value="packs">packs</option>
              <option value="kg">kg</option>
              <option value="g">g</option>
              <option value="litres">litres</option>
              <option value="ml">ml</option>
              <option value="loaf">loaf</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div class="form-group expiry">
            <label>Expiry Date</label>
            <input type="date" id="editExpiryDate" name="expiry_date" required>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group category">
            <label>Category</label>
            <select name="item_category" id="editCategory" required>
              <option value="">-- Select Category --</option>
              <option value="Meat">Meat</option>
              <option value="Vegetable">Vegetable</option>
              <option value="Seafood">Seafood</option>
              <option value="Dairy">Dairy</option>
              <option value="Grains">Grains</option>
              <option value="Beverage">Beverage</option>
              <option value="Snacks">Snacks</option>
              <option value="Condiment">Condiment</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div class="form-group storage">
            <label>Storage Place</label>
            <select name="storage_place" id="editStorage" required>
              <option value="">-- Select Storage Place --</option>
              <option value="Refrigerator">Refrigerator</option>
              <option value="Freezer">Freezer</option>
              <option value="Pantry">Pantry</option>
              <option value="Cabinet">Cabinet</option>
              <option value="Storage Box">Storage Box</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>

        <label>Remark</label>
        <textarea id="editRemark" name="item_remark"></textarea>

        <label>Status</label>
        <select id="editStatus" name="item_status" required>
          <option value="Available">Available</option>
          <option value="Used">Used</option>
        </select>

        <div class="form-buttons">
          <button type="submit" class="save">Save</button>
        </div>
      </form>
    </div>
  </div>

  <!-- View Popup -->
  <div class="popup" id="viewPopup">
    <div class="popup-content">
      <button type="button" class="close-btn" onclick="closeViewPopup()">×</button>
      <h2>View Food Item</h2>

      <form id="viewForm">
        <div class="inline-name">
          <label>Item Name:</label>
          <span id="viewItemName"></span>
        </div>

        <div class="form-row">
          <div class="form-group quantity">
            <label>Quantity</label>
            <input type="text" id="viewQuantity" readonly>
          </div>
          <div class="form-group unit">
            <label>Unit</label>
            <input type="text" id="viewUnit" readonly>
          </div>
          <div class="form-group expiry">
            <label>Expiry Date</label>
            <input type="text" id="viewExpiryDate" readonly>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group category">
            <label>Category</label>
            <input type="text" id="viewCategory" readonly>
          </div>
          <div class="form-group storage">
            <label>Storage Place</label>
            <input type="text" id="viewStorage" readonly>
          </div>
        </div>

        <label>Remark</label>
        <textarea id="viewRemark" readonly></textarea>

        <label>Status</label>
        <input type="text" id="viewStatus" readonly>

        <div class="view-buttons">
          <button type="button" class="meal-btn" id="viewMealBtn" onclick="toggleMealStatus()">Meal</button>
          <button type="button" class="donate-btn" id="viewDonateBtn" onclick="confirmDonation()">Donate</button>
          <button type="button" class="edit-btn" onclick="openEditFromView()">Edit</button>
        </div>
      </form>
    </div>
  </div>

<script src="script.js"></script>
<script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
</body>
</html>
