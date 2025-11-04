// Chat Management

class ChatManager {
    constructor() {
        this.messages = [];
        this.currentContact = null;
        this.contacts = [];
        this.allUsers = [];
        this.searchResults = [];
        this.isTyping = false;
        this.messageIdCounter = 1;
        this.currentUser = null;
        this.showingSearchResults = false;
        this.archivedChats = JSON.parse(localStorage.getItem('archivedChats')) || [];
        this.pinnedChats = JSON.parse(localStorage.getItem('pinnedChats')) || [];
    }
    
    init(currentUser) {
        this.currentUser = currentUser;
        
        const currentUserAvatar = document.getElementById('current-user-avatar');
        const currentUserName = document.getElementById('current-user-name');
        
        if (currentUserAvatar) currentUserAvatar.textContent = currentUser.avatar || currentUser.name.charAt(0);
        if (currentUserName) currentUserName.textContent = currentUser.name;
        
        this.setupContactHandlers();
        this.setupSearchHandlers();
        this.setupMessageHandlers();
        
        // Show welcome message only if no contact is selected
        if (!this.currentContact) {
            this.showWelcomeMessage();
        }
    }
    
    // Show welcome message when no contact is selected
    showWelcomeMessage() {
        const messagesContainer = document.getElementById('messages-container');
        const activeContactName = document.getElementById('active-contact-name');
        const activeContactStatus = document.getElementById('active-contact-status');
        const activeContactAvatar = document.getElementById('active-contact-avatar');
        
        if (messagesContainer) {
            messagesContainer.innerHTML = `
                <div class="welcome-container">
                    <div class="welcome-avatar">
                        <i class="fas fa-comments"></i>
                    </div>
                    <h2>Welcome to RealTime Chat Pro!</h2>
                    <p>Select a conversation from the sidebar or search for users to start chatting.</p>
                    <div class="welcome-features">
                        <div class="feature">
                            <i class="fas fa-comment-dots"></i>
                            <span>Real-time messaging</span>
                        </div>
                        <div class="feature">
                            <i class="fas fa-video"></i>
                            <span>Video & audio calls</span>
                        </div>
                        <div class="feature">
                            <i class="fas fa-file-upload"></i>
                            <span>File sharing</span>
                        </div>
                        <div class="feature">
                            <i class="fas fa-mobile-alt"></i>
                            <span>Mobile responsive</span>
                        </div>
                    </div>
                </div>
            `;
        }
        
        if (activeContactName) activeContactName.textContent = 'Welcome';
        if (activeContactStatus) activeContactStatus.innerHTML = '<span class="status-indicator"></span> Ready to chat';
        if (activeContactAvatar) activeContactAvatar.textContent = '💬';
        
        // Update right panel
        const panelContactName = document.getElementById('panel-contact-name');
        const panelContactStatus = document.getElementById('panel-contact-status');
        const panelContactAvatar = document.getElementById('panel-contact-avatar');
        
        if (panelContactName) panelContactName.textContent = 'Welcome';
        if (panelContactStatus) panelContactStatus.innerHTML = '<span class="status-indicator"></span> Get Started';
        if (panelContactAvatar) panelContactAvatar.textContent = '💬';
        
        // Hide call buttons when no contact is selected
        this.toggleCallButtons(false);
    }
    
    // Toggle call buttons visibility
    toggleCallButtons(show) {
        const videoCallBtn = document.getElementById('video-call-btn');
        const audioCallBtn = document.getElementById('audio-call-btn');
        
        if (videoCallBtn) videoCallBtn.style.display = show ? 'flex' : 'none';
        if (audioCallBtn) audioCallBtn.style.display = show ? 'flex' : 'none';
    }
    
