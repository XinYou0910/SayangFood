<?php
include 'db_connect.php';

// ✅ Query joins donation + food_item_inventory
// It works safely even when items are still present with status 'Donated'
// Query base
$query = "SELECT d.*, 
                (SELECT item_name FROM food_item_inventory WHERE item_id = d.item_id) AS item_name,
                (SELECT quantity FROM food_item_inventory WHERE item_id = d.item_id) AS quantity,
                (SELECT expiry_date FROM food_item_inventory WHERE item_id = d.item_id) AS expiry_date
          FROM donation d";

// Add filter conditions if set
$where = [];
if (isset($_GET['filter'])) {
    $expiry_from = !empty($_GET['expiry_date_from']) ? mysqli_real_escape_string($conn, $_GET['expiry_date_from']) : '';
    $expiry_to = !empty($_GET['expiry_date_to']) ? mysqli_real_escape_string($conn, $_GET['expiry_date_to']) : '';
    if ($expiry_from && $expiry_to) {
        $where[] = "(SELECT expiry_date FROM food_item_inventory WHERE item_id = d.item_id) BETWEEN '$expiry_from' AND '$expiry_to'";
    } elseif ($expiry_from) {
        $where[] = "(SELECT expiry_date FROM food_item_inventory WHERE item_id = d.item_id) >= '$expiry_from'";
    } elseif ($expiry_to) {
        $where[] = "(SELECT expiry_date FROM food_item_inventory WHERE item_id = d.item_id) <= '$expiry_to'";
    }
}
if (!empty($where)) {
    $query .= " WHERE " . implode(' AND ', $where);
}

// Search handling: if search provided, include item_name match (from inventory)
// Search handling: if search provided, include item_name match (from inventory)
$search_error = '';
if (isset($_GET['search'])) {
  $raw_search = trim($_GET['search']);
  if ($raw_search !== '') {
    if (preg_match('/^[A-Za-z\s]+$/', $raw_search)) {
      $searchTerm = mysqli_real_escape_string($conn, $raw_search);
      if (!empty($where)) {
        $query .= " AND (SELECT item_name FROM food_item_inventory WHERE item_id = d.item_id) LIKE '%$searchTerm%'";
      } else {
        $query .= " WHERE (SELECT item_name FROM food_item_inventory WHERE item_id = d.item_id) LIKE '%$searchTerm%'";
      }
    } else {
      $search_error = 'Search may only contain alphabet characters and spaces.';
    }
  }
}

// Add sorting if requested
$orderBy = " ORDER BY d.donation_id DESC";
if (isset($_GET['sort']) && !empty($_GET['sort_field'])) {
    $sort_field = mysqli_real_escape_string($conn, $_GET['sort_field']);
    $sort_order = (isset($_GET['sort_order']) && strtolower($_GET['sort_order']) === 'desc') ? 'DESC' : 'ASC';
    $allowed_fields = ['item_name','quantity','expiry_date','pickup_location','donation_status','donation_remark'];
    if (in_array($sort_field, $allowed_fields)) {
        if ($sort_field === 'item_name') {
            $orderBy = " ORDER BY (SELECT item_name FROM food_item_inventory WHERE item_id = d.item_id) $sort_order";
        } elseif ($sort_field === 'quantity') {
            $orderBy = " ORDER BY (SELECT quantity FROM food_item_inventory WHERE item_id = d.item_id) $sort_order";
        } elseif ($sort_field === 'expiry_date') {
            $orderBy = " ORDER BY (SELECT expiry_date FROM food_item_inventory WHERE item_id = d.item_id) $sort_order";
        } else {
            $orderBy = " ORDER BY d.$sort_field $sort_order";
        }
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

    <button class="menu-item" onclick="window.location.href='dashboard_page.html'">
      <img src="pic/home.png" class="icon"> Dashboard
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
        <p class="username" id="username"></p>
        <p class="role">User Profile</p>
        <button onclick="logout()" class="logout-btn">Logout</button>
      </div>
    </div>
  </div>

  <!-- Main -->
  <div class="main-content">
    <div class="header">
      <h1>Donation Listing</h1>
    </div>

    <div class="controls">
      <div class="controls-left" style="display:flex;gap:10px;align-items:center;">
        <!-- Search form (top-left) -->
        <form method="GET" action="donation_list.php" style="display:flex;gap:8px;align-items:center;" onsubmit="return validateSearchInput(this)">
          <input type="text" id="searchInput" name="search" placeholder="Search item name..." style="padding:6px 8px;border-radius:4px;border:1px solid #ccc;" value="<?php echo isset($_GET['search']) ? htmlspecialchars($_GET['search']) : ''; ?>">
          <input type="hidden" name="filter" value="<?php echo isset($_GET['filter']) ? '1' : ''; ?>">
          <?php if(isset($_GET['filter'])): ?>
            <?php if(isset($_GET['expiry_date_from'])): ?><input type="hidden" name="expiry_date_from" value="<?php echo htmlspecialchars($_GET['expiry_date_from']); ?>"><?php endif; ?>
            <?php if(isset($_GET['expiry_date_to'])): ?><input type="hidden" name="expiry_date_to" value="<?php echo htmlspecialchars($_GET['expiry_date_to']); ?>"><?php endif; ?>
          <?php endif; ?>
          <?php if(isset($_GET['sort']) && isset($_GET['sort_field'])): ?>
            <input type="hidden" name="sort" value="1">
            <input type="hidden" name="sort_field" value="<?php echo htmlspecialchars($_GET['sort_field']); ?>">
            <input type="hidden" name="sort_order" value="<?php echo isset($_GET['sort_order']) ? htmlspecialchars($_GET['sort_order']) : 'asc'; ?>">
          <?php endif; ?>
          <button type="submit" class="action-btn search-btn" style="padding:6px 10px;">Search</button>
        </form>
        </form>

        <button class="action-btn edit-btn" style="min-width:110px;max-width:110px;" onclick="openFilterPopup()">Filter</button>
        <button class="action-btn edit-btn" style="min-width:110px;max-width:110px;" onclick="openSortPopup()">Sort By</button>
      </div>
    </div>

    <!-- Filter Popup -->
    <div class="popup" id="filterPopup" style="display:none;">
      <div class="popup-content" style="max-width:400px;margin:auto;">
        <h2>Filter Donations</h2>
        <form method="GET" action="donation_list.php">
          <input type="hidden" name="filter" value="1">
          <?php if(isset($_GET['search'])): ?>
          <input type="hidden" name="search" value="<?php echo htmlspecialchars($_GET['search']); ?>">
          <?php endif; ?>
          
          <!-- Expiry Date Filters -->
          <div class="form-group" style="margin-bottom: 15px;">
            <label for="filterExpiryFrom">Expiry Date From</label>
            <input type="date" name="expiry_date_from" id="filterExpiryFrom" style="width: 100%;" 
              value="<?php echo isset($_GET['expiry_date_from']) ? htmlspecialchars($_GET['expiry_date_from']) : ''; ?>">
          </div>

          <div class="form-group" style="margin-bottom: 15px;">
            <label for="filterExpiryTo">Expiry Date To</label>
            <input type="date" name="expiry_date_to" id="filterExpiryTo" style="width: 100%;" 
              value="<?php echo isset($_GET['expiry_date_to']) ? htmlspecialchars($_GET['expiry_date_to']) : ''; ?>">
          </div>

          <div class="form-buttons">
            <button type="submit" class="action-btn edit-btn" style="min-width:110px;max-width:110px;">Apply</button>
            <button type="button" class="action-btn" style="min-width:110px;max-width:110px;background:linear-gradient(135deg, #e74c3c, #c0392b);" onclick="window.location.href='donation_list.php'">Remove Filter</button>
            <button type="button" class="action-btn" style="min-width:110px;max-width:110px;background:linear-gradient(135deg, #95a5a6, #7f8c8d);" onclick="closeFilterPopup()">Cancel</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Sort Popup -->
    <div class="popup" id="sortPopup" style="display:none;">
      <div class="popup-content" style="max-width:400px;margin:auto;">
        <h2>Sort Donations</h2>
        <form method="GET" action="donation_list.php">
          <input type="hidden" name="sort" value="1">
          <?php if(isset($_GET['search'])): ?>
          <input type="hidden" name="search" value="<?php echo htmlspecialchars($_GET['search']); ?>">
          <?php endif; ?>
          <div class="form-group" style="margin-bottom: 15px;">
            <label for="sortField">Sort By</label>
            <select name="sort_field" id="sortField" style="width:100%;">
              <option value="item_name">Item Name</option>
              <option value="quantity">Quantity</option>
              <option value="expiry_date">Expiry Date</option>
              <option value="pickup_location">Pickup Location</option>
              <option value="donation_status">Status</option>
              <option value="donation_remark">Remark</option>
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
            <button type="button" class="action-btn" style="min-width:110px;max-width:110px;background:linear-gradient(135deg, #e74c3c, #c0392b);" onclick="window.location.href='donation_list.php'">Remove Sort</button>
            <button type="button" class="action-btn" style="min-width:110px;max-width:110px;background:linear-gradient(135deg, #95a5a6, #7f8c8d);" onclick="closeSortPopup()">Cancel</button>
          </div>
        </form>
      </div>
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

      <?php
      $hasRows = false;
      while($row = mysqli_fetch_assoc($result)) {
        $hasRows = true;
      ?>
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
      <?php }
      if (!$hasRows) {
      ?>
        <tr><td colspan="7" style="text-align:center;color:#b00020;font-weight:500;">No item found</td></tr>
      <?php } ?>
    </table>
  </div>

  <script>
    function openFilterPopup() {
      document.getElementById('filterPopup').style.display = 'block';
    }

    function closeFilterPopup() {
      document.getElementById('filterPopup').style.display = 'none';
    }

    function openSortPopup() {
      document.getElementById('sortPopup').style.display = 'block';
    }

    function closeSortPopup() {
      document.getElementById('sortPopup').style.display = 'none';
    }
    
    // Validate search input: only alphabet chars and spaces allowed
    function validateSearchInput(form) {
      var input = form.querySelector('input[name="search"]');
      if (!input) return true;
      var val = input.value.trim();
      if (val === '') return true;
      var re = /^[A-Za-z\s]+$/;
      if (!re.test(val)) {
        if (window.Swal) {
          Swal.fire({
            icon: 'error',
            title: 'Invalid search',
            text: 'Search may only contain alphabet characters and spaces.',
            timer: 2500,
            showConfirmButton: false
          });
        } else {
          alert('Search may only contain alphabet characters and spaces.');
        }
        return false;
      }
      return true;
    }
  </script>
  <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>

  <!-- Edit Donation Popup -->
  <div class="popup" id="editDonatePopup" style="display:none;">
    <div class="popup-content" style="max-width:500px;">
      <button class="close-btn" onclick="closeEditDonatePopup()">×</button>
      <h2>Edit Donation Item</h2>

      <form id="editDonateForm" method="POST" action="edit_donation.php">
        <input type="hidden" name="donation_id" id="editDonationId">

        <label for="editDonateItemName">Item Name</label>
        <input type="text" id="editDonateItemName" name="item_name" readonly>

        <div class="form-row">
          <div class="form-group">
            <label for="editPickup">Pickup Location <span style="color:red;">*</span></label>
            <input type="text" id="editPickup" name="pickup_location" required>
          </div>
          <div class="form-group">
            <label for="editDonateStatus">Status</label>
            <select id="editDonateStatus" name="donation_status" required>
              <option value="Available">Available</option>
              <option value="Donated">Donated</option>
            </select>
          </div>
        </div>

        <label for="editDonateRemark">Remark</label>
        <textarea id="editDonateRemark" name="donation_remark" placeholder="Optional: add any notes..."></textarea>

        <div class="form-buttons">
          <button type="submit" class="save">Save</button>
        </div>
      </form>
    </div>
  </div>

<script src="script.js"></script>


</body>
</html>
