# Meal Plan Notification Feature

## Overview
This feature automatically creates notifications when users add meal plans and sends reminders for upcoming meals.

## Implementation Details

### 1. **api/add_meal.php** (Updated)
**Changes Made:**
- Added notification creation after successful meal plan insertion
- Creates notification with message format: `"meal_name" has been planned for DD MMM YYYY!`
- Notification type: `Meal Planning`
- Status: `Unread`

**Code Section:**
```php
// Create notification for meal plan
$notificationMsg = "\"$meal_name\" has been planned for " . date('d M Y', strtotime($meal_date)) . "!";
$notifStmt = $pdo->prepare("INSERT INTO notification (user_id, notification_type, message, notification_status, timestamp) VALUES (?, ?, ?, ?, NOW())");
$notifStmt->execute([$user_id, 'Meal Planning', $notificationMsg, 'Unread']);
```

### 2. **check_meal_plan.php** (New File)
**Purpose:** Checks for meal plans scheduled for tomorrow and creates reminder notifications

**Features:**
- Queries `meal_plan` table for meals with `meal_date = tomorrow` and `meal_status = 'Planned'`
- Creates notification for each meal: `"meal_name" is planned for tomorrow "meal_slot"!`
- Prevents duplicate notifications by checking if reminder already exists for today
- Can be called via:
  - **HTTP**: Direct API call or web browser
  - **CLI**: Cron job or Windows Task Scheduler
  - **Returns**: JSON response with notification count and any errors

**Notification Type:** `Meal Planning`
**Status:** `Unread`

**Setup for Recurring Checks:**

**Windows Task Scheduler:**
```
Task Name: Meal Plan Reminder Check
Trigger: Daily at 6:00 PM
Action: Run `curl.exe http://localhost/SayangFood/check_meal_plan.php`
OR: Run `php C:\xampp\htdocs\SayangFood\check_meal_plan.php`
```

**Linux Cron:**
```bash
0 18 * * * curl http://localhost/SayangFood/check_meal_plan.php
# or
0 18 * * * php /var/www/html/SayangFood/check_meal_plan.php
```

### 3. **notification_detail.php** (Updated)
**Changes Made:**
- Added meal plan handling in the main notification type routing
- Extracts meal name from quoted text in notification message
- Queries `meal_plan` table for matching meals
- Returns most recent meal if multiple matches exist

**Code Section:**
```php
elseif (strcasecmp($notifType, 'Meal Planning') === 0) {
  $mealName = $itemName;
  
  $mealSql = "
    SELECT * FROM meal_plan
    WHERE user_id = ? AND LOWER(meal_name) = LOWER(?)
    ORDER BY meal_date DESC, meal_id DESC
    LIMIT 1
  ";
  
  $mealStmt = $conn->prepare($mealSql);
  $mealStmt->bind_param("is", $currentUserId, $mealName);
  $mealStmt->execute();
  $mealResult = $mealStmt->get_result();
  
  if ($mealResult->num_rows > 0) {
    $meal = $mealResult->fetch_assoc();
    $responseData['item_data'] = $meal;
    $responseData['item_type'] = 'meal_plan';
  }
}
```

**Response Format:**
```json
{
  "notification_id": 123,
  "notification_type": "Meal Planning",
  "message": "\"Fried Rice\" has been planned for 17 Nov 2025!",
  "timestamp": "2025-11-17 10:30:00",
  "notification_status": "Unread",
  "extracted_item_name": "Fried Rice",
  "item_data": { /* meal_plan table row */ },
  "item_type": "meal_plan"
}
```

### 4. **notification1.php** (Updated)
**Changes Made:**
- Added routing handler for `Meal Planning` notifications
- Routes to `meal_plan.php` with meal data in sessionStorage
- Follows same pattern as inventory and donation notifications

**Code Section:**
```javascript
else if (notifTypeNormalized === 'meal planning') {
  if (data.item_data) {
    sessionStorage.setItem('mealPlanData', JSON.stringify(data.item_data));
    sessionStorage.setItem('shouldOpenMealDetail', 'true');
    window.location.href = 'meal_plan.php';
  }
}
```

### 5. **meal_plan.php** (Updated)
**Changes Made:**
- Added DOMContentLoaded listener to check sessionStorage
- Automatically loads meal details when navigating from notifications
- Attempts to navigate to the meal's date
- Stores meal data for display/detail view

**Code Section:**
```javascript
if (shouldOpenMealDetail === 'true' && mealPlanData) {
  const meal = JSON.parse(mealPlanData);
  sessionStorage.removeItem('shouldOpenMealDetail');
  sessionStorage.removeItem('mealPlanData');
  
  // Set date and display meal details
  if (meal.meal_date && window.setSelectedDate) {
    window.setSelectedDate(meal.meal_date);
  }
  
  window.mealToDisplay = meal;
  if (typeof window.openMealDetail === 'function') {
    window.openMealDetail(meal);
  }
}
```

## User Flow

### Notification 1: Meal Added
1. User creates a meal plan (e.g., "Fried Rice" for 17 Nov 2025, Breakfast)
2. `api/add_meal.php` executes successfully
3. Notification created immediately: `"Fried Rice" has been planned for 17 Nov 2025!`
4. User sees notification in notification list with type "Meal Planning"

### Notification 2: Tomorrow Reminder
1. Scheduled task runs at 6:00 PM (or configured time)
2. `check_meal_plan.php` queries for meals with `meal_date = tomorrow`
3. For each meal found, creates reminder: `"Fried Rice" is planned for tomorrow "Breakfast"!`
4. Next day, user sees reminder notification

### Viewing Meal Details
1. User clicks "View" on a meal notification
2. System fetches meal details from `meal_plan` table
3. Notification is marked as read
4. User redirected to `meal_plan.php`
5. Calendar automatically navigates to meal's date
6. Meal details are displayed/highlighted

## Error Handling

**Scenario 1:** Meal has been deleted
- `notification_detail.php` returns error
- User sees SweetAlert: "Meal plan details not found. The meal plan may have been deleted."

**Scenario 2:** Meal plan not found by name
- `notification_detail.php` returns error
- User sees error message

**Scenario 3:** Meal plan.php missing display function
- Fallback shows simple alert with meal info
- Data stored in `window.mealToDisplay` for manual inspection

## Database Queries

### Insert Meal Notification (add_meal.php)
```sql
INSERT INTO notification (user_id, notification_type, message, notification_status, timestamp)
VALUES (?, 'Meal Planning', ?, 'Unread', NOW())
```

### Check Tomorrow's Meals (check_meal_plan.php)
```sql
SELECT * FROM meal_plan
WHERE meal_date = ? AND meal_status = 'Planned'
ORDER BY user_id, meal_slot
```

### Fetch Meal Details (notification_detail.php)
```sql
SELECT * FROM meal_plan
WHERE user_id = ? AND LOWER(meal_name) = LOWER(?)
ORDER BY meal_date DESC, meal_id DESC
LIMIT 1
```

### Check for Duplicate Reminders (check_meal_plan.php)
```sql
SELECT notification_id FROM notification
WHERE user_id = ? AND notification_type = 'Meal Planning'
  AND message LIKE ? AND DATE(timestamp) = ?