    setupContactHandlers() {
        const contactsContainer = document.getElementById('contacts-container');
        if (contactsContainer) {
            contactsContainer.addEventListener('click', (e) => {
                const contactElement = e.target.closest('.contact');
                if (contactElement) {
                    const contactId = contactElement.getAttribute('data-contact-id');
                    let contact;
                    
                    if (this.showingSearchResults) {
                        contact = this.searchResults.find(c => c.id === contactId);
                        if (contact) {
                            this.startNewConversation(contact);
                        }
                    } else {
                        contact = this.contacts.find(c => c.id === contactId);
                        if (contact) {
                            this.switchContact(contact);
                        }
                    }
                }
                
                // Handle three dots menu click
                if (e.target.closest('.contact-menu-btn')) {
                    e.stopPropagation();
                    const contactId = e.target.closest('.contact').getAttribute('data-contact-id');
                    this.toggleContactMenu(contactId);
                }
                
                // Handle menu item clicks
                if (e.target.closest('.menu-item')) {
                    e.stopPropagation();
                    const contactId = e.target.closest('.contact').getAttribute('data-contact-id');
                    const action = e.target.closest('.menu-item').getAttribute('data-action');
                    this.handleContactMenuAction(contactId, action);
                    this.hideAllContactMenus();
                }
            });
            
            // Close menus when clicking outside
            document.addEventListener('click', () => {
                this.hideAllContactMenus();
            });
        }
    }
    
    // Toggle contact menu
    toggleContactMenu(contactId) {
        // Hide all other menus first
        this.hideAllContactMenus();
        
        const contactElement = document.querySelector(`.contact[data-contact-id="${contactId}"]`);
        if (contactElement) {
            const menu = contactElement.querySelector('.contact-menu');
            if (menu) {
                menu.classList.toggle('active');
            }
        }
    }
    
    // Hide all contact menus
    hideAllContactMenus() {
        const menus = document.querySelectorAll('.contact-menu');
        menus.forEach(menu => menu.classList.remove('active'));
    }
    
    // Handle contact menu actions
    handleContactMenuAction(contactId, action) {
        const contact = this.contacts.find(c => c.id === contactId);
        if (!contact) return;
        
        switch (action) {
            case 'pin':
                this.togglePinChat(contactId);
                break;
            case 'archive':
                if (this.archivedChats.includes(contactId)) {
                    this.unarchiveChat(contactId);
                } else {
                    this.archiveChat(contactId);
                }
                break;
            case 'delete':
                this.deleteChat(contactId);
                break;
            case 'mute':
                contact.muted = !contact.muted;
                this.renderContacts();
                notificationManager.showInAppNotification(
                    "Notifications", 
                    `Notifications ${contact.muted ? 'muted' : 'unmuted'} for ${contact.name}`
                );
                break;
        }
    }
    
    setupSearchHandlers() {
        if (window.chatApp && window.chatApp.socket) {
            window.chatApp.socket.on('search_users_results', (results) => {
                this.showSearchResults(results);
            });
        }
    }

    setupMessageHandlers() {
        if (window.chatApp && window.chatApp.socket) {
            window.chatApp.socket.on('file_message_error', (data) => {
                console.error('❌ File message error:', data.error);
                notificationManager.showInAppNotification("File Error", "Failed to send file message");
            });
        }
    }
    
    // Archive a chat
    archiveChat(contactId) {
        if (!this.archivedChats.includes(contactId)) {
            this.archivedChats.push(contactId);
            localStorage.setItem('archivedChats', JSON.stringify(this.archivedChats));
            
            // If archiving current contact, clear it
            if (this.currentContact && this.currentContact.id === contactId) {
                this.currentContact = null;
                this.showWelcomeMessage();
            }
            
            this.renderContacts();
            notificationManager.showInAppNotification("Chat Archived", "Chat has been moved to archive");
        }
    }
    
    // Unarchive a chat
    unarchiveChat(contactId) {
        this.archivedChats = this.archivedChats.filter(id => id !== contactId);
        localStorage.setItem('archivedChats', JSON.stringify(this.archivedChats));
        this.renderContacts();
        notificationManager.showInAppNotification("Chat Unarchived", "Chat has been restored");
    }
    
