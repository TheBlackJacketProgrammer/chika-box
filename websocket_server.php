<?php
// Enable error reporting for debugging
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Include Composer's autoloader
require 'vendor/autoload.php';

// Import necessary classes from Ratchet and React
use Ratchet\Server\IoServer;
use Ratchet\Http\HttpServer;
use Ratchet\WebSocket\WsServer;
use React\EventLoop\Factory;
use React\Socket\Server;

/**
 * GameWebSocket class - Handles WebSocket connections and messages
 * Implements Ratchet's MessageComponentInterface for WebSocket functionality
 */
class GameWebSocket implements \Ratchet\MessageComponentInterface {
    // Store connected clients
    protected $clients;
    // Store active games (can be expanded for game management)
    protected $games;
    // Store usernames for each connection
    protected $usernames;
    // Store sessions for each connection
    protected $sessions;

    public function __construct() {
        // Initialize clients storage and games array
        $this->clients = new \SplObjectStorage;
        $this->games = array();
        $this->usernames = array();
        $this->sessions = array();
    }

    /**
     * Called when a new client connects to the WebSocket server
     * @param \Ratchet\ConnectionInterface $conn - The connection object
     */
    public function onOpen(\Ratchet\ConnectionInterface $conn) {
        // Add the new client to the storage
        $this->clients->attach($conn);
        echo "New client connected! ({$conn->resourceId})\n";
    }

    /**
     * Called when a message is received from a client
     * @param \Ratchet\ConnectionInterface $from - The client who sent the message
     * @param string $msg - The message received
     */
    public function onMessage(\Ratchet\ConnectionInterface $from, $msg) {
        // Decode the JSON message
        $data = json_decode($msg, true);
        echo "Received message from client {$from->resourceId}: " . $msg . "\n";
        
        // Handle different message types
        if (isset($data['type'])) {
            switch ($data['type']) {
                case 'login':
                    // Store username for this connection
                    $this->usernames[$from->resourceId] = $data['username'];
                    echo "User {$data['username']} logged in (ID: {$from->resourceId})\n";
                    
                    // Send welcome message
                    $this->broadcastSystemMessage($data['username'] . ' has joined the chat');
                    break;
                
                case 'chat':
                    // Broadcast chat message to all clients
                    foreach ($this->clients as $client) {
                        $client->send(json_encode([
                            'type' => 'chat',
                            'username' => $data['username'],
                            'message' => $data['message']
                        ]));
                    }
                    break;

                case 'private':
                    // Handle private message
                    $fromUsername = $this->usernames[$from->resourceId];
                    $toUsername = $data['to'];
                    
                    // Find the recipient's connection
                    $recipientFound = false;
                    foreach ($this->clients as $client) {
                        if (isset($this->usernames[$client->resourceId]) && 
                            $this->usernames[$client->resourceId] === $toUsername) {
                            // Send to recipient
                            $client->send(json_encode([
                                'type' => 'private',
                                'from' => $fromUsername,
                                'to' => $toUsername,
                                'message' => $data['message']
                            ]));
                            $recipientFound = true;
                            break;
                        }
                    }
                    
                    // Also send back to sender for their display
                    $from->send(json_encode([
                        'type' => 'private',
                        'from' => $fromUsername,
                        'to' => $toUsername,
                        'message' => $data['message']
                    ]));
                    
                    if (!$recipientFound) {
                        // Notify sender if recipient is not found
                        $from->send(json_encode([
                            'type' => 'system',
                            'message' => "User {$toUsername} is not online"
                        ]));
                    }
                    break;
            }
        }
    }

    /**
     * Called when a client disconnects
     * @param \Ratchet\ConnectionInterface $conn - The connection that closed
     */
    public function onClose(\Ratchet\ConnectionInterface $conn) {
        // Get username before removing
        $username = isset($this->usernames[$conn->resourceId]) ? $this->usernames[$conn->resourceId] : null;
        
        // Remove the client from storage
        $this->clients->detach($conn);
        if (isset($this->usernames[$conn->resourceId])) {
            unset($this->usernames[$conn->resourceId]);
        }
        
        echo "Client {$conn->resourceId} has disconnected\n";
        if ($username) {
            echo "User {$username} left the chat\n";
            $this->broadcastSystemMessage($username . ' has left the chat');
        }
    }

    /**
     * Called when an error occurs
     * @param \Ratchet\ConnectionInterface $conn - The connection where the error occurred
     * @param \Exception $e - The exception that was thrown
     */
    public function onError(\Ratchet\ConnectionInterface $conn, \Exception $e) {
        echo "An error occurred: {$e->getMessage()}\n";
        $conn->close();
    }

    /**
     * Sends the current user list to a specific client
     * @param \Ratchet\ConnectionInterface $client - The client to send the list to
     */
    private function sendUserList(\Ratchet\ConnectionInterface $client) {
        $userList = array_values($this->usernames);
        echo "Sending user list to client {$client->resourceId}: " . implode(', ', $userList) . "\n";
        $message = json_encode([
            'type' => 'userlist',
            'users' => $userList
        ]);
        echo "Sending user list message: " . $message . "\n";
        try {
            $client->send($message);
            echo "User list sent successfully to client {$client->resourceId}\n";
        } catch (\Exception $e) {
            echo "Error sending user list to client {$client->resourceId}: " . $e->getMessage() . "\n";
        }
    }

    /**
     * Broadcasts the current list of online users to all clients
     */
    private function broadcastUserList() {
        $userList = array_values($this->usernames);
        echo "Broadcasting user list to all clients: " . implode(', ', $userList) . "\n";
        $message = json_encode([
            'type' => 'userlist',
            'users' => $userList
        ]);
        echo "Broadcasting user list message: " . $message . "\n";
        foreach ($this->clients as $client) {
            try {
                $client->send($message);
                echo "User list sent to client {$client->resourceId}\n";
            } catch (\Exception $e) {
                echo "Error sending user list to client {$client->resourceId}: " . $e->getMessage() . "\n";
            }
        }
    }

    /**
     * Broadcasts a system message to all clients
     * @param string $message - The system message to broadcast
     */
    private function broadcastSystemMessage($message) {
        foreach ($this->clients as $client) {
            $client->send(json_encode([
                'type' => 'system',
                'message' => $message
            ]));
        }
    }
}

try {
    echo "Starting WebSocket server on port 8080...\n";
    
    // Create the WebSocket server
    $server = IoServer::factory(
        // Wrap the WebSocket server in HTTP and WebSocket handlers
        new HttpServer(
            new WsServer(
                new GameWebSocket()
            )
        ),
        8080 // Port number to listen on
    );

    echo "WebSocket Server Started!\n";
    // Start the server (this is a blocking call)
    $server->run();
} catch (Exception $e) {
    echo "Error starting server: " . $e->getMessage() . "\n";
} 