LIMIT 1
```

## Technical Notes

- **Message Format Parsing:** Item names extracted from notification messages using regex: `/"([^"]+)"/`
- **Date Format:** Meal dates stored as `YYYY-MM-DD` in database, formatted as `DD MMM YYYY` in notifications
- **Slot Format:** Meal slots (Breakfast, Lunch, Dinner, Other) capitalized for consistency
- **Duplicate Prevention:** Reminders checked against today's date to prevent multiple notifications
- **sessionStorage:** Used for temporary data transfer between pages (cleared after use)
- **Fallback Logic:** If meal detail function unavailable, simple alert displays meal info

## Testing Checklist

- [ ] Create a meal plan and verify notification appears in list
- [ ] Click "View" on meal notification and verify redirect to meal_plan.php
- [ ] Verify meal's date is highlighted/selected on redirected page
- [ ] Delete a meal and click "View" on old notification (should show error)
- [ ] Set up scheduled task to run `check_meal_plan.php`
- [ ] Create meal plan for tomorrow and run check (should create reminder)
- [ ] Verify reminder notifications appear for correct meals
- [ ] Check that duplicate reminders are not created for same meal

## Files Modified

1. ✅ `api/add_meal.php` - Added notification on meal creation
2. ✅ `check_meal_plan.php` - NEW file for tomorrow reminders
3. ✅ `notification_detail.php` - Added meal plan data retrieval
4. ✅ `notification1.php` - Added meal plan routing
5. ✅ `meal_plan.php` - Added sessionStorage handler

## Files NOT Modified (No Changes Needed)

- `notification_actions.php` - Mark-as-read endpoint works as-is
- `notification1.css` - CSS works for all notification types
- `script.js` - No changes needed
- `meal_plan.js` - No changes needed (meal display handled separately)