    // Delete a chat
    deleteChat(contactId) {
        if (confirm('Are you sure you want to delete this chat? All messages will be permanently removed.')) {
            // Remove from contacts
            this.contacts = this.contacts.filter(contact => contact.id !== contactId);
            
            // Remove from pinned and archived
            this.pinnedChats = this.pinnedChats.filter(id => id !== contactId);
            this.archivedChats = this.archivedChats.filter(id => id !== contactId);
            
            localStorage.setItem('pinnedChats', JSON.stringify(this.pinnedChats));
            localStorage.setItem('archivedChats', JSON.stringify(this.archivedChats));
            
            // Clear current contact if it's the deleted one
            if (this.currentContact && this.currentContact.id === contactId) {
                this.currentContact = null;
                this.showWelcomeMessage();
            }
            
            this.renderContacts();
            notificationManager.showInAppNotification("Chat Deleted", "Chat has been permanently deleted");
        }
    }
    
    // Toggle pin chat
    togglePinChat(contactId) {
        if (this.pinnedChats.includes(contactId)) {
            this.pinnedChats = this.pinnedChats.filter(id => id !== contactId);
            notificationManager.showInAppNotification("Chat Unpinned", "Chat has been unpinned");
        } else {
            this.pinnedChats.push(contactId);
            notificationManager.showInAppNotification("Chat Pinned", "Chat has been pinned to top");
        }
        localStorage.setItem('pinnedChats', JSON.stringify(this.pinnedChats));
        this.renderContacts();
    }
    
    // Show search results
    showSearchResults(results) {
        this.searchResults = results;
        this.showingSearchResults = true;
        
        const contactsContainer = document.getElementById('contacts-container');
        if (!contactsContainer) return;
        
        contactsContainer.innerHTML = '';
        
        if (results.length === 0) {
            contactsContainer.innerHTML = `
                <div class="no-contacts" style="text-align: center; padding: 20px; color: #64748b;">
                    <i class="fas fa-search" style="font-size: 2rem; margin-bottom: 10px;"></i>
                    <p>No users found</p>
                </div>
            `;
            return;
        }
        
        results.forEach(contact => {
            const contactElement = document.createElement('div');
            contactElement.className = `contact search-result`;
            contactElement.setAttribute('data-contact-id', contact.id);
            contactElement.innerHTML = `
                <div class="contact-avatar ${contact.online ? 'online' : ''}">${contact.avatar}</div>
                <div class="contact-info">
                    <div class="contact-name">${contact.name} <span style="color: #4361ee; font-size: 0.8em;">(Click to start chat)</span></div>
                    <div class="contact-preview">${contact.online ? 'Online' : 'Offline'}</div>
                </div>
                <div class="contact-time"></div>
            `;
            
            contactsContainer.appendChild(contactElement);
        });
    }
    
    // Start new conversation with searched user
    startNewConversation(contact) {
        let existingContact = this.contacts.find(c => c.id === contact.id);
        
        if (!existingContact) {
            existingContact = {
                ...contact,
                lastMessage: 'Start chatting...',
                lastTime: 'Now',
                muted: false
            };
            this.contacts.push(existingContact);
        }
        
        this.switchContact(existingContact);
        this.showingSearchResults = false;
        
        const searchInput = document.getElementById('search-contacts');
        if (searchInput) {
            searchInput.value = '';
        }
        
        this.renderContacts();
    }
    
