<?php
$sessionStarted = session_start();
header('Content-Type: application/json');
include 'db_connect.php';
if (!$sessionStarted || !isset($_SESSION['user_id'])) {
  http_response_code(401);
  error_log("notification_actions.php: Unauthorized - session_started=" . ($sessionStarted ? '1' : '0') . " POST=" . json_encode($_POST) . "\n");
  echo json_encode(['error' => 'Unauthorized']);
  exit;
}
$currentUserId = $_SESSION['user_id'];
$action = $_POST['action'] ?? '';
error_log("notification_actions.php: user_id={$currentUserId}, action={$action}, POST=" . json_encode($_POST) . "\n");

switch ($action) {
  case 'mark_read':
    $id = intval($_POST['id'] ?? 0);
    if ($id) {
      $stmt = $conn->prepare("UPDATE notification SET notification_status = 'Read' WHERE notification_id = ? AND user_id = ?");
      $stmt->bind_param('ii', $id, $currentUserId);
      $stmt->execute();
      $affected = $stmt->affected_rows;
      error_log("notification_actions.php: mark_read user={$currentUserId} id={$id} affected={$affected}\n");
      echo json_encode(['success' => true, 'affected' => $affected]);
    } else {
      error_log("notification_actions.php: mark_read invalid id\n");
      echo json_encode(['error' => 'Invalid ID']);
    }
    break;

  case 'delete':
    $id = intval($_POST['id'] ?? 0);
    if ($id) {
      $stmt = $conn->prepare("DELETE FROM notification WHERE notification_id = ? AND user_id = ?");
      $stmt->bind_param('ii', $id, $currentUserId);
      $stmt->execute();
      $affected = $stmt->affected_rows;
      error_log("notification_actions.php: delete user={$currentUserId} id={$id} affected={$affected}\n");
      echo json_encode(['success' => true, 'affected' => $affected]);
    } else {
      error_log("notification_actions.php: delete invalid id\n");
      echo json_encode(['error' => 'Invalid ID']);
    }
    break;

  case 'mark_all_read':
    $stmt = $conn->prepare("UPDATE notification SET notification_status = 'Read' WHERE user_id = ? AND notification_status = 'Unread'");
    $stmt->bind_param('i', $currentUserId);
    $stmt->execute();
    $affected = $stmt->affected_rows;
    error_log("notification_actions.php: mark_all_read user={$currentUserId} affected={$affected}\n");
    echo json_encode(['success' => true, 'affected' => $affected]);
    break;

  case 'delete_read':
    $stmt = $conn->prepare("DELETE FROM notification WHERE user_id = ? AND notification_status = 'Read'");
    $stmt->bind_param('i', $currentUserId);
    $stmt->execute();
    $affected = $stmt->affected_rows;
    error_log("notification_actions.php: delete_read user={$currentUserId} affected={$affected}\n");
    echo json_encode(['success' => true, 'affected' => $affected]);
    break;

  default:
    echo json_encode(['error' => 'Invalid action']);
}
