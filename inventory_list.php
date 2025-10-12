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
        <td><?= date('Y-m-d', strtotime($row['expiry_date'])) ?></td>
        <td><?= htmlspecialchars($row['storage_place']) ?></td>
        <td><?= htmlspecialchars($row['item_remark']) ?></td>
        <?php
          $status = $row['item_status'];
          $expiryDate = strtotime($row['expiry_date']);
          $today = strtotime(date('Y-m-d'));
          if (strtolower($status) !== "used") {
            $status = ($expiryDate < $today) ? "Expired" : "Available";
          }
        ?>
        <td class="<?= strtolower($status) === 'expired' ? 'status-expired' : 'status-available' ?>">
          <?= htmlspecialchars($status) ?>
        </td>
        <td>
          <button class="action-btn edit-btn" 
            onclick='openEditPopup(<?= json_encode($row) ?>)'>Edit</button>
          <button class="action-btn donate-btn" 
            onclick='openDonatePopup(<?= json_encode($row) ?>)'>Donate</button>
        </td>
      </tr>
      <?php } ?>
    </table>

    <button class="add-btn" onclick="openPopup()">Add New Food</button>
  </div>

  <!-- Add Popup -->
  <div class="popup" id="popupForm">
    <div class="popup-content">
      <h2>Add New Food Item</h2>
      <form action="add_food.php" method="POST">
        <label for="itemName">Item Name</label>
        <input type="text" name="item_name" id="itemName" placeholder="e.g. Chicken Breast, Milk, Pasta" required>

        <div class="form-row">
          <div class="form-group">
            <label for="category">Category</label>
            <div id="categoryWrapper">
              <select name="item_category" id="category" onchange="switchCategoryInput()" required>
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
          </div>

          <div class="form-group">
            <label for="quantity">Quantity</label>
            <input type="text" name="quantity" id="quantity" placeholder="e.g. 5 packs / 2 kg / 3 pcs" required>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="expiryDate">Expiry Date</label>
            <input type="date" name="expiry_date" id="expiryDate" required>
          </div>

          <div class="form-group">
            <label for="storagePlace">Storage Place</label>
            <div id="storageWrapper">
              <select name="storage_place" id="storagePlace" onchange="switchStorageInput()" required>
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
        </div>

        <label for="remark">Remark</label>
        <textarea name="item_remark" id="remark" placeholder="Optional: e.g. Use soon, almost expired, for donation..."></textarea>

        <div class="form-buttons">
          <button type="submit" class="save">Save</button>
          <button type="button" class="cancel" onclick="closePopup()">Cancel</button>
        </div>
      </form>
    </div>
  </div>

  <!-- Edit Popup -->
  <div class="popup" id="editPopup">
    <div class="popup-content">
      <h2>Edit Food Item</h2>
      <form id="editForm" method="POST" action="update_food.php">
        <input type="hidden" name="item_id" id="editId">

        <!-- Display Item Name as text -->
        <div class="inline-name">
          <label>Item Name:</label>
          <span id="editItemName"></span>
          <input type="hidden" name="item_name" id="editItemNameInput">
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Category</label>
            <div id="editCategoryWrapper">
              <select name="item_category" id="editCategory" onchange="switchEditCategoryInput()" required>
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
          </div>

          <div class="form-group">
            <label>Quantity</label>
            <input type="text" id="editQuantity" name="quantity" required>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Expiry Date</label>
            <input type="date" id="editExpiryDate" name="expiry_date" required>
          </div>

          <div class="form-group">
            <label>Storage Place</label>
            <div id="editStorageWrapper">
              <select name="storage_place" id="editStorage" onchange="switchEditStorageInput()" required>
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
          <button type="button" class="cancel" onclick="closeEditPopup()">Cancel</button>
        </div>
      </form>
    </div>
  </div>

  <!-- Donate Confirmation Popup -->
  <div class="popup" id="donatePopup">
    <div class="popup-content">
      <h2>Confirm Donation</h2>
      <form id="donateForm" action="donate_food.php" method="POST">
        <input type="hidden" name="item_id" id="donateItemId">
        <input type="hidden" name="user_id" value="1"> <!-- Temporary user_id for demo -->

        <p><strong>Item Name:</strong> <span id="donateItemName"></span></p>
        <p><strong>Quantity:</strong> <span id="donateQuantity"></span></p>
        <p><strong>Expiry Date:</strong> <span id="donateExpiry"></span></p>

        <label for="pickup_location">Pickup Location:</label>
        <input type="text" name="pickup_location" id="pickup_location" placeholder="Enter pickup point" required>

        <label for="donation_remark">Remark (Optional):</label>
        <textarea name="donation_remark" id="donation_remark" placeholder="Any notes..."></textarea>

        <div class="form-buttons">
          <button type="submit" class="save">Confirm</button>
          <button type="button" class="cancel" onclick="closeDonatePopup()">Cancel</button>
        </div>
      </form>
    </div>
  </div>

