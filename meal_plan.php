<?php
session_start();
if (!isset($_SESSION['user_id'])) {
  header('Location: dashboard_page.html'); exit;
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>SayangFood — Meal Plan</title>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Serif&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="meal_plan.css?v=6"/>
</head>
<body>
  <script>window.CURRENT_USER_ID = <?php echo intval($_SESSION['user_id']); ?>;</script>

  <div id="pageContent">
    <!-- Sidebar (same as your last file) -->
    <aside class="sidebar">
      <div class="logo-container">
        <img class="logo-img" src="pic/logo.png" alt="SayangFood"/>
        <div class="logo-text">
          <div class="brand">SayangFood</div>
          <div class="tagline">Food Management System</div>
        </div>
      </div>

      <button class="menu-item" onclick="location.href='dashboard_page.html'">
        <img class="icon" src="pic/home.png" alt=""> Home
      </button>

      <button class="menu-item dropdown-btn active">
        <img class="icon" src="pic/search.png" alt=""> Browse Food Items
        <span class="arrow">▾</span>
      </button>

      <div class="dropdown-container" id="dropdownMenu">
        <button class="submenu-item" onclick="location.href='inventory_list.php'">Inventory</button>
        <button class="submenu-item active" onclick="location.href='meal_plan.php'">Meal Plan</button>
        <button class="submenu-item" onclick="location.href='donation_list.php'">Donations</button>
      </div>

      <button class="menu-item"><img class="icon" src="pic/data-analytics.png" alt=""> Food Analytics</button>
      <button class="menu-item"><img class="icon" src="pic/notification.png"  alt=""> Notification</button>

      <div class="profile">
        <img class="profile-img" src="pic/user.png" alt="">
        <div class="profile-info">
          <p class="username" id="username">User</p>
          <p class="role">User Profile</p>
          <button class="logout-btn" onclick="localStorage.removeItem('user_name');location.href='Homepage.html'">Logout</button>
        </div>
      </div>
    </aside>

    <!-- MAIN -->
    <main class="main-content">
      <header class="header">
        <h1>Meal Plan</h1>
        <div class="month-under-title" id="monthYear"></div>

        <div class="date-wrapper">
          <button class="calendar-btn" id="calendarBtn" aria-label="Pick a date">📅</button>

          <div class="date-bar">
            <button class="nav-arrow" id="prevDay" aria-label="Previous day">‹</button>
            <div id="pillsRow" class="pills-row"><!-- filled by JS --></div>
            <button class="nav-arrow" id="nextDay" aria-label="Next day">›</button>
            <input type="date" id="jumpDate" hidden />
          </div>
        </div>
      </header>

      <section class="board">
        <div class="grid-2">
          <div class="day-card">
            <h3 id="dayTitle"></h3>
            <p class="day-sub">Plan Your Meal for this day</p>

            <div class="slots-2">
              <div class="slot">
                <div class="slot-title">Breakfast</div>
                <div class="meal-row" id="breakfast-list"></div>
                <div class="slot-controls"><button class="slot-add" data-slot="breakfast">+</button></div>
              </div>

              <div class="slot">
                <div class="slot-title">Lunch</div>
                <div class="meal-row" id="lunch-list"></div>
                <div class="slot-controls"><button class="slot-add" data-slot="lunch">+</button></div>
              </div>

              <div class="slot">
                <div class="slot-title">Dinner</div>
                <div class="meal-row" id="dinner-list"></div>
                <div class="slot-controls"><button class="slot-add" data-slot="dinner">+</button></div>
              </div>

              <div class="slot">
                <div class="slot-title">Other</div>
                <div class="meal-row" id="other-list"></div>
                <div class="slot-controls"><button class="slot-add" data-slot="other">+</button></div>
              </div>
            </div>
          </div>

          <!-- RIGHT COLUMN: suggestions + expiring separately -->
          <div class="right-column">
            <aside class="suggestions-card">
              <h3>Suggestions</h3>
              <div class="suggestions-grid" id="suggestionTiles"></div>

              <div class="more-suggestions-wrap">
                <button id="moreSuggestionsBtn" class="more-btn" aria-haspopup="dialog" aria-controls="suggestionsModal">⋯</button>
              </div>
            </aside>

            <aside class="expiring-card">
              <h3>Expiring Item</h3>
              <table class="exp-table">
                <thead>
                  <tr><th>Item Name</th><th>Quantity</th><th>Day/s Left</th></tr>
                </thead>
                <tbody id="expiringList"></tbody>
              </table>
            </aside>
          </div>
        </div>
      </section>
    </main>
  </div>

  <!-- ADD MEAL modal -->
  <div id="addMealModal" class="modal" aria-hidden="true" role="dialog" aria-labelledby="addMealTitle">
    <div class="modal-backdrop" id="addMealBackdrop"></div>

    <div class="modal-panel modal-panel-lg" role="document">
      <header class="modal-header">
        <!-- JS will change this text to "Add Meal for Lunch", etc. -->
        <h2 id="addMealTitle">Add Meal</h2>
        <button id="addMealClose" class="modal-close" aria-label="Close">&times;</button>
      </header>

      <div class="modal-body">
        <form id="addMealForm" autocomplete="off">
          <!-- Meal name -->
          <div style="margin-bottom: 20px;">
            <label style="display: block; font-size: 13px; font-weight: 600; color: #4a7c59; margin-bottom: 8px; text-transform: capitalize;">Meal name</label>
            <input type="text" name="meal_name" placeholder="e.g. Fried Rice" style="width: 100%; padding: 10px 14px; border-radius: 8px; border: 1px solid rgba(0,0,0,0.08); font-size: 14px; box-sizing: border-box;">
          </div>

          <!-- Ingredients section -->
          <div style="margin-bottom: 20px;">
            <label style="display: block; font-size: 16px; font-weight: 700; color: var(--primary-green); margin-bottom: 12px;">Ingredients</label>
            
            <!-- Container where JS appends ingredient rows -->
            <div class="grid-form-two" style="display: flex; flex-direction: column; gap: 8px;"></div>
            
            <!-- Add ingredient button -->
            <button type="button" id="addIngredientBtn" style="margin-top: 12px; padding: 10px 16px; background: #fff; border: 1px solid rgba(0,0,0,0.08); border-radius: 8px; color: var(--primary-green); font-weight: 600; cursor: pointer;">+ Add ingredient</button>
          </div>

          <!-- Remark field -->
          <div style="margin-bottom: 20px;">
            <label style="display: block; font-size: 13px; font-weight: 600; color: #4a7c59; margin-bottom: 8px; text-transform: capitalize;">Remark (optional)</label>
            <textarea name="meal_remark" placeholder="Optional: e.g. make for kids, bring to workplace..." style="width: 100%; padding: 10px 14px; border-radius: 8px; border: 1px solid rgba(0,0,0,0.08); font-size: 14px; box-sizing: border-box; min-height: 80px; resize: vertical; font-family: inherit;"></textarea>
          </div>

        </form>
      </div>

      <footer class="modal-footer" style="display: flex; gap: 12px; justify-content: flex-end; padding: 16px 20px; border-top: 1px solid rgba(0,0,0,0.06);">
        <button type="button" id="addMealCancel" style="padding: 10px 20px; border: 1px solid rgba(0,0,0,0.08); background: #fff; border-radius: 8px; cursor: pointer; font-weight: 600;">Cancel</button>
        <button type="submit" form="addMealForm" style="padding: 10px 24px; background: var(--primary-green); color: #fff; border: none; border-radius: 8px; cursor: pointer; font-weight: 700;">Add Meal</button>
      </footer>
    </div>
  </div>

  <!-- Suggestions Modal -->
  <div id="suggestionsModal" class="modal" role="dialog" aria-modal="true" aria-hidden="true" aria-labelledby="suggestionsModalTitle">
    <div class="modal-backdrop" id="modalBackdrop"></div>
    <div class="modal-panel" role="document">
      <header class="modal-header">
        <h2 id="suggestionsModalTitle">All Suggestions</h2>
        <button id="closeModalBtn" class="modal-close" aria-label="Close suggestions">&times;</button>
      </header>

      <div class="modal-body">
        <p class="muted">Click a suggestion to add it to your selected slot.</p>
        <div id="allSuggestionsList" class="all-suggestions-grid"></div>
      </div>

      <footer class="modal-footer">
        <button id="modalCloseFooter" class="action-btn">Close</button>
      </footer>
    </div>
  </div>

  <!-- Recipe Detail Modal -->
  <div id="recipeDetailModal" class="modal" aria-hidden="true" role="dialog" aria-labelledby="recipeDetailTitle">
    <div class="modal-backdrop" id="recipeDetailModalBackdrop"></div>
    <div class="modal-panel" role="document" style="width:min(880px,92%); max-height:82vh;">
      <header class="modal-header">
        <h2 id="recipeDetailTitle">Recipe</h2>
        <button id="recipeDetailClose" class="modal-close" aria-label="Close">&times;</button>
      </header>
      <div class="modal-body" id="recipeDetailBody">
        <p class="muted">Loading...</p>
      </div>
      <footer class="modal-footer" style="gap:10px;">
        <button id="recipeDetailCancel" class="action-btn">Close</button>
        <button id="recipeUseBtn" class="action-btn">Use</button>
      </footer>
    </div>
  </div>

  <!-- Choose Date & Slot Modal (shown after clicking Use) -->
  <div id="chooseDateSlotModal" class="modal" aria-hidden="true" role="dialog" aria-labelledby="chooseDateSlotTitle">
    <div class="modal-backdrop" id="chooseDateSlotModalBackdrop"></div>
    <div class="modal-panel" role="document" style="width:420px; max-height:80vh;">
      <header class="modal-header">
        <h2 id="chooseDateSlotTitle">Add to meal plan</h2>
        <button id="chooseDateSlotClose" class="modal-close" aria-label="Close">&times;</button>
      </header>
      <div class="modal-body" style="padding:12px;">
        <label style="display:block;margin-bottom:8px;font-weight:700;">Date</label>
        <input id="chooseDateSlotDate" type="date" style="width:100%;padding:8px 10px;margin-bottom:12px;border-radius:6px;border:1px solid #ddd;">

        <label style="display:block;margin-bottom:8px;font-weight:700;">Slot</label>
        <select id="chooseDateSlotSelect" style="width:100%;padding:8px 10px;border-radius:6px;border:1px solid #ddd;margin-bottom:12px;">
          <option value="breakfast">Breakfast</option>
          <option value="lunch" selected>Lunch</option>
          <option value="dinner">Dinner</option>
          <option value="other">Other</option>
        </select>

        <!-- NEW: remark input -->
        <label style="display:block;margin-bottom:8px;font-weight:700;">Remark (optional)</label>
        <textarea id="chooseDateSlotRemark" placeholder="Add a note (e.g. make for kids, bring to workplace...)" style="width:100%; padding:8px 10px; border-radius:6px; border:1px solid #ddd; min-height:80px; box-sizing:border-box; resize:vertical; font-family:inherit;"></textarea>
      </div>
      <footer class="modal-footer">
        <button id="chooseDateSlotCancel" class="btn-light">Cancel</button>
        <button id="chooseDateSlotConfirm" class="btn-green">Add</button>
      </footer>
    </div>
  </div>

  <script src="meal_plan.js?v=6"></script>
</body>
</html>