    // Render contacts list with pinned, archived, and normal chats
    renderContacts() {
        this.showingSearchResults = false;
        const contactsContainer = document.getElementById('contacts-container');
        if (!contactsContainer) return;
        
        contactsContainer.innerHTML = '';
        
        if (this.contacts.length === 0) {
            contactsContainer.innerHTML = `
                <div class="no-contacts" style="text-align: center; padding: 20px; color: #64748b;">
                    <i class="fas fa-comments" style="font-size: 2rem; margin-bottom: 10px;"></i>
                    <p>No conversations yet</p>
                    <p style="font-size: 0.9em;">Search for users to start chatting</p>
                </div>
            `;
            return;
        }
        
        // Separate pinned, archived, and normal chats
        const pinnedContacts = this.contacts.filter(contact => this.pinnedChats.includes(contact.id));
        const archivedContacts = this.contacts.filter(contact => this.archivedChats.includes(contact.id));
        const normalContacts = this.contacts.filter(contact => 
            !this.pinnedChats.includes(contact.id) && !this.archivedChats.includes(contact.id)
        );
        
        // Render pinned chats
        if (pinnedContacts.length > 0) {
            const pinnedSection = document.createElement('div');
            pinnedSection.className = 'contacts-section';
            pinnedSection.innerHTML = `<div class="section-title">Pinned</div>`;
            contactsContainer.appendChild(pinnedSection);
            
            pinnedContacts.forEach(contact => {
                this.renderContactElement(contact, contactsContainer);
            });
        }
        
        // Render normal chats
        if (normalContacts.length > 0) {
            if (pinnedContacts.length > 0) {
                const normalSection = document.createElement('div');
                normalSection.className = 'contacts-section';
                normalSection.innerHTML = `<div class="section-title">All Chats</div>`;
                contactsContainer.appendChild(normalSection);
            }
            
            normalContacts.forEach(contact => {
                this.renderContactElement(contact, contactsContainer);
            });
        }
        
        // Render archived chats
        if (archivedContacts.length > 0) {
            const archivedSection = document.createElement('div');
            archivedSection.className = 'contacts-section';
            archivedSection.innerHTML = `<div class="section-title">Archived</div>`;
            contactsContainer.appendChild(archivedSection);
            
            archivedContacts.forEach(contact => {
                this.renderContactElement(contact, contactsContainer, true);
            });
        }
    }
    
    // Render individual contact element
    renderContactElement(contact, container, isArchived = false) {
        const contactElement = document.createElement('div');
        contactElement.className = `contact ${contact.id === this.currentContact?.id ? 'active' : ''} ${isArchived ? 'archived' : ''}`;
        contactElement.setAttribute('data-contact-id', contact.id);
        
        const isPinned = this.pinnedChats.includes(contact.id);
        const isArchivedChat = this.archivedChats.includes(contact.id);
        
        contactElement.innerHTML = `
            <div class="contact-avatar ${contact.online ? 'online' : ''}">
                ${contact.avatar}
                ${isPinned ? '<div class="pin-indicator"><i class="fas fa-thumbtack"></i></div>' : ''}
            </div>
            <div class="contact-info">
                <div class="contact-name">
                    ${contact.name} 
                    ${contact.muted ? '<i class="fas fa-bell-slash" style="color: #6c757d; margin-left: 5px;"></i>' : ''}
                </div>
                <div class="contact-preview">${contact.lastMessage || 'No messages yet'}</div>
            </div>
            <div class="contact-time">${contact.lastTime || ''}</div>
            <div class="contact-menu-btn">
                <i class="fas fa-ellipsis-v"></i>
            </div>
            <div class="contact-menu">
                <div class="menu-item" data-action="pin">
                    <i class="fas fa-thumbtack"></i>
                    ${isPinned ? 'Unpin chat' : 'Pin chat'}
                </div>
                <div class="menu-item" data-action="mute">
                    <i class="fas fa-bell${contact.muted ? '' : '-slash'}"></i>
                    ${contact.muted ? 'Unmute' : 'Mute'} notifications
                </div>
                <div class="menu-item" data-action="archive">
                    <i class="fas fa-${isArchivedChat ? 'inbox' : 'archive'}"></i>
                    ${isArchivedChat ? 'Unarchive' : 'Archive'} chat
                </div>
                <div class="menu-item danger" data-action="delete">
                    <i class="fas fa-trash"></i>
                    Delete chat
                </div>
            </div>
        `;
        
        container.appendChild(contactElement);
    }
    
