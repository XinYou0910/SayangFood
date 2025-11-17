# Inventory Expiry Notification System

## Overview

This system automatically creates notifications when food items:
1. **Are expiring soon** (within 3 days/72 hours) — Message: `"[item_name]" is going to expire in X days! Would you want to plan it as meal or donate it?`
2. **Have expired** — Message: `"[item_name]" is expired!`

## Files Created

### 1. `check_expiry.php`
- Core script that checks all food items and creates notifications
- Queries `food_item_inventory` table
- Calculates days until expiry
- Inserts notifications into the `notification` table
- Prevents duplicate notifications (checks if notification for same item exists today)
- Updates `item_status` to 'Expired' for items past their date

### 2. `trigger_expiry_check.php`
- Simple endpoint to trigger the expiry check
- Includes a security token for protection against unauthorized calls
- Can be called from browser, AJAX, or scheduled task

## How to Use

### Option A: Manual Trigger (Browser)

Visit the trigger endpoint in your browser:
```
http://localhost/SayangFood/trigger_expiry_check.php?token=sayangfood_expiry_check_secret_123
```

Expected response:
```json
{"success": true, "message": "Expiry check completed"}
```

### Option B: Scheduled Task on Windows

To run the check automatically every day (or at any interval):

#### Step 1: Create a Batch File
Create a file called `run_expiry_check.bat` (anywhere on your system):

```batch
@echo off
REM Run the expiry check script via PHP CLI
cd C:\xampp\php
php.exe "C:\xampp\htdocs\SayangFood\check_expiry.php"
pause
```

(Note: Adjust the PHP path if your XAMPP is installed elsewhere)

#### Step 2: Schedule with Task Scheduler

1. Open **Windows Task Scheduler** (search in Start menu)
2. Click **Create Basic Task** (right sidebar)
3. Fill in:
   - **Name**: "SayangFood Expiry Check"
   - **Description**: "Check food items for expiry and create notifications"
4. **Trigger Tab**: Click "New..." → Choose your schedule:
   - **Daily** at 08:00 AM (recommended, once per day)
   - Or **Hourly** / **Every 30 minutes** if you want more frequent checks
5. **Action Tab**: Click "New..."
   - **Program/script**: `C:\xampp\php\php.exe`
   - **Add arguments (optional)**: `"C:\xampp\htdocs\SayangFood\check_expiry.php"`
6. Click **OK** and save

#### Step 3: Test the Task
Right-click the task you created → **Run** to test

Check the `notification1.php` page to see if notifications were created (refresh browser).

### Option C: AJAX from Dashboard (Auto-Check on Page Load)

To run the check every time a user opens the dashboard, add this to your dashboard page:

```javascript
// Auto-trigger expiry check on page load
fetch('trigger_expiry_check.php?token=sayangfood_expiry_check_secret_123')
  .then(res => res.json())
  .then(data => console.log('Expiry check triggered:', data))
  .catch(err => console.error('Expiry check error:', err));
```

## Notification Display

Notifications will appear in `notification1.php` with:
- **Type**: "Inventory"
- **Image**: `pic/inventory.png` (as per the image icons setup)
- **Status**: "Unread" (initially)
- **Timestamp**: When the notification was created

Users can then:
- Mark as Read
- Delete
- View the notification list

## Database Schema Expected

**Table**: `food_item_inventory`
- `item_id` (INT)
- `user_id` (INT)
- `item_name` (VARCHAR)
- `item_category` (VARCHAR)
- `quantity` (VARCHAR)
- `expiry_date` (DATE)
- `item_status` (VARCHAR) — values: 'Available', 'Used', 'Donated', 'Expired'
- `storage_place` (VARCHAR)
- `item_remark` (VARCHAR)

**Table**: `notification`
- `notification_id` (INT, AUTO_INCREMENT)
- `user_id` (INT)
- `notification_type` (VARCHAR) — will be "Inventory"
- `message` (VARCHAR)
- `notification_status` (VARCHAR) — values: 'Unread', 'Read'
- `timestamp` (DATETIME)

## Configuration

To change the expiry threshold (currently 3 days), edit `check_expiry.php` and modify:

```php
} elseif ($days_remaining <= 3) {  // Change 3 to any number of days
```

To change the security token, edit `trigger_expiry_check.php`:

```php
$TRIGGER_TOKEN = 'your_new_secret_token_here';
```

## Troubleshooting

1. **Notifications not appearing?**
   - Ensure `check_expiry.php` is being called (check Windows Task Scheduler logs)
   - Check PHP error logs in `C:\xampp\php\logs\`
   - Verify the `notification` table exists with correct schema

2. **Duplicate notifications?**
   - The script checks for existing notifications created today for the same item
   - Clear the notification table if you want fresh test data

3. **"Token not found" error?**
   - Make sure you're using the correct token from `trigger_expiry_check.php`
   - Or call `check_expiry.php` directly from Task Scheduler (no token needed)

## Testing

1. Log in to your SayangFood app
2. Add a food item with an expiry date 2 days from now
3. Trigger the check:
   - Via browser: http://localhost/SayangFood/trigger_expiry_check.php?token=sayangfood_expiry_check_secret_123
   - Or run Task Scheduler task manually
4. Go to `notification1.php` and look for the expiry notification
5. Verify the message format and timestamp

## Next Steps

- Test with real data
- Schedule the Task Scheduler job to run daily
- Monitor the notification volume and adjust frequency as needed
- (Optional) Add more notification types for donations, meal planning, etc.
