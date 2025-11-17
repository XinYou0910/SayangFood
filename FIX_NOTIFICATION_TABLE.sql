-- ===================================================
-- FIX: Add AUTO_INCREMENT PRIMARY KEY to notification table
-- ===================================================
-- 
-- IMPORTANT: 
-- - Run this in phpMyAdmin or MySQL console
-- - This will CREATE a backup first (notification_backup_YYYYMMDD)
-- - Ensure you have database permissions
-- - Test in a dev environment first if possible
-- 
-- If you get errors like "Multiple primary keys" or duplicate ids, 
-- the table may already have constraints. Comment out the ALTER and 
-- run just the BACKUP + SHOW commands to inspect first.

-- STEP 1: BACKUP the notification table (IMPORTANT!)
CREATE TABLE notification_backup_20251117 AS SELECT * FROM notification;
-- If the backup succeeds, you'll see: "Query OK, N rows affected"
-- The backup is now safe to reference if anything goes wrong.

-- STEP 2: Show current structure (inspect before modifying)
DESCRIBE notification;
-- This will show all columns and their properties.
-- Look for "Key" column - check if notification_id has a "PRI" marker.

-- STEP 3: Modify the notification table to add AUTO_INCREMENT PRIMARY KEY
-- Note: This assumes notification_id is an INT column and no primary key exists yet.
ALTER TABLE notification MODIFY notification_id INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY;

-- STEP 4: Verify the change
DESCRIBE notification;
-- notification_id should now show "PRI" under "Key" and "auto_increment" under "Extra"

-- STEP 5: If the ALTER fails, try a different approach:
-- (Only run this if STEP 3 fails with "Multiple primary keys" or similar)
-- ALTER TABLE notification ADD PRIMARY KEY (notification_id);
-- Then re-run STEP 3.

-- After running this script, test the notification view/mark/delete functions in the app.
-- Your notification_id values will be auto-incremented starting from the next insert.
