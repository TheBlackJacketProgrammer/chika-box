<?php
session_start();
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Initialize the online users array if it doesn't exist
if (!isset($_SESSION['online_users'])) {
    $_SESSION['online_users'] = array();
    error_log("Initialized online_users session array");
}

// Function to add a user to the online list
function addOnlineUser($username) {
    error_log("Attempting to add user: " . $username);
    if (!in_array($username, $_SESSION['online_users'])) {
        $_SESSION['online_users'][] = $username;
        error_log("User added successfully. Current users: " . implode(', ', $_SESSION['online_users']));
    } else {
        error_log("User already exists in the list");
    }
    return $_SESSION['online_users'];
}

// Function to remove a user from the online list
function removeOnlineUser($username) {
    error_log("Attempting to remove user: " . $username);
    $key = array_search($username, $_SESSION['online_users']);
    if ($key !== false) {
        unset($_SESSION['online_users'][$key]);
        $_SESSION['online_users'] = array_values($_SESSION['online_users']); // Reindex array
        error_log("User removed successfully. Current users: " . implode(', ', $_SESSION['online_users']));
    } else {
        error_log("User not found in the list");
    }
    return $_SESSION['online_users'];
}

// Function to get all online users
function getOnlineUsers() {
    error_log("Getting online users: " . implode(', ', $_SESSION['online_users']));
    return $_SESSION['online_users'];
}

// Handle AJAX requests
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $_POST['action'] ?? '';
    $username = $_POST['username'] ?? '';
    
    error_log("Received request - Action: " . $action . ", Username: " . $username);
    
    switch ($action) {
        case 'add':
            $users = addOnlineUser($username);
            echo json_encode(['users' => $users]);
            break;
            
        case 'remove':
            $users = removeOnlineUser($username);
            echo json_encode(['users' => $users]);
            break;
            
        case 'get':
            $users = getOnlineUsers();
            echo json_encode(['users' => $users]);
            break;
    }
}
?> 