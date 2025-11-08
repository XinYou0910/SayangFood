<?php
include 'db_connect.php';
session_start();
if (!isset($_SESSION['user_id'])) {
  header('Location: dashboard_page.html'); exit;
}
$uid = (int)$_SESSION['user_id'];

/* --------- Compute current week (Mon–Sun) --------- */
$weekStart = new DateTimeImmutable('monday this week');
$weekEnd   = $weekStart->modify('+6 days');
$from = $weekStart->format('Y-m-d');
$to   = $weekEnd->format('Y-m-d');

/* --------- Fetch this week meals with their first ingredient ---------
   We show one row per ingredient to match your UI (Meal + Item + Qty + Remark + Status)
----------------------------------------------------------------------- */
$sql = "
  SELECT
    mp.meal_id,
    mp.meal_date,
    mp.meal_slot,
    mp.meal_name,
    mp.meal_remark,
    COALESCE(mpi.item_name_snapshot,'') AS item_name,
    COALESCE(mpi.required_qty_text,
             TRIM(CONCAT(COALESCE(mpi.required_qty_value,''), ' ', COALESCE(mpi.required_qty_unit,'')))) AS qty_text,
    COALESCE(mpi.availability,'') AS availability
  FROM meal_plan mp
  LEFT JOIN meal_plan_item mpi ON mpi.meal_id = mp.meal_id
  WHERE mp.user_id = ?
    AND mp.meal_date BETWEEN ? AND ?
  ORDER BY mp.meal_date, FIELD(mp.meal_slot,'Breakfast','Lunch','Dinner'), mp.meal_id, mpi.mp_item_id
";
$stmt = $conn->prepare($sql);
$stmt->bind_param('iss', $uid, $from, $to);
$stmt->execute();
$res = $stmt->get_result();
$rows = $res->fetch_all(MYSQLI_ASSOC);

