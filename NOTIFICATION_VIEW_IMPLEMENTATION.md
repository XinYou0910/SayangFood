# Notification Detailed View Implementation

## Overview
This feature enables users to click "View" on notifications and be automatically directed to the appropriate page with the related item details popup displayed.

## Implementation Details

### 1. **notification_detail.php** (New API Endpoint)
**Purpose**: Retrieves detailed information about a notification and its associated item.

**Key Features**:
- Session validation: Only authenticated users can access
- Fetches notification metadata from the `notification` table
- Extracts item name from notification message using regex pattern matching
- Routes data retrieval based on `notification_type`:
  - **Inventory**: Queries `food_item_inventory` table using item name
  - **Donation**: Queries `donation` table (with JOIN to get item details)
- Error handling:
  - Returns 401 if user not authenticated
  - Returns 400 if notification ID missing
  - Returns 404 if notification not found
  - Returns item-not-found error message if item has been deleted

**Response Format**:
```json
{
  "notification_id": 123,
  "notification_type": "Inventory",
  "message": "\"Chicken\" is going to expire in 2 days!",
  "timestamp": "2025-11-16 10:30:00",
  "notification_status": "Unread",
  "extracted_item_name": "Chicken",
  "item_data": { /* food item or donation details */ },
  "item_type": "inventory",
  "error": null  // null if successful, error message if item not found
}
```

### 2. **notification1.php** (Updated Notification Page)
**Changes**:
- Added `class="view-notification"` and `data-type="..."` attributes to View link
- Updated JavaScript event listener to handle view notification clicks
- Calls `notification_detail.php` API to fetch item details
- Marks notification as read automatically (via `notification_actions.php`)
- Routes to appropriate page based on notification type
- Stores item data in `sessionStorage` for retrieval on destination page

**View Click Flow**:
1. User clicks "View" on a notification
2. JavaScript fetches notification details from `notification_detail.php`
3. If error occurs, SweetAlert displays error message
4. If successful:
   - Marks notification as read (via AJAX)
   - Stores item data in sessionStorage
   - Navigates to `inventory_list.php` or `donation_list.php`

### 3. **inventory_list.php** (Updated)
**Changes**:
- Added DOMContentLoaded listener to check sessionStorage
- If `shouldOpenViewPopup === 'true'` and item data exists:
  - Parses item JSON from sessionStorage
  - Calls `openViewPopup(itemData)` to display popup
  - Clears sessionStorage to prevent persistence

**Result**: Food item details popup opens automatically with the item data from notification

### 4. **donation_list.php** (Updated)
**Changes**:
- Added DOMContentLoaded listener to check sessionStorage
- If `shouldOpenEditDonatePopup === 'true'` and donation data exists:
  - Parses donation JSON from sessionStorage
  - Calls `openEditDonatePopup(donationData)` to display popup
  - Clears sessionStorage to prevent persistence

**Result**: Edit donation popup opens automatically with the donation data from notification

## User Flow

### Inventory Notification View:
1. User clicks "View" on an inventory notification (e.g., "Chicken is going to expire in 2 days!")
2. System fetches chicken item details from food_item_inventory
3. Notification is marked as read
4. User is redirected to inventory_list.php
5. "View Food Item" popup automatically displays with chicken details
6. User can edit, donate, or mark as meal from the popup

### Donation Notification View:
1. User clicks "View" on a donation notification (e.g., "Bread is ready for donation!")
2. System fetches bread donation record from donation table
3. Notification is marked as read
4. User is redirected to donation_list.php
5. "Edit Donation Item" popup automatically displays with bread donation details
6. User can update pickup location, status, remarks, and save

## Error Handling

**Scenario 1**: Item has been deleted
- `notification_detail.php` returns error message
- User sees SweetAlert: "Food item details not found. The item may have been deleted."

**Scenario 2**: Donation record not found
- `notification_detail.php` returns error message
- User sees SweetAlert: "Donation details not found. The donation may have been deleted."

**Scenario 3**: API error during fetch
- JavaScript catches error and displays: "Failed to fetch item details"

**Scenario 4**: sessionStorage parsing fails
- Error logged to console
- sessionStorage cleared to prevent loops
- User remains on destination page (can navigate manually)

## Technical Notes

- **sessionStorage**: Used instead of localStorage because data is session-specific and should not persist after browser close
- **Prepared Statements**: All database queries use prepared statements for SQL injection prevention
- **User Isolation**: All queries filtered by `user_id` from session to ensure users only see their own data
- **Message Parsing**: Item names extracted from notification messages using regex: `/"([^"]+)"/`
- **Notification Status Update**: Mark-as-read happens via existing `notification_actions.php` endpoint (no changes needed)

## Database Queries

### notification_detail.php - Inventory Query:
```sql
SELECT * FROM food_item_inventory 
WHERE user_id = ? AND item_name = ? 
LIMIT 1
```

### notification_detail.php - Donation Query:
```sql
SELECT d.*, f.item_name, f.quantity, f.expiry_date
FROM donation d
JOIN food_item_inventory f ON f.item_id = d.item_id
WHERE d.user_id = ? AND d.item_id = ?
LIMIT 1
```

## Testing Checklist

- [ ] Add food item expiring soon → triggers inventory notification
- [ ] Click View on inventory notification → redirected to inventory_list.php with popup open
- [ ] Delete food item, then click View on old notification → shows error message
- [ ] Click View on donation notification → redirected to donation_list.php with popup open
- [ ] Mark notification as read, verify card status changes
- [ ] Verify notification is marked as read when View is clicked
- [ ] Test with multiple items of same name (should get first match via LIMIT 1)
- [ ] Test with special characters in item names

## Files Modified

1. ✅ `notification1.php` - View button handler and routing logic
2. ✅ `notification_detail.php` - NEW API endpoint for fetching item details
3. ✅ `inventory_list.php` - Auto-open popup from sessionStorage
4. ✅ `donation_list.php` - Auto-open popup from sessionStorage

## Files NOT Modified (No Changes Needed)

- `notification_actions.php` - Mark-as-read endpoint (already exists)
- `script.js` - `openViewPopup()` and `openEditDonatePopup()` functions already exist
- `inventory_list.css` - No CSS changes needed
- `notification1.css` - No CSS changes needed
