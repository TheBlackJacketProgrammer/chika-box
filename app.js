// Create AngularJS application module
angular.module('wsApp', [])
    .controller('WebSocketController', ['$scope', '$timeout', '$interval', function($scope, $timeout, $interval) {
        // Initialize scope variables
        $scope.messages = [];        // Array to store chat messages
        $scope.status = 'Not connected'; // Connection status message
        $scope.newMessage = '';      // Current message being typed
        $scope.username = localStorage.getItem('chatUsername') || ''; // Get username from localStorage
        $scope.isConnected = false;  // Connection state flag
        $scope.errorMessage = '';    // Error message display
        $scope.ws = null;           // WebSocket connection object
        $scope.debugMode = false;    // Debug mode flag - default to false
        $scope.wsState = 'Not initialized'; // WebSocket state tracking
        $scope.onlineUsers = [];     // List of online users
        $scope.serverAddress = 'ws://localhost:8080'; // Default server address
        $scope.showServerInput = false; // Server input visibility flag
        $scope.activeTab = 'public'; // Current active chat tab
        $scope.privateChats = {};    // Object to store private chats
        $scope.privateMessages = {}; // Object to store private message inputs
        $scope.userListInterval = null; // Interval reference
        $scope.unreadCounts = {};    // Track unread messages per user

        // Function to toggle debug panel
        $scope.toggleDebug = function() {
            $scope.debugMode = !$scope.debugMode;
            console.log('Debug mode toggled:', $scope.debugMode);
        };

        // Function to toggle server address input
        $scope.toggleServerInput = function() {
            $scope.showServerInput = !$scope.showServerInput;
        };

        // Function to start a private chat
        $scope.startPrivateChat = function(recipient) {
            if (recipient === $scope.username) return; // Can't chat with yourself
            
            if (!$scope.privateChats[recipient]) {
                $scope.privateChats[recipient] = [];
                $scope.privateMessages[recipient] = '';
                $scope.unreadCounts[recipient] = 0;
            }
            $scope.activeTab = recipient;
            $scope.unreadCounts[recipient] = 0; // Reset unread count when opening chat
        };

        // Function to close a private chat
        $scope.closePrivateChat = function(recipient, event) {
            event.stopPropagation(); // Prevent tab switch
            delete $scope.privateChats[recipient];
            delete $scope.privateMessages[recipient];
            delete $scope.unreadCounts[recipient];
            if ($scope.activeTab === recipient) {
                $scope.activeTab = 'public';
            }
        };

        // Function to switch tabs
        $scope.switchTab = function(tab) {
            $scope.activeTab = tab;
            if (tab !== 'public') {
                $scope.unreadCounts[tab] = 0; // Reset unread count when switching to chat
            }
        };

        // Function to send private message
        $scope.sendPrivateMessage = function(recipient, event) {
            if (event && event.key !== 'Enter') return;
            if (!$scope.privateMessages[recipient]) return;

            try {
                const messageData = {
                    type: 'private',
                    from: $scope.username,
                    to: recipient,
                    message: $scope.privateMessages[recipient]
                };
                
                $scope.ws.send(JSON.stringify(messageData));
                
                // Add message to local display as sent
                $scope.privateChats[recipient].push({
                    text: $scope.privateMessages[recipient],
                    type: 'sent',
                    username: $scope.username
                });
                
                $scope.privateMessages[recipient] = '';
                if (!$scope.$$phase) {
                    $scope.$apply();
                }
            } catch (e) {
                console.error('Error sending private message:', e);
            }
        };

        // Function to update user list
        $scope.updateUserList = function() {
            $.ajax({
                url: 'user_storage.php',
                type: 'POST',
                data: {
                    action: 'get'
                },
                success: function(response) {
                    console.log('Received user list:', response);
                    try {
                        // Parse the response if it's a string
                        if (typeof response === 'string') {
                            response = JSON.parse(response);
                        }
                        
                        if (response && response.users) {
                            // Convert to array of objects for ng-repeat
                            $scope.onlineUsers = response.users.map(function(username) {
                                return { name: username };
                            }).sort(function(a, b) {
                                return a.name.localeCompare(b.name);
                            });
                            
                            console.log('Updated online users list:', $scope.onlineUsers);
                            if (!$scope.$$phase) {
                                $scope.$apply();
                            }
                        }
                    } catch (e) {
                        console.error('Error processing user list:', e);
                    }
                },
                error: function(xhr, status, error) {
                    console.error('Error getting user list:', error);
                }
            });
        };

        // Save username to localStorage when it changes
        $scope.$watch('username', function(newVal) {
            if (newVal) {
                localStorage.setItem('chatUsername', newVal);
            }
        });

        // Detect if running on mobile device
        $scope.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if ($scope.isMobile) {
            // Try to get the current host IP
            const host = window.location.hostname;
            if (host !== 'localhost' && host !== '127.0.0.1') {
                $scope.serverAddress = 'ws://' + host + ':8080';
            }
        }

        /**
         * Safely updates the AngularJS scope
         * Prevents multiple digest cycles
         */
        function updateScope() {
            if (!$scope.$$phase) {
                $scope.$apply();
            }
        }

        /**
         * Establishes WebSocket connection
         * @param {Event} event - Optional keyboard event
         */
        $scope.connect = function(event) {
            // Only proceed on Enter key or button click
            if (event && event.key !== 'Enter') return;
            if (!$scope.username) {
                $scope.errorMessage = 'Please enter a username';
                return;
            }

            try {
                console.log('Attempting to connect to:', $scope.serverAddress);
                // Create new WebSocket connection
                $scope.ws = new WebSocket($scope.serverAddress);
                $scope.wsState = 'Connecting...';
                $scope.errorMessage = '';

                // Connection opened handler
                $scope.ws.onopen = function() {
                    console.log('WebSocket connection opened');
                    $scope.wsState = 'Connected';
                    $scope.isConnected = true;
                    $scope.status = 'Connected to WebSocket server!';
                    
                    // Add user to storage
                    $.ajax({
                        url: 'user_storage.php',
                        type: 'POST',
                        data: {
                            action: 'add',
                            username: $scope.username
                        },
                        success: function(response) {
                            console.log('User added to storage:', response);
                            try {
                                // Parse the response if it's a string
                                if (typeof response === 'string') {
                                    response = JSON.parse(response);
                                }
                                
                                if (response && response.users) {
                                    // Convert to array of objects for ng-repeat
                                    $scope.onlineUsers = response.users.map(function(username) {
                                        return { name: username };
                                    }).sort(function(a, b) {
                                        return a.name.localeCompare(b.name);
                                    });
                                    
                                    console.log('Updated online users list:', $scope.onlineUsers);
                                    if (!$scope.$$phase) {
                                        $scope.$apply();
                                    }
                                }
                            } catch (e) {
                                console.error('Error processing user list:', e);
                            }
                        },
                        error: function(xhr, status, error) {
                            console.error('Error adding user to storage:', error);
                        }
                    });
                    
                    // Send login message
                    $scope.ws.send(JSON.stringify({
                        type: 'login',
                        username: $scope.username
                    }));
                    
                    updateScope();
                };

                // Message received handler
                $scope.ws.onmessage = function(event) {
                    console.log('Raw message received:', event.data);
                    try {
                        const data = JSON.parse(event.data);
                        console.log('Parsed message data:', data);
                        
                        switch (data.type) {
                            case 'chat':
                                // Only add message if it's from another user
                                if (data.username !== $scope.username) {
                                    $scope.messages.push({
                                        text: data.message,
                                        type: 'received',
                                        username: data.username
                                    });
                                }
                                break;
                            
                            case 'private':
                                // Handle private message
                                if (data.from === $scope.username) {
                                    // Message sent by current user - already added to display
                                    // No need to add it again
                                } else {
                                    // Message received from another user
                                    if (!$scope.privateChats[data.from]) {
                                        $scope.privateChats[data.from] = [];
                                        $scope.unreadCounts[data.from] = 0;
                                    }
                                    $scope.privateChats[data.from].push({
                                        text: data.message,
                                        type: 'received',
                                        username: data.from
                                    });
                                    
                                    // Increment unread count if chat is not active
                                    if ($scope.activeTab !== data.from) {
                                        $scope.unreadCounts[data.from] = ($scope.unreadCounts[data.from] || 0) + 1;
                                    }
                                    
                                    // Switch to the chat tab if not already active
                                    if ($scope.activeTab !== data.from) {
                                        $scope.activeTab = data.from;
                                    }
                                }
                                break;
                            
                            case 'system':
                                $scope.messages.push({
                                    text: data.message,
                                    type: 'system'
                                });
                                console.log('System message received:', data.message);
                                
                                // Check if message contains 'has left the chat'
                                if (data.message.includes('has left the chat')) {
                                    const username = data.message.split(' has left the chat')[0];
                                    console.log('User left:', username);
                                    
                                    // Remove the user from the online users list
                                    $scope.onlineUsers = $scope.onlineUsers.filter(user => user.name !== username);
                                    
                                    // Close private chat if open
                                    if ($scope.privateChats[username]) {
                                        delete $scope.privateChats[username];
                                        delete $scope.privateMessages[username];
                                        if ($scope.activeTab === username) {
                                            $scope.activeTab = 'public';
                                        }
                                    }
                                    
                                    // Update storage to remove the user
                                    $.ajax({
                                        url: 'user_storage.php',
                                        type: 'POST',
                                        data: {
                                            action: 'remove',
                                            username: username
                                        },
                                        success: function(response) {
                                            console.log('User removed from storage:', response);
                                        },
                                        error: function(xhr, status, error) {
                                            console.error('Error removing user from storage:', error);
                                        }
                                    });
                                    
                                    if (!$scope.$$phase) {
                                        $scope.$apply();
                                    }
                                }
                                // Check if message contains 'has joined the chat'
                                else if (data.message.includes('has joined the chat')) {
                                    const username = data.message.split(' has joined the chat')[0];
                                    console.log('User joined:', username);
                                    
                                    // Check if user is not already in the list
                                    const userExists = $scope.onlineUsers.some(user => user.name === username);
                                    if (!userExists) {
                                        // Add the new user to the list
                                        $scope.onlineUsers.push({ name: username });
                                        // Sort the list alphabetically
                                        $scope.onlineUsers.sort((a, b) => a.name.localeCompare(b.name));
                                        
                                        // Update storage to add the user
                                        $.ajax({
                                            url: 'user_storage.php',
                                            type: 'POST',
                                            data: {
                                                action: 'add',
                                                username: username
                                            },
                                            success: function(response) {
                                                console.log('User added to storage:', response);
                                            },
                                            error: function(xhr, status, error) {
                                                console.error('Error adding user to storage:', error);
                                            }
                                        });
                                        
                                        if (!$scope.$$phase) {
                                            $scope.$apply();
                                        }
                                    }
                                }
                                break;
                        }
                    } catch (e) {
                        console.error('Error parsing message:', e);
                        console.error('Raw message that caused error:', event.data);
                    }
                    if (!$scope.$$phase) {
                        $scope.$apply();
                    }
                };

                // Connection closed handler
                $scope.ws.onclose = function() {
                    console.log('WebSocket connection closed');
                    $scope.wsState = 'Closed';
                    $scope.isConnected = false;
                    $scope.status = 'Disconnected from WebSocket server';
                    
                    // Remove user from storage
                    $.ajax({
                        url: 'user_storage.php',
                        type: 'POST',
                        data: {
                            action: 'remove',
                            username: $scope.username
                        },
                        success: function(response) {
                            console.log('User removed from storage:', response);
                            if (response && response.users) {
                                $scope.onlineUsers = response.users;
                                console.log('Updated online users list:', $scope.onlineUsers);
                                if (!$scope.$$phase) {
                                    $scope.$apply();
                                }
                            }
                        },
                        error: function(xhr, status, error) {
                            console.error('Error removing user from storage:', error);
                        }
                    });
                    
                    $scope.messages.push({
                        text: 'Disconnected from server',
                        type: 'system'
                    });
                    updateScope();
                };

                // Error handler
                $scope.ws.onerror = function(error) {
                    console.error('WebSocket error:', error);
                    $scope.wsState = 'Error';
                    $scope.isConnected = false;
                    $scope.errorMessage = 'Connection error. Please check if the server is running and the address is correct.';
                    $scope.status = 'Error: ' + error.message;
                    $scope.messages.push({
                        text: 'Error: ' + error.message,
                        type: 'system'
                    });
                    updateScope();
                };
            } catch (e) {
                console.error('Connection error:', e);
                $scope.errorMessage = 'Failed to connect to WebSocket server. Please check if the server is running and the address is correct.';
                $scope.wsState = 'Error';
                updateScope();
            }
        };

        /**
         * Sends a message through the WebSocket connection
         * @param {Event} event - Optional keyboard event
         */
        $scope.sendMessage = function(event) {
            // Only proceed on Enter key or button click
            if (event && event.key !== 'Enter') return;
            // Check if WebSocket is connected
            if (!$scope.ws || $scope.ws.readyState !== WebSocket.OPEN) {
                $scope.errorMessage = 'Not connected to server';
                return;
            }
            
            if ($scope.newMessage) {
                try {
                    // Create message object with username and message
                    const messageData = {
                        type: 'chat',
                        username: $scope.username,
                        message: $scope.newMessage
                    };
                    // Send the message
                    $scope.ws.send(JSON.stringify(messageData));
                    // Add message to local display
                    $scope.messages.push({
                        text: $scope.newMessage,
                        type: 'sent',
                        username: $scope.username
                    });
                    // Clear input field
                    $scope.newMessage = '';
                    $scope.errorMessage = '';
                    updateScope();
                } catch (e) {
                    console.error('Send error:', e);
                    $scope.errorMessage = 'Failed to send message';
                    updateScope();
                }
            }
        };

        // Clean up interval when controller is destroyed
        $scope.$on('$destroy', function() {
            if ($scope.userListInterval) {
                $interval.cancel($scope.userListInterval);
            }
        });
    }]); 