<script src="script.js"></script>

<!-- Edit Popup Logic -->
<script>
function openEditPopup(item) {
  document.getElementById("editId").value = item.item_id || item.id;
  document.getElementById("editItemName").textContent = item.item_name;
  document.getElementById("editItemNameInput").value = item.item_name; // ✅ added
  document.getElementById("editCategory").value = item.item_category;
  document.getElementById("editQuantity").value = item.quantity;
  document.getElementById("editExpiryDate").value = item.expiry_date;
  document.getElementById("editStorage").value = item.storage_place;
  document.getElementById("editRemark").value = item.item_remark;

  const status = item.item_status?.trim() || "Available";
  document.getElementById("editStatus").value =
    ["Available", "Used"].includes(status) ? status : "Available";

  document.getElementById("editPopup").style.display = "flex";
}

function closeEditPopup() {
  document.getElementById("editPopup").style.display = "none";
}

// ------- CATEGORY: Inline "Other" switch -------
function switchEditCategoryInput() {
  const wrapper = document.getElementById("editCategoryWrapper");
  const select = document.getElementById("editCategory");

  if (select && select.value === "Other") {
    wrapper.innerHTML = `
      <input type="text" name="item_category" id="editCategoryInput"
             placeholder="Enter custom category" required
             onblur="restoreEditCategoryDropdown(this.value)">
    `;
    document.getElementById("editCategoryInput").focus();
  }
}

function restoreEditCategoryDropdown(customValue) {
  const wrapper = document.getElementById("editCategoryWrapper");
  wrapper.innerHTML = `
    <select name="item_category" id="editCategory" onchange="switchEditCategoryInput()" required>
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
  `;
  if (customValue && customValue.trim() !== "" && customValue !== "Other") {
    const select = document.getElementById("editCategory");
    const opt = document.createElement("option");
    opt.value = customValue.trim();
    opt.textContent = customValue.trim();
    select.appendChild(opt);
    select.value = customValue.trim();
  }
}

// ------- STORAGE: Inline "Other" switch -------
function switchEditStorageInput() {
  const wrapper = document.getElementById("editStorageWrapper");
  const select = document.getElementById("editStorage");

  if (select && select.value === "Other") {
    wrapper.innerHTML = `
      <input type="text" name="storage_place" id="editStorageInput"
             placeholder="Enter custom storage place" required
             onblur="restoreEditStorageDropdown(this.value)">
    `;
    document.getElementById("editStorageInput").focus();
  }
}

function restoreEditStorageDropdown(customValue) {
  const wrapper = document.getElementById("editStorageWrapper");
  wrapper.innerHTML = `
    <select name="storage_place" id="editStorage" onchange="switchEditStorageInput()" required>
      <option value="">-- Select Storage Place --</option>
      <option value="Refrigerator">Refrigerator</option>
      <option value="Freezer">Freezer</option>
      <option value="Pantry">Pantry</option>
      <option value="Cabinet">Cabinet</option>
      <option value="Storage Box">Storage Box</option>
      <option value="Other">Other</option>
    </select>
  `;
  if (customValue && customValue.trim() !== "" && customValue !== "Other") {
    const select = document.getElementById("editStorage");
    const opt = document.createElement("option");
    opt.value = customValue.trim();
    opt.textContent = customValue.trim();
    select.appendChild(opt);
    select.value = customValue.trim();
  }
}

function openDonatePopup(item) {
  document.getElementById("donateItemId").value = item.item_id;
  document.getElementById("donateItemName").textContent = item.item_name;
  document.getElementById("donateQuantity").textContent = item.quantity;
  document.getElementById("donateExpiry").textContent = item.expiry_date;
  document.getElementById("donatePopup").style.display = "flex";
}

function closeDonatePopup() {
  document.getElementById("donatePopup").style.display = "none";
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
