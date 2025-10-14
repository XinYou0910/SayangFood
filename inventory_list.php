<?php
include 'db_connect.php'; // connect to database

// Automatically mark expired items in the database
mysqli_query($conn, "
  UPDATE food_item_inventory
  SET item_status = 'Expired'
  WHERE expiry_date < CURDATE()
    AND item_status NOT IN ('Used', 'Donated', 'Expired')
");


// Filter logic
$where = "item_status != 'Donated'";
if (isset($_GET['filter'])) {
    $filters = [];
    if (!empty($_GET['category'])) {
        $category = mysqli_real_escape_string($conn, $_GET['category']);
        $filters[] = "item_category = '$category'";
    }
    $expiry_from = !empty($_GET['expiry_date_from']) ? mysqli_real_escape_string($conn, $_GET['expiry_date_from']) : '';
    $expiry_to = !empty($_GET['expiry_date_to']) ? mysqli_real_escape_string($conn, $_GET['expiry_date_to']) : '';
    if ($expiry_from && $expiry_to) {
        $filters[] = "expiry_date BETWEEN '$expiry_from' AND '$expiry_to'";
    } elseif ($expiry_from) {
        $filters[] = "expiry_date >= '$expiry_from'";
    } elseif ($expiry_to) {
        $filters[] = "expiry_date <= '$expiry_to'";
    }
    if (!empty($_GET['storage_place'])) {
        $storage = mysqli_real_escape_string($conn, $_GET['storage_place']);
        $filters[] = "storage_place = '$storage'";
    }
    if ($filters) {
        $where .= ' AND ' . implode(' AND ', $filters);
    }
}
$query = "SELECT * FROM food_item_inventory WHERE $where";
// Add sorting if requested
$orderBy = " ORDER BY item_id DESC";
if (isset($_GET['sort']) && !empty($_GET['sort_field'])) {
    $sort_field = mysqli_real_escape_string($conn, $_GET['sort_field']);
    $sort_order = (isset($_GET['sort_order']) && strtolower($_GET['sort_order']) === 'desc') ? 'DESC' : 'ASC';
    $allowed_fields = ['item_name', 'item_category', 'quantity', 'expiry_date', 'storage_place', 'item_status', 'item_remark'];
    if (in_array($sort_field, $allowed_fields)) {
        $orderBy = " ORDER BY $sort_field $sort_order";
    }
}
$query .= $orderBy;
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
  <div id="pageContent">
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

      <div class="dropdown-container">
        <button onclick="location.href='inventory_list.php'">Inventory</button>
        <button onclick="location.href='weekly_meal.php'">Weekly Meal</button>
        <button onclick="location.href='donation_list.php'">Donations</button>
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

    <!-- Main -->
    <div class="main-content">
      <div class="header">
        <h1>Food Item Inventory</h1>
      </div>

      <div class="controls">
            <div class="controls-left" style="display:flex;gap:10px;">
              <button class="action-btn edit-btn" style="min-width:110px;max-width:110px;" onclick="openFilterPopup()">Filter</button>
              <button class="action-btn edit-btn" style="min-width:110px;max-width:110px;" onclick="openSortPopup()">Sort By</button>
            </div>
            <div class="controls-right">
              <button class="action-btn add-btn" onclick="openPopup()">Add New Food</button>
            </div>
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

            // Only automatically mark Expired items if not Used, Donated, or Planned for Meal
            if (!in_array(strtolower($status), ['used', 'donated', 'expired', 'planned for meal'])) {
              if ($expiryDate < $today) {
                $status = "Expired";
              }
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
            <?php
              // Determine display version and color class
              $displayStatus = ($status === 'Planned for Meal') ? 'Meal' : $status;
              $statusClass = 'status-available';

              if (strtolower($status) === 'expired') {
                $statusClass = 'status-expired';
              } elseif (strtolower($status) === 'used') {
                $statusClass = 'status-used';
              } elseif (strtolower($status) === 'planned for meal') {
                $statusClass = 'status-planned-for-meal';
              }
            ?>
            <td class="<?= $statusClass ?>">
              <?= htmlspecialchars($displayStatus) ?>
            </td>
            <td>
              <button class="action-btn view-btn" onclick='openViewPopup(<?= json_encode($row) ?>)'>View</button>
            </td>
          </tr>
        <?php } ?>
      </table>

      <!-- Filter Popup -->
      <div class="popup" id="filterPopup" style="display:none;">
        <div class="popup-content" style="max-width:400px;margin:auto;">
          <h2>Filter Food Items</h2>
          <form method="GET" action="inventory_list.php">
            <input type="hidden" name="filter" value="1">
            <?php if(isset($_GET['sort']) && isset($_GET['sort_field'])): ?>
            <input type="hidden" name="sort" value="1">
            <input type="hidden" name="sort_field" value="<?php echo htmlspecialchars($_GET['sort_field']); ?>">
            <input type="hidden" name="sort_order" value="<?php echo isset($_GET['sort_order']) ? htmlspecialchars($_GET['sort_order']) : 'asc'; ?>">
            <?php endif; ?>
            <!-- Category Filter -->
            <div class="form-group" style="margin-bottom: 15px;">
              <label for="filterCategory">Category</label>
              <select name="category" id="filterCategory" style="width: 100%;">
                <option value="">-- Any --</option>
                <option value="Meat" <?php echo (isset($_GET['category']) && $_GET['category'] === 'Meat') ? 'selected' : ''; ?>>Meat</option>
                <option value="Vegetable" <?php echo (isset($_GET['category']) && $_GET['category'] === 'Vegetable') ? 'selected' : ''; ?>>Vegetable</option>
                <option value="Seafood" <?php echo (isset($_GET['category']) && $_GET['category'] === 'Seafood') ? 'selected' : ''; ?>>Seafood</option>
                <option value="Dairy" <?php echo (isset($_GET['category']) && $_GET['category'] === 'Dairy') ? 'selected' : ''; ?>>Dairy</option>
                <option value="Grains" <?php echo (isset($_GET['category']) && $_GET['category'] === 'Grains') ? 'selected' : ''; ?>>Grains</option>
                <option value="Beverage" <?php echo (isset($_GET['category']) && $_GET['category'] === 'Beverage') ? 'selected' : ''; ?>>Beverage</option>
                <option value="Snacks" <?php echo (isset($_GET['category']) && $_GET['category'] === 'Snacks') ? 'selected' : ''; ?>>Snacks</option>
                <option value="Condiment" <?php echo (isset($_GET['category']) && $_GET['category'] === 'Condiment') ? 'selected' : ''; ?>>Condiment</option>
                <option value="Other" <?php echo (isset($_GET['category']) && $_GET['category'] === 'Other') ? 'selected' : ''; ?>>Other</option>
              </select>
            </div>

            <!-- Expiry Date Filters -->
            <div class="form-group" style="margin-bottom: 15px;">
              <label for="filterExpiryFrom">Expiry Date From</label>
              <input type="date" name="expiry_date_from" id="filterExpiryFrom" style="width: 100%;" value="<?php echo isset($_GET['expiry_date_from']) ? htmlspecialchars($_GET['expiry_date_from']) : ''; ?>">
            </div>

            <div class="form-group" style="margin-bottom: 15px;">
              <label for="filterExpiryTo">Expiry Date To</label>
              <input type="date" name="expiry_date_to" id="filterExpiryTo" style="width: 100%;" value="<?php echo isset($_GET['expiry_date_to']) ? htmlspecialchars($_GET['expiry_date_to']) : ''; ?>">
            </div>

            <!-- Storage Place Filter -->
            <div class="form-group" style="margin-bottom: 15px;">
              <label for="filterStorage">Storage Place</label>
              <select name="storage_place" id="filterStorage" style="width: 100%;">
                <option value="">-- Any --</option>
                <option value="Refrigerator" <?php echo (isset($_GET['storage_place']) && $_GET['storage_place'] === 'Refrigerator') ? 'selected' : ''; ?>>Refrigerator</option>
                <option value="Freezer" <?php echo (isset($_GET['storage_place']) && $_GET['storage_place'] === 'Freezer') ? 'selected' : ''; ?>>Freezer</option>
                <option value="Pantry" <?php echo (isset($_GET['storage_place']) && $_GET['storage_place'] === 'Pantry') ? 'selected' : ''; ?>>Pantry</option>
                <option value="Cabinet" <?php echo (isset($_GET['storage_place']) && $_GET['storage_place'] === 'Cabinet') ? 'selected' : ''; ?>>Cabinet</option>
                <option value="Storage Box" <?php echo (isset($_GET['storage_place']) && $_GET['storage_place'] === 'Storage Box') ? 'selected' : ''; ?>>Storage Box</option>
                <option value="Other" <?php echo (isset($_GET['storage_place']) && $_GET['storage_place'] === 'Other') ? 'selected' : ''; ?>>Other</option>
              </select>
            </div>
            <div class="form-buttons">
              <button type="submit" class="action-btn edit-btn" style="min-width:110px;max-width:110px;">Apply</button>
              <button type="button" class="action-btn" style="min-width:110px;max-width:110px;background:linear-gradient(135deg, #e74c3c, #c0392b);" onclick="window.location.href='inventory_list.php'">Remove Filter</button>
              <button type="button" class="action-btn" style="min-width:110px;max-width:110px;background:linear-gradient(135deg, #95a5a6, #7f8c8d);" onclick="closeFilterPopup()">Cancel</button>
            </div>
          </form>
        </div>
      </div>

      <!-- Sort Popup -->
      <div class="popup" id="sortPopup" style="display:none;">
        <div class="popup-content" style="max-width:400px;margin:auto;">
          <h2>Sort Inventory</h2>
          <form method="GET" action="inventory_list.php">
            <input type="hidden" name="sort" value="1">
            <?php if(isset($_GET['filter'])): ?>
            <input type="hidden" name="filter" value="1">
            <?php if(isset($_GET['category'])): ?>
            <input type="hidden" name="category" value="<?php echo htmlspecialchars($_GET['category']); ?>">
            <?php endif; ?>
            <?php if(isset($_GET['expiry_date_from'])): ?>
            <input type="hidden" name="expiry_date_from" value="<?php echo htmlspecialchars($_GET['expiry_date_from']); ?>">
            <?php endif; ?>
            <?php if(isset($_GET['expiry_date_to'])): ?>
            <input type="hidden" name="expiry_date_to" value="<?php echo htmlspecialchars($_GET['expiry_date_to']); ?>">
            <?php endif; ?>
            <?php if(isset($_GET['storage_place'])): ?>
            <input type="hidden" name="storage_place" value="<?php echo htmlspecialchars($_GET['storage_place']); ?>">
            <?php endif; ?>
            <?php endif; ?>
            <input type="hidden" name="sort" value="1">
            <div class="form-group" style="margin-bottom: 15px;">
              <label for="sortField">Sort By</label>
              <select name="sort_field" id="sortField" style="width:100%;">
                <option value="item_name">Item Name</option>
                <option value="item_category">Category</option>
                <option value="quantity">Quantity</option>
                <option value="expiry_date">Expiry Date</option>
                <option value="storage_place">Storage Place</option>
                <option value="item_remark">Remark</option>
                <option value="item_status">Status</option>
              </select>
            </div>
            <div class="form-group" style="margin-bottom: 15px;">
              <label for="sortOrder">Order</label>
              <select name="sort_order" id="sortOrder" style="width:100%;">
                <option value="asc">A-Z / Earliest</option>
                <option value="desc">Z-A / Latest</option>
              </select>
            </div>
            <div class="form-buttons">
              <button type="submit" class="action-btn edit-btn" style="min-width:110px;max-width:110px;">Apply</button>
              <button type="button" class="action-btn" style="min-width:110px;max-width:110px;background:linear-gradient(135deg, #e74c3c, #c0392b);" onclick="window.location.href='inventory_list.php'">Remove Sort</button>
              <button type="button" class="action-btn" style="min-width:110px;max-width:110px;background:linear-gradient(135deg, #95a5a6, #7f8c8d);" onclick="closeSortPopup()">Cancel</button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- Edit Popup -->
    <div class="popup" id="editPopup">
      <div class="popup-content">
        <h2>Edit Food Item</h2>
        <button class="close-btn" onclick="closeEditPopup()">×</button>

        <form id="editForm" action="update_food.php" method="POST">
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
            <option value="Planned for Meal">Planned for Meal</option>
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
            <button type="button" class="donate-btn" id="viewDonateBtn" onclick="openDonatePopup(window.currentViewItem)">Donate</button>
            <button type="button" class="edit-btn" onclick="openEditFromView()">Edit</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Add Popup -->
    <div class="popup" id="popupForm">
      <div class="popup-content">
        <span class="close-btn" onclick="closePopup()">×</span>
        <h2>Add New Food Item</h2>

        <form action="add_food.php" method="POST">
          
          <!-- Item Name -->
          <label for="itemName">Item Name</label>
          <input 
            type="text" 
            name="item_name" 
            id="itemName" 
            placeholder="e.g. Chicken Breast, Milk, Pasta" 
            required
          >

          <!-- Quantity + Unit + Expiry Date -->
          <div class="form-row">
            
            <!-- Quantity -->
            <div class="form-group quantity">
              <label for="quantityValue">Quantity</label>
              <input 
                type="number" 
                id="quantityValue" 
                name="quantityValue" 
                min="1" 
                value="1" 
                required
              >
            </div>

            <!-- Unit -->
            <div class="form-group unit">
              <label for="quantityUnit">Unit</label>
              <div id="unitWrapper">
                <select 
                  id="quantityUnit" 
                  name="quantityUnit" 
                  onchange="switchUnitInput()" 
                  required
                >
                  <option value="">-- Select Unit --</option>
                  <option value="pcs">pcs</option>
                  <option value="packs">packs</option>
                  <option value="kg">kg</option>
                  <option value="g">g</option>
                  <option value="litres">litres</option>
                  <option value="ml">ml</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <!-- Expiry Date -->
            <div class="form-group expiry">
              <label for="expiryDate">Expiry Date</label>
              <input 
                type="date" 
                name="expiry_date" 
                id="expiryDate" 
                required
              >
            </div>
          </div>

          <!-- Category + Storage Place -->
          <div class="form-row">
            
            <!-- Category -->
            <div class="form-group category">
              <label for="category">Category</label>
              <div id="categoryWrapper" class="dual-input-wrapper">
                <select 
                  name="item_category" 
                  id="category" 
                  onchange="switchCategoryInput()" 
                  required
                >
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

            <!-- Storage Place -->
            <div class="form-group storage">
              <label for="storagePlace">Storage Place</label>
              <div id="storageWrapper">
                <select 
                  name="storage_place" 
                  id="storagePlace" 
                  onchange="switchStorageInput()" 
                  required
                >
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

          <!-- Remark -->
          <label for="remark">Remark</label>
          <textarea 
            name="item_remark" 
            id="remark" 
            placeholder="Optional: e.g. Use soon, almost expired, for donation..."
          ></textarea>

          <!-- Buttons -->
          <div class="form-buttons">
            <button type="submit" class="save">Save</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Donate Popup -->
    <div id="donatePopup" class="popup" style="display: none;">
      <div class="popup-content">
        <button class="close-btn" onclick="closeDonatePopup()">×</button>
         <h2>Donate Food Item</h2>

         <form id="donateForm" onsubmit="submitDonation(event)">
           <div class="form-group">
             <label>Item Name</label>
             <input type="text" id="donateItemName" readonly>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Quantity</label>
              <input type="text" id="donateQuantity" readonly>
            </div>
            <div class="form-group">
              <label>Expiry Date</label>
              <input type="date" id="donateExpiry" readonly>
            </div>
          </div>

          <div class="form-group">
            <label>Pickup Location <span style="color:red">*</span></label>
            <input type="text" id="donatePickup" placeholder="e.g., HELP University Cafeteria, Block E" required>
          </div>

          <div class="form-group">
            <label>Remarks</label>
            <textarea id="donateRemark" placeholder="Optional: e.g., Keep chilled, contact before pickup..."></textarea>
          </div>

          <div class="form-buttons">
            <button type="submit" class="save">Donate</button>
          </div>
        </form>
      </div>
    </div>
  </div>

<script src="script.js"></script>
<script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
</body>
</html>
