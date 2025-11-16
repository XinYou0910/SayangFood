<?php
session_start();
include 'db_connect.php';
if (!isset($_SESSION['user_id'])) {
  http_response_code(401);
  echo json_encode(['error' => 'Unauthorized']);
  exit;
}
header('Content-Type: application/json');
$currentUserId = $_SESSION['user_id'];
$action = $_POST['action'] ?? '';

switch ($action) {
  case 'mark_read':
    $id = intval($_POST['id'] ?? 0);
    if ($id) {
      $stmt = $conn->prepare("UPDATE notification SET notification_status = 'Read' WHERE notification_id = ? AND user_id = ?");
      $stmt->bind_param('ii', $id, $currentUserId);
      $stmt->execute();
      echo json_encode(['success' => true]);
    } else {
      echo json_encode(['error' => 'Invalid ID']);
    }
    break;

  case 'delete':
    $id = intval($_POST['id'] ?? 0);
    if ($id) {
      $stmt = $conn->prepare("DELETE FROM notification WHERE notification_id = ? AND user_id = ?");
      $stmt->bind_param('ii', $id, $currentUserId);
      $stmt->execute();
      echo json_encode(['success' => true]);
    } else {
      echo json_encode(['error' => 'Invalid ID']);
    }
    break;

  case 'mark_all_read':
    $stmt = $conn->prepare("UPDATE notification SET notification_status = 'Read' WHERE user_id = ? AND notification_status = 'Unread'");
    $stmt->bind_param('i', $currentUserId);
    $stmt->execute();
    echo json_encode(['success' => true]);
    break;

  case 'delete_read':
    $stmt = $conn->prepare("DELETE FROM notification WHERE user_id = ? AND notification_status = 'Read'");
    $stmt->bind_param('i', $currentUserId);
    $stmt->execute();
    echo json_encode(['success' => true]);
    break;

  default:
    echo json_encode(['error' => 'Invalid action']);
}
