<?php
/**
 * trigger_expiry_check.php
 * 
 * A simple endpoint to manually trigger the expiry check.
 * Can be called from the browser, AJAX, or scheduled tasks.
 * Optional: add a shared secret for security.
 */

// Optional: Add a security token to prevent unauthorized calls
$TRIGGER_TOKEN = 'sayangfood_expiry_check_secret_123'; // Change this to something secure

// Check for token in GET or POST
$provided_token = $_GET['token'] ?? $_POST['token'] ?? '';

if (empty($provided_token) || $provided_token !== $TRIGGER_TOKEN) {
  http_response_code(403);
  echo json_encode(['error' => 'Unauthorized']);
  exit;
}

// Include the check_expiry logic
include 'check_expiry.php';
?>