    // Render messages with media support
    renderMessages() {
        const messagesContainer = document.getElementById('messages-container');
        if (!messagesContainer) return;
        
        messagesContainer.innerHTML = '';
        
        // Filter messages by type if media filter is active
        let messagesToShow = this.messages;
        if (this.currentMediaFilter) {
            messagesToShow = this.messages.filter(message => 
                message.messageType === this.currentMediaFilter
            );
            
            if (messagesToShow.length === 0) {
                messagesContainer.innerHTML = `
                    <div class="no-media" style="text-align: center; padding: 40px; color: #64748b;">
                        <i class="fas fa-${this.getMediaFilterIcon()}"></i>
                        <h3>No ${this.getMediaFilterLabel()} found</h3>
                        <p>No ${this.getMediaFilterLabel().toLowerCase()} shared in this conversation</p>
                    </div>
                `;
                return;
            }
        }
        
        messagesToShow.forEach(message => {
            const isSent = message.senderId === this.currentUser.id;
            const messageElement = document.createElement('div');
            messageElement.className = `message ${isSent ? 'sent' : 'received'}`;
            messageElement.setAttribute('data-message-id', message.id);
            
            let messageContent = '';
            
            if (message.messageType === 'image') {
                messageContent = `
                    <div class="message-media">
                        <img src="${message.fileUrl}" alt="Shared image" class="media-image" onclick="chatManager.openMedia('${message.fileUrl}', 'image')">
                        <div class="media-caption">${message.text}</div>
                    </div>
                `;
            } else if (message.messageType === 'video') {
                messageContent = `
                    <div class="message-media">
                        <video controls class="media-video">
                            <source src="${message.fileUrl}" type="video/mp4">
                            Your browser does not support the video tag.
                        </video>
                        <div class="media-caption">${message.text}</div>
                    </div>
                `;
            } else if (message.messageType === 'file') {
                messageContent = `
                    <div class="message-file" onclick="chatManager.downloadFile('${message.fileUrl}', '${message.fileName}')">
                        <div class="file-icon">
                            <i class="fas fa-file-download"></i>
                        </div>
                        <div class="file-info">
                            <div class="file-name">${message.fileName}</div>
                            <div class="file-size">${message.fileSize}</div>
                        </div>
                    </div>
                `;
            } else {
                messageContent = `<div class="message-text">${message.text}</div>`;
            }
            
            messageElement.innerHTML = `
                ${messageContent}
                <div class="message-actions">
                    <button class="delete-message-btn" title="Delete message">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
                <div class="message-time">${formatTime(new Date(message.timestamp))}</div>
            `;
            
            if (isSent) {
                const deleteBtn = messageElement.querySelector('.delete-message-btn');
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.deleteMessage(message.id);
                });
            } else {
                const deleteBtn = messageElement.querySelector('.delete-message-btn');
                deleteBtn.style.display = 'none';
            }
            
            messagesContainer.appendChild(messageElement);
        });
        
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    // Media filter methods
    setMediaFilter(filterType) {
        this.currentMediaFilter = filterType;
        this.renderMessages();
    }
    
    clearMediaFilter() {
        this.currentMediaFilter = null;
        this.renderMessages();
    }
    
    getMediaFilterIcon() {
        switch (this.currentMediaFilter) {
            case 'image': return 'image';
            case 'video': return 'video';
            case 'file': return 'file';
            default: return 'file';
        }
    }
    
    getMediaFilterLabel() {
        switch (this.currentMediaFilter) {
            case 'image': return 'Photos';
            case 'video': return 'Videos';
            case 'file': return 'Files';
            default: return 'Media';
        }
    }
    
    // Switch to a different contact
    switchContact(contact) {
        this.currentContact = contact;
        this.clearMediaFilter(); // Clear any media filter when switching contacts
        this.renderContacts();
        
        // Store last active contact
        localStorage.setItem('lastActiveContact', contact.id);
        
        const activeContactName = document.getElementById('active-contact-name');
        const activeContactStatus = document.getElementById('active-contact-status');
        const activeContactAvatar = document.getElementById('active-contact-avatar');
        
        if (activeContactName) activeContactName.textContent = contact.name;
        if (activeContactAvatar) activeContactAvatar.textContent = contact.avatar;
        if (activeContactStatus) {
            activeContactStatus.innerHTML = `
                <span class="status-indicator"></span> ${contact.online ? 'Online • Last seen just now' : 'Offline • Last seen recently'}
            `;
        }
        
        const panelContactName = document.getElementById('panel-contact-name');
        const panelContactStatus = document.getElementById('panel-contact-status');
        const panelContactAvatar = document.getElementById('panel-contact-avatar');
        
        if (panelContactName) panelContactName.textContent = contact.name;
        if (panelContactStatus) {
            panelContactStatus.innerHTML = `
                <span class="status-indicator"></span> ${contact.online ? 'Online' : 'Offline'}
            `;
        }
        if (panelContactAvatar) panelContactAvatar.textContent = contact.avatar;
        
        // Show call buttons when contact is selected
        this.toggleCallButtons(true);
        
        if (window.chatApp && window.chatApp.socket) {
            window.chatApp.socket.emit('get_conversation', { contactId: contact.id });
        }
    }
    
    // Send a message
    sendMessage(text) {
        if (!text.trim() || !this.currentContact) return;
        
        const message = {
            text: text.trim(),
            senderId: this.currentUser.id,
            receiverId: this.currentContact.id,
            timestamp: new Date().toISOString(),
            messageType: 'text'
        };
        
        if (window.chatApp && window.chatApp.socket) {
            window.chatApp.socket.emit('send_message', message);
        }
        
        const tempMessage = {
            ...message,
            id: `temp-${Date.now()}`,
            type: 'sent'
        };
        
        this.messages.push(tempMessage);
        this.renderMessages();
        
        this.currentContact.lastMessage = text;
        this.currentContact.lastTime = 'Just now';
        this.renderContacts();
        
        console.log('💬 Message sent locally:', text);
    }
    
    // Send file message
    sendFileMessage(fileData) {
        if (!this.currentContact) {
            notificationManager.showInAppNotification("Error", "Please select a contact first");
            return;
        }

        console.log('📤 Sending file message:', fileData);
        
        if (window.chatApp && window.chatApp.socket) {
            window.chatApp.socket.emit('send_file_message', {
                receiverId: this.currentContact.id,
                fileUrl: fileData.fileUrl,
                fileName: fileData.fileName,
                fileSize: fileData.fileSize,
                messageType: fileData.messageType
            });
        }
        
        const tempMessage = {
            id: `temp-${Date.now()}`,
            text: fileData.messageType === 'image' ? '📷 Photo' : 
                  fileData.messageType === 'video' ? '🎥 Video' : 
                  `📄 ${fileData.fileName}`,
            senderId: this.currentUser.id,
            receiverId: this.currentContact.id,
            timestamp: new Date().toISOString(),
            messageType: fileData.messageType,
            fileUrl: fileData.fileUrl,
            fileName: fileData.fileName,
            fileSize: fileData.fileSize,
            type: 'sent'
        };
        
        this.messages.push(tempMessage);
        this.renderMessages();
        
        this.currentContact.lastMessage = fileData.messageType === 'image' ? '📷 Photo' : 
                                        fileData.messageType === 'video' ? '🎥 Video' : 
                                        `📄 ${fileData.fileName}`;
        this.currentContact.lastTime = 'Just now';
        this.renderContacts();

        console.log('✅ File message sent locally');
    }
    
    // Receive a message
    receiveMessage(message) {
        console.log('💬 Receiving message:', message);
        
        // Remove any temporary message with the same content
        this.messages = this.messages.filter(msg => 
            !msg.id.startsWith('temp-') || 
            msg.text !== message.text || 
            msg.messageType !== message.messageType ||
            msg.fileName !== message.fileName
        );
        
        // Add message to current conversation if it's from the current contact
        if (this.currentContact && 
            (message.senderId === this.currentContact.id || message.receiverId === this.currentContact.id)) {
            this.messages.push({
                ...message,
                type: message.senderId === this.currentUser.id ? 'sent' : 'received'
            });
            this.renderMessages();
            console.log('✅ Message added to current conversation');
        }
        
        // Update contact's last message in contacts list
        const contactId = message.senderId === this.currentUser.id ? message.receiverId : message.senderId;
        const contact = this.contacts.find(c => c.id === contactId);
        
        if (contact) {
            contact.lastMessage = message.messageType === 'image' ? '📷 Photo' : 
                                 message.messageType === 'video' ? '🎥 Video' : 
                                 message.messageType === 'file' ? `📄 ${message.fileName}` : 
                                 message.text;
            contact.lastTime = 'Just now';
            this.renderContacts();
            console.log('✅ Contact last message updated');
        } else if (message.senderId !== this.currentUser.id) {
            this.addNewContact(message.senderId);
        }
        
        // Show push notification
        if ((document.hidden || !isElementInViewport(document.getElementById('messages-container'))) && 
            notificationManager.notificationsEnabled && 
            message.senderId !== this.currentUser.id) {
            const senderName = this.contacts.find(c => c.id === message.senderId)?.name || 'Unknown';
            const messageText = message.messageType === 'image' ? 'sent a photo' : 
                               message.messageType === 'video' ? 'sent a video' : 
                               message.messageType === 'file' ? `sent a file: ${message.fileName}` : 
                               message.text;
            notificationManager.showPushNotification(senderName, messageText);
            console.log('✅ Notification shown');
        }
        
        console.log('💬 Message received and processed successfully');
    }
    
    // Add new contact when receiving message from unknown user
    async addNewContact(userId) {
        try {
            const newContact = {
                id: userId,
                name: 'Unknown User',
                avatar: 'U',
                online: true,
                lastSeen: new Date(),
                lastMessage: 'New message',
                lastTime: 'Just now',
                muted: false
            };
            
            this.contacts.push(newContact);
            this.renderContacts();
            console.log('✅ New contact added:', userId);
        } catch (error) {
            console.error('❌ Error adding new contact:', error);
        }
    }
    
    // Delete message
    deleteMessage(messageId) {
        if (confirm('Are you sure you want to delete this message?')) {
            this.messages = this.messages.filter(msg => msg.id !== messageId);
            this.renderMessages();
            
            if (window.chatApp && window.chatApp.socket && this.currentContact) {
                window.chatApp.socket.emit('delete_message', { 
                    messageId: messageId,
                    contactId: this.currentContact.id 
                });
            }
            
            notificationManager.showInAppNotification("Message Deleted", "Message has been deleted");
        }
    }
    
    // Handle message deletion from server
    handleMessageDeleted(messageId) {
        this.messages = this.messages.filter(msg => msg.id !== messageId);
        this.renderMessages();
    }
    
    // Open media in modal
    openMedia(url, type) {
        if (type === 'image') {
            const imageModal = document.getElementById('image-modal');
            const modalImage = document.getElementById('modal-image');
            
            if (modalImage) modalImage.src = url;
            if (imageModal) imageModal.style.display = 'flex';
        }
    }
    
    // Download file
    downloadFile(url, fileName) {
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    
    // Show typing indicator
    showTypingIndicator(userId) {
        if (this.isTyping) return;
        
        this.isTyping = true;
        const messagesContainer = document.getElementById('messages-container');
        if (!messagesContainer) return;
        
        const typingElement = document.createElement('div');
        typingElement.className = 'typing-indicator';
        typingElement.innerHTML = `
            <div class="typing-dots">
                <span></span>
                <span></span>
                <span></span>
            </div>
        `;
        typingElement.id = 'typing-indicator';
        messagesContainer.appendChild(typingElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    // Hide typing indicator
    hideTypingIndicator() {
        this.isTyping = false;
        const typingIndicator = document.getElementById('typing-indicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }
    
    // Update user status
    updateUserStatus(userId, online) {
        const contact = this.contacts.find(c => c.id === userId);
        if (contact) {
            contact.online = online;
            this.renderContacts();
            
            if (this.currentContact?.id === userId) {
                const activeContactStatus = document.getElementById('active-contact-status');
                if (activeContactStatus) {
                    activeContactStatus.innerHTML = `
                        <span class="status-indicator"></span> ${online ? 'Online • Last seen just now' : 'Offline • Last seen recently'}
                    `;
                }
                
                const panelContactStatus = document.getElementById('panel-contact-status');
                if (panelContactStatus) {
                    panelContactStatus.innerHTML = `
                        <span class="status-indicator"></span> ${online ? 'Online' : 'Offline'}
                    `;
                }
            }
        }
    }
    
    // Refresh contacts from server
    refreshContacts() {
        if (window.chatApp && window.chatApp.socket) {
            window.chatApp.socket.emit('get_contacts');
        }
    }
}

// Create global chat manager instance
const chatManager = new ChatManager();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChatManager;
}