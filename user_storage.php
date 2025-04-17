<?php
// Enable error reporting
error_reporting(E_ALL);
ini_set('display_errors', 1);

// File to store online users
$storageFile = 'online_users.json';

// Initialize storage file if it doesn't exist
if (!file_exists($storageFile)) {
    file_put_contents($storageFile, json_encode(['users' => []]));
}

// Function to get all online users
function getOnlineUsers() {
    global $storageFile;
    $data = json_decode(file_get_contents($storageFile), true);
    return $data['users'] ?? [];
}

// Function to add a user
function addUser($username) {
    global $storageFile;
    $data = json_decode(file_get_contents($storageFile), true);
    if (!in_array($username, $data['users'])) {
        $data['users'][] = $username;
        file_put_contents($storageFile, json_encode($data));
    }
    return $data['users'];
}

// Function to remove a user
function removeUser($username) {
    global $storageFile;
    $data = json_decode(file_get_contents($storageFile), true);
    $key = array_search($username, $data['users']);
    if ($key !== false) {
        unset($data['users'][$key]);
        $data['users'] = array_values($data['users']); // Reindex array
        file_put_contents($storageFile, json_encode($data));
    }
    return $data['users'];
}

// Handle AJAX requests
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $_POST['action'] ?? '';
    $username = $_POST['username'] ?? '';
    
    switch ($action) {
        case 'add':
            $users = addUser($username);
            echo json_encode(['users' => $users]);
            break;
            
        case 'remove':
            $users = removeUser($username);
            echo json_encode(['users' => $users]);
            break;
            
        case 'get':
            $users = getOnlineUsers();
            echo json_encode(['users' => $users]);
            break;
    }
}
?> 