/* --------- Simple example suggestion (you can replace with generator later) --------- */
$suggestion = [
  'date'   => $weekStart->modify('+1 day')->format('Y-m-d'),
  'slot'   => 'Lunch',
  'meal'   => 'Tomato, Egg',
  'item'   => 'Canned Beans',
  'qty'    => '1 can',
  'remark' => 'Prepare for Kids',
  'status' => 'Available'
];
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Weekly Meal Plan • SayangFood</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="inventory_list.css">
<style>
  /* small page-specific helpers; everything else inherits inventory_list.css */
  .add-dashed {padding:12px 20px;border:2px dashed #cbd5e1;border-radius:12px;background:#f9fafb;
               cursor:pointer;font-size:16px;font-weight:600;color:#475569;}
  .status-chip{font-size:12px;padding:3px 8px;border-radius:999px;border:1px solid #e2e8f0;display:inline-block}
  .status-ok{background:#ecfdf5;border-color:#bbf7d0;color:#166534}
  .status-warn{background:#fff7ed;border-color:#fed7aa;color:#a16207}
</style>
</head>
<body>
  <!-- Hamburger for mobile, uses same handler as your other pages -->
  <button class="menu-toggle" onclick="toggleSidebar()">☰</button>

  <!-- Sidebar (copied structure/styles from inventory_list.php) -->
  <div class="sidebar">
    <div class="logo-container">
      <img src="pic/logo.png" alt="SayangFood" class="logo-img">
      <div class="logo-text">
        <span class="brand">SayangFood</span><br>
        <small>Food Management System</small>
      </div>
    </div>

    <button class="menu-item" onclick="location.href='dashboard_page.html'">
      <img src="pic/home.png" alt="" class="icon"> Dashboard
    </button>

    <button class="menu-item dropdown-btn" onclick="toggleDropdown()">
      <img src="pic/search.png" class="icon"> Browse Food Items
      <span class="arrow" id="arrowIcon">▼</span>
    </button>

    <div class="dropdown-container show" id="dropdownMenu">
      <button class="submenu-item" onclick="location.href='inventory_list.php'">Inventory</button>
      <button class="submenu-item active" onclick="location.href='meal_planner.php'">Weekly Meal</button>
      <button class="submenu-item" onclick="location.href='donation_list.php'">Donations</button>
    </div>

    <button class="menu-item"><img src="pic/data-analytics.png" class="icon"> Food Analytics</button>
    <button class="menu-item"><img src="pic/notification.png" class="icon"> Notification</button>

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
    <div class="header"><h1>Weekly Meal Plan</h1></div>

    <!-- Week bar -->
    <div class="controls">
      <div class="controls-left" style="display:flex;gap:10px;align-items:center;">
        <span><b>This Week:</b> <?php echo htmlspecialchars($from) ?> → <?php echo htmlspecialchars($to) ?></span>
      </div>
      <div class="controls-right">
        <button class="action-btn add-btn" id="saveBtn" onclick="savePlan()">
            CREATE MEAL PLAN
        </button>
      </div>
    </div>

    <!-- This Week table -->
    <table id="weekTable">
      <tr>
        <th>Meal Date</th>
        <th>Meal Slot</th>
        <th>Meal Name</th>
        <th>Item Name</th>
        <th>Quantity</th>
        <th>Remark</th>
        <th>Status</th>
      </tr>
      <tbody id="weekBody">
        <?php if ($rows): foreach ($rows as $r): ?>
          <tr>
            <td data-field="date"><?php echo htmlspecialchars($r['meal_date']) ?></td>
            <td data-field="slot"><?php echo htmlspecialchars($r['meal_slot']) ?></td>
            <td data-field="meal"><?php echo htmlspecialchars($r['meal_name']) ?></td>
            <td data-field="item"><?php echo htmlspecialchars($r['item_name']) ?></td>
            <td data-field="qty"><?php echo htmlspecialchars($r['qty_text']) ?></td>
            <td data-field="remark"><?php echo htmlspecialchars($r['meal_remark']) ?></td>
            <td>
              <?php
                $chip = ($r['availability']==='Available') ? 'status-ok' :
                        (($r['availability']==='') ? '' : 'status-warn');
                $text = $r['availability'] ?: '—';
              ?>
              <span class="status-chip <?php echo $chip; ?>"><?php echo htmlspecialchars($text); ?></span>
            </td>
          </tr>
        <?php endforeach; else: ?>
          <!-- same demo row as your screenshots when nothing saved yet -->
          <tr>
            <td data-field="date"><?php echo htmlspecialchars($weekStart->format('Y-m-d')) ?></td>
            <td data-field="slot">Breakfast</td>
            <td data-field="meal">Boiled Chicken Breast</td>
            <td data-field="item">Chicken Breast</td>
            <td data-field="qty">800g</td>
            <td data-field="remark">After Workout</td>
            <td><span class="status-chip status-warn">Ingredient Insufficient</span></td>
          </tr>
        <?php endif; ?>

        <tr id="addRow">
          <td colspan="7" style="text-align:center;padding:12px;">
            <button class="add-dashed" onclick="addNewMealRow()">＋ Add Meal</button>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- Suggested -->
    <div class="controls" style="margin-top:18px;">
      <div class="controls-left"><b>Suggested Meal Plan</b></div>
      <div class="controls-right">
        <button class="action-btn" onclick="rejectSuggestion()">Reject</button>
        <button class="action-btn edit-btn" onclick="acceptSuggestion()">Accept</button>
      </div>
    </div>

    <table>
      <tr>
        <th>Meal Date</th><th>Meal Slot</th><th>Meal Name</th>
        <th>Item Name</th><th>Quantity</th><th>Remark</th><th>Status</th>
      </tr>
      <tbody>
        <tr id="suggestRow">
          <td><?php echo htmlspecialchars($suggestion['date']) ?></td>
          <td><?php echo htmlspecialchars($suggestion['slot']) ?></td>
          <td><?php echo htmlspecialchars($suggestion['meal']) ?></td>
          <td><?php echo htmlspecialchars($suggestion['item']) ?></td>
          <td><?php echo htmlspecialchars($suggestion['qty']) ?></td>
          <td><?php echo htmlspecialchars($suggestion['remark']) ?></td>
          <td><span class="status-chip status-ok"><?php echo htmlspecialchars($suggestion['status']) ?></span></td>
        </tr>
      </tbody>
    </table>
  </div>
  <script src="script.js"></script>
</body>
</html>
