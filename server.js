require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');

// === Web Push Setup ===
async function sendPushToUser(userDoc, payload) {
  if (!userDoc || !userDoc.subscription) return;
  try {
    await webpush.sendNotification(userDoc.subscription, JSON.stringify(payload));
  } catch (err) {
    console.error('Web push error:', err && err.body || err);
  }
}

const webpush = require('web-push');
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} else {
  console.warn('⚠️  VAPID keys missing. Push notifications will not work until you set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in .env');
}


const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB connection
const MONGODB_URI = 'mongodb+srv://RiyaGupta:MP36mp6787@cluster0.5mvc7qr.mongodb.net/chatdb?retryWrites=true&w=majority';

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ Connected to MongoDB Atlas'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// User Schema
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  avatar: { type: String, default: '' },
  online: { type: Boolean, default: false },
  lastSeen: { type: Date, default: Date.now }
,
  subscription: { type: Object, default: null }}, { timestamps: true });

// Message Schema
const messageSchema = new mongoose.Schema({
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true },
  messageType: { type: String, enum: ['text', 'image', 'video', 'file'], default: 'text' },
  fileUrl: { type: String, default: '' },
  fileName: { type: String, default: '' },
  fileSize: { type: String, default: '' },
  timestamp: { type: Date, default: Date.now },
  read: { type: Boolean, default: false }
});

// Call History Schema
const callSchema = new mongoose.Schema({
  callerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  callType: { type: String, enum: ['audio', 'video'], required: true },
  status: { type: String, enum: ['missed', 'answered', 'rejected'], required: true },
  duration: { type: Number, default: 0 },
  timestamp: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Message = mongoose.model('Message', messageSchema);
const Call = mongoose.model('Call', callSchema);

// JWT Secret
const JWT_SECRET = 'chat_app_secret_key_2024';

// Store online users and their socket connections
const onlineUsers = new Map();
const userSockets = new Map();
const userConversations = new Map();
const activeCalls = new Map();

io.on('connection', (socket) => {
  console.log('👤 New connection:', socket.id);

  // Handle login
  socket.on('login', async (data) => {
    try {
      console.log('🔐 Login attempt:', data.email);
      const { email, password } = data;
      
      const user = await User.findOne({ email });
      if (!user) {
        console.log('❌ User not found:', email);
        socket.emit('auth_failed', 'Invalid email or password');
        return;
      }
      
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        console.log('❌ Invalid password for:', email);
        socket.emit('auth_failed', 'Invalid email or password');
        return;
      }
      
      const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '7d' });
      
      await User.findByIdAndUpdate(user._id, { 
        online: true, 
        lastSeen: new Date()
      });
      
      socket.userId = user._id.toString();
      onlineUsers.set(user._id.toString(), true);
      userSockets.set(user._id.toString(), socket.id);
      
      // Load user's conversations
      await loadUserConversations(user._id.toString());
      
      const userData = {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        avatar: user.avatar || user.name.charAt(0).toUpperCase(),
        token: token
      };
      
      console.log('✅ Login successful:', user.email);
      socket.emit('auth_success', userData);
      socket.broadcast.emit('user_online', user._id.toString());
      
    } catch (error) {
      console.error('❌ Login error:', error);
      socket.emit('auth_failed', 'Login failed');
    }
  });
  
  // Handle registration
  socket.on('register', async (data) => {
    try {
      console.log('📝 Registration attempt:', data.email);
      const { name, email, password } = data;
      
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        console.log('❌ User already exists:', email);
        socket.emit('auth_failed', 'User already exists with this email');
        return;
      }
      
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const newUser = new User({
        name,
        email,
        password: hashedPassword,
        avatar: name.charAt(0).toUpperCase()
      });
      
      await newUser.save();
      console.log('✅ User created:', newUser.email);
      
      const token = jwt.sign({ id: newUser._id }, JWT_SECRET, { expiresIn: '7d' });
      
      socket.userId = newUser._id.toString();
      onlineUsers.set(newUser._id.toString(), true);
      userSockets.set(newUser._id.toString(), socket.id);
      
      userConversations.set(newUser._id.toString(), new Set());
      
      const userData = {
        id: newUser._id.toString(),
        name: newUser.name,
        email: newUser.email,
        avatar: newUser.avatar,
        token: token
      };
      
      console.log('✅ Registration successful:', newUser.email);
      socket.emit('auth_success', userData);
      
      const newUserContact = {
        id: newUser._id.toString(),
        name: newUser.name,
        avatar: newUser.avatar,
        online: true,
        lastSeen: new Date(),
        lastMessage: '',
        lastTime: '',
        muted: false
      };
      
      socket.broadcast.emit('new_user_added', newUserContact);
      console.log('📢 Broadcasted new user to all clients:', newUser.name);
      
    } catch (error) {
      console.error('❌ Registration error:', error);
      socket.emit('auth_failed', 'Registration failed: ' + error.message);
    }
  });

  // Handle authentication with token
  socket.on('authenticate', async (data) => {
    try {
      const { token } = data;
      if (!token) {
        socket.emit('auth_failed', 'No token provided');
        return;
      }

      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await User.findById(decoded.id);
      
      if (!user) {
        socket.emit('auth_failed', 'User not found');
        return;
      }

      socket.userId = user._id.toString();
      
      await User.findByIdAndUpdate(user._id, { online: true, lastSeen: new Date() });
      onlineUsers.set(user._id.toString(), true);
      userSockets.set(user._id.toString(), socket.id);
      
      await loadUserConversations(user._id.toString());
      
      const userData = {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        token: token
      };
      
      console.log('✅ User authenticated:', user.email);
      socket.emit('auth_success', userData);
      socket.broadcast.emit('user_online', user._id.toString());
      
    } catch (error) {
      console.error('❌ Authentication error:', error);
      socket.emit('auth_failed', 'Authentication failed');
    }
  });
  
  // Load user conversations
  async function loadUserConversations(userId) {
    try {
      const messages = await Message.find({
        $or: [
          { senderId: userId },
          { receiverId: userId }
        ]
      });
      
      const userConvos = new Set();
      messages.forEach(msg => {
        if (msg.senderId.toString() !== userId) {
          userConvos.add(msg.senderId.toString());
        }
        if (msg.receiverId.toString() !== userId) {
          userConvos.add(msg.receiverId.toString());
        }
      });
      
      userConversations.set(userId, userConvos);
      console.log(`💬 Loaded ${userConvos.size} conversations for user ${userId}`);
    } catch (error) {
      console.error('❌ Error loading conversations:', error);
    }
  }
  
  // Get all users
  socket.on('get_all_users', async () => {
    try {
      if (!socket.userId) {
        console.log('❌ get_all_users: No user ID');
        return;
      }

      console.log('👥 Getting all users for:', socket.userId);
      
      const allUsers = await User.find({ 
        _id: { $ne: socket.userId } 
      }).select('name email avatar online lastSeen');
      
      const usersWithLastMessage = await Promise.all(
        allUsers.map(async (user) => {
          const lastMessage = await Message.findOne({
            $or: [
              { senderId: socket.userId, receiverId: user._id },
              { senderId: user._id, receiverId: socket.userId }
            ]
          }).sort({ timestamp: -1 });
          
          return {
            id: user._id.toString(),
            name: user.name,
            avatar: user.avatar || user.name.charAt(0).toUpperCase(),
            online: user.online,
            lastSeen: user.lastSeen,
            lastMessage: lastMessage ? lastMessage.text : 'No messages yet',
            lastTime: lastMessage ? formatTime(lastMessage.timestamp) : '',
            muted: false,
            hasConversation: !!lastMessage
          };
        })
      );
      
      console.log('👥 Sending all users list with', usersWithLastMessage.length, 'users');
      socket.emit('all_users_list', usersWithLastMessage);
      
    } catch (error) {
      console.error('❌ Error fetching all users:', error);
    }
  });
  
  // Get contacts (only users with conversations)
  socket.on('get_contacts', async () => {
    try {
      if (!socket.userId) {
        console.log('❌ get_contacts: No user ID');
        return;
      }

      console.log('📞 Getting contacts for user:', socket.userId);
      
      const userConvos = userConversations.get(socket.userId) || new Set();
      console.log(`💭 User has conversations with: ${Array.from(userConvos).join(', ')}`);
      
      if (userConvos.size === 0) {
        socket.emit('contacts_list', []);
        return;
      }
      
      const usersWithConversations = await User.find({ 
        _id: { $in: Array.from(userConvos) } 
      }).select('name email avatar online lastSeen');
      
      const contactsWithLastMessage = await Promise.all(
        usersWithConversations.map(async (user) => {
          const lastMessage = await Message.findOne({
            $or: [
              { senderId: socket.userId, receiverId: user._id },
              { senderId: user._id, receiverId: socket.userId }
            ]
          }).sort({ timestamp: -1 });
          
          return {
            id: user._id.toString(),
            name: user.name,
            avatar: user.avatar || user.name.charAt(0).toUpperCase(),
            online: user.online,
            lastSeen: user.lastSeen,
            lastMessage: lastMessage ? lastMessage.text : 'No messages yet',
            lastTime: lastMessage ? formatTime(lastMessage.timestamp) : '',
            muted: false
          };
        })
      );
      
      console.log('📱 Sending contacts list with', contactsWithLastMessage.length, 'contacts');
      socket.emit('contacts_list', contactsWithLastMessage);
      
    } catch (error) {
      console.error('❌ Error fetching contacts:', error);
      socket.emit('contacts_list', []);
    }
  });
  
  // Search users by name
  socket.on('search_users', async (data) => {
    try {
      const { searchTerm } = data;
      if (!socket.userId || !searchTerm.trim()) {
        return;
      }

      console.log('🔍 Searching users for:', searchTerm);
      
      const users = await User.find({
        _id: { $ne: socket.userId },
        name: { $regex: searchTerm, $options: 'i' }
      }).select('name email avatar online lastSeen');
      
      const searchResults = users.map(user => ({
        id: user._id.toString(),
        name: user.name,
        avatar: user.avatar || user.name.charAt(0).toUpperCase(),
        online: user.online,
        lastSeen: user.lastSeen,
        lastMessage: '',
        lastTime: '',
        muted: false,
        isSearchResult: true
      }));
      
      console.log('🔍 Found', searchResults.length, 'users');
      socket.emit('search_users_results', searchResults);
      
    } catch (error) {
      console.error('❌ Error searching users:', error);
    }
  });
  
  // Get conversation history - FIXED VERSION
  socket.on('get_conversation', async (data) => {
    try {
      const { contactId } = data;
      console.log('💭 Getting conversation with:', contactId);
      
      if (!socket.userId || !contactId) {
        console.log('❌ Missing user ID or contact ID');
        return;
      }

      const messages = await Message.find({
        $or: [
          { senderId: socket.userId, receiverId: contactId },
          { senderId: contactId, receiverId: socket.userId }
        ]
      })
      .sort({ timestamp: 1 })
      .populate('senderId', 'name avatar')
      .lean();
      
      console.log('📨 Found', messages.length, 'messages in conversation');
      
      const formattedMessages = messages.map(msg => ({
        id: msg._id.toString(),
        text: msg.text,
        senderId: msg.senderId._id.toString(),
        receiverId: msg.receiverId.toString(),
        timestamp: msg.timestamp,
        messageType: msg.messageType,
        fileUrl: msg.fileUrl,
        fileName: msg.fileName,
        fileSize: msg.fileSize,
        type: msg.senderId._id.toString() === socket.userId ? 'sent' : 'received'
      }));
      
      console.log('📨 Sending', formattedMessages.length, 'messages to client');
      socket.emit('conversation_history', {
        contactId,
        messages: formattedMessages
      });
      
    } catch (error) {
      console.error('❌ Error fetching conversation:', error);
      socket.emit('conversation_history', {
        contactId: data.contactId,
        messages: []
      });
    }
  });
  
  // Send message
  socket.on('send_message', async (data) => {
    try {
      const { text, receiverId, messageType = 'text', fileUrl = '', fileName = '', fileSize = '' } = data;
      console.log('💬 Sending message to:', receiverId, 'Type:', messageType);
      
      if (!text || !text.trim()) {
        console.log('❌ Empty message');
        return;
      }
      
      // Add to conversations
      if (!userConversations.has(socket.userId)) {
        userConversations.set(socket.userId, new Set());
      }
      if (!userConversations.has(receiverId)) {
        userConversations.set(receiverId, new Set());
      }
      
      userConversations.get(socket.userId).add(receiverId);
      userConversations.get(receiverId).add(socket.userId);
      
      const newMessage = new Message({
        senderId: socket.userId,
        receiverId,
        text: text.trim(),
        messageType,
        fileUrl,
        fileName,
        fileSize,
        timestamp: new Date()
      });
      
      await newMessage.save();
      await newMessage.populate('senderId', 'name avatar');
      
      const messageData = {
        id: newMessage._id.toString(),
        text: newMessage.text,
        senderId: newMessage.senderId._id.toString(),
        receiverId: newMessage.receiverId.toString(),
        timestamp: newMessage.timestamp,
        messageType: newMessage.messageType,
        fileUrl: newMessage.fileUrl,
        fileName: newMessage.fileName,
        fileSize: newMessage.fileSize,
        type: 'received'
      };
      
      // Send to sender
      socket.emit('new_message', {
        ...messageData,
        type: 'sent'
      });
      
      // Send to receiver if online
      const receiverSocketId = userSockets.get(receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('new_message', messageData);
        
        if (messageType !== 'text') {
          io.to(receiverSocketId).emit('file_message_notification', {
            from: socket.userId,
            fileName: fileName,
            messageType: messageType
          });
        }
      }
      
      console.log('✅ Message sent successfully from', socket.userId, 'to', receiverId);
      
    } catch (error) {
      console.error('❌ Error sending message:', error);
    }
  });
  
  // Send file message
  socket.on('send_file_message', async (data) => {
    try {
      const { receiverId, fileUrl, fileName, fileSize, messageType } = data;
      console.log('📎 Sending file message to:', receiverId, 'File:', fileName);
      
      if (!userConversations.has(socket.userId)) {
        userConversations.set(socket.userId, new Set());
      }
      if (!userConversations.has(receiverId)) {
        userConversations.set(receiverId, new Set());
      }
      
      userConversations.get(socket.userId).add(receiverId);
      userConversations.get(receiverId).add(socket.userId);
      
      const text = messageType === 'image' ? '📷 Photo' : 
                  messageType === 'video' ? '🎥 Video' : 
                  `📄 ${fileName}`;
      
      const newMessage = new Message({
        senderId: socket.userId,
        receiverId,
        text: text,
        messageType,
        fileUrl,
        fileName,
        fileSize,
        timestamp: new Date()
      });
      
      await newMessage.save();
      await newMessage.populate('senderId', 'name avatar');
      
      const messageData = {
        id: newMessage._id.toString(),
        text: newMessage.text,
        senderId: newMessage.senderId._id.toString(),
        receiverId: newMessage.receiverId.toString(),
        timestamp: newMessage.timestamp,
        messageType: newMessage.messageType,
        fileUrl: newMessage.fileUrl,
        fileName: newMessage.fileName,
        fileSize: newMessage.fileSize,
        type: 'received'
      };
      
      socket.emit('new_message', {
        ...messageData,
        type: 'sent'
      });
      
      const receiverSocketId = userSockets.get(receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('new_message', messageData);
        io.to(receiverSocketId).emit('file_message_notification', {
          from: socket.userId,
          fileName: fileName,
          messageType: messageType
        });
      }
      
      console.log('✅ File message sent successfully');
      
    } catch (error) {
      console.error('❌ Error sending file message:', error);
    }
  });
  
  // Delete message
  socket.on('delete_message', async (data) => {
    try {
      const { messageId, contactId } = data;
      console.log('🗑️ Deleting message:', messageId);
      
      await Message.findByIdAndDelete(messageId);
      
      const receiverSocketId = userSockets.get(contactId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('message_deleted', { messageId });
      }
      
      socket.emit('message_deleted', { messageId });
      
      console.log('✅ Message deleted successfully');
      
    } catch (error) {
      console.error('❌ Error deleting message:', error);
    }
  });

  // VIDEO/AUDIO CALL FUNCTIONALITY
  socket.on('initiate_call', (data) => {
    const { receiverId, callType } = data;
    console.log(`📞 ${callType} call initiated from ${socket.userId} to ${receiverId}`);
    
    const receiverSocketId = userSockets.get(receiverId);
    if (receiverSocketId) {
      activeCalls.set(socket.userId, { receiverId, callType, status: 'calling' });
      activeCalls.set(receiverId, { callerId: socket.userId, callType, status: 'ringing' });
      
      io.to(receiverSocketId).emit('incoming_call', {
        callerId: socket.userId,
        callType: callType
      });
      
      socket.emit('call_initiated', { receiverId, callType });
    } else {
      socket.emit('call_failed', { reason: 'User is offline' });
    }
  });

  socket.on('answer_call', async (data) => {
    const { callerId } = data;
    console.log(`📞 Call answered by ${socket.userId} from ${callerId}`);
    
    const callerSocketId = userSockets.get(callerId);
    if (callerSocketId) {
      activeCalls.set(callerId, { ...activeCalls.get(callerId), status: 'answered' });
      activeCalls.set(socket.userId, { ...activeCalls.get(socket.userId), status: 'answered' });
      
      io.to(callerSocketId).emit('call_answered', { receiverId: socket.userId });
      
      const call = new Call({
        callerId: callerId,
        receiverId: socket.userId,
        callType: activeCalls.get(callerId).callType,
        status: 'answered',
        duration: 0,
        timestamp: new Date()
      });
      await call.save();
    }
  });

  socket.on('reject_call', async (data) => {
    const { callerId } = data;
    console.log(`📞 Call rejected by ${socket.userId} from ${callerId}`);
    
    const callerSocketId = userSockets.get(callerId);
    if (callerSocketId) {
      io.to(callerSocketId).emit('call_rejected', { receiverId: socket.userId });
      
      const call = new Call({
        callerId: callerId,
        receiverId: socket.userId,
        callType: activeCalls.get(callerId).callType,
        status: 'rejected',
        duration: 0,
        timestamp: new Date()
      });
      await call.save();
      
      activeCalls.delete(callerId);
      activeCalls.delete(socket.userId);
    }
  });

  socket.on('end_call', async (data) => {
    const { otherUserId, duration } = data;
    console.log(`📞 Call ended by ${socket.userId} with ${otherUserId}, duration: ${duration}s`);
    
    const otherUserSocketId = userSockets.get(otherUserId);
    if (otherUserSocketId) {
      io.to(otherUserSocketId).emit('call_ended', { endedBy: socket.userId });
      
      if (activeCalls.has(socket.userId)) {
        await Call.findOneAndUpdate(
          { 
            callerId: { $in: [socket.userId, otherUserId] },
            receiverId: { $in: [socket.userId, otherUserId] },
            timestamp: { $gte: new Date(Date.now() - 300000) }
          },
          { duration: duration },
          { sort: { timestamp: -1 } }
        );
      }
      
      activeCalls.delete(socket.userId);
      activeCalls.delete(otherUserId);
    }
  });

  // WebRTC signaling
  socket.on('webrtc_offer', (data) => {
    const { offer, to } = data;
    const toSocketId = userSockets.get(to);
    if (toSocketId) {
      io.to(toSocketId).emit('webrtc_offer', {
        offer: offer,
        from: socket.userId
      });
    }
  });

  socket.on('webrtc_answer', (data) => {
    const { answer, to } = data;
    const toSocketId = userSockets.get(to);
    if (toSocketId) {
      io.to(toSocketId).emit('webrtc_answer', {
        answer: answer,
        from: socket.userId
      });
    }
  });

  socket.on('webrtc_ice_candidate', (data) => {
    const { candidate, to } = data;
    const toSocketId = userSockets.get(to);
    if (toSocketId) {
      io.to(toSocketId).emit('webrtc_ice_candidate', {
        candidate: candidate,
        from: socket.userId
      });
    }
  });

  // Get call history
  socket.on('get_call_history', async (data) => {
    try {
      const { contactId } = data;
      console.log('📞 Getting call history with:', contactId);
      
      const calls = await Call.find({
        $or: [
          { callerId: socket.userId, receiverId: contactId },
          { callerId: contactId, receiverId: socket.userId }
        ]
      })
      .sort({ timestamp: -1 })
      .limit(20)
      .populate('callerId', 'name avatar')
      .populate('receiverId', 'name avatar');
      
      socket.emit('call_history', {
        contactId,
        calls: calls
      });
      
    } catch (error) {
      console.error('❌ Error fetching call history:', error);
    }
  });
  
  // Handle disconnection
  socket.on('disconnect', async () => {
    console.log('👤 User disconnected:', socket.userId);
    
    if (socket.userId) {
      try {
        await User.findByIdAndUpdate(socket.userId, { online: false, lastSeen: new Date() });
        onlineUsers.delete(socket.userId);
        userSockets.delete(socket.userId);
        
        if (activeCalls.has(socket.userId)) {
          const callData = activeCalls.get(socket.userId);
          const otherUserId = callData.callerId === socket.userId ? callData.receiverId : callData.callerId;
          const otherUserSocketId = userSockets.get(otherUserId);
          
          if (otherUserSocketId) {
            io.to(otherUserSocketId).emit('call_ended', { endedBy: socket.userId, reason: 'disconnected' });
          }
          
          activeCalls.delete(socket.userId);
          activeCalls.delete(otherUserId);
        }
        
        socket.broadcast.emit('user_offline', socket.userId);
      } catch (err) {
        console.error('❌ Error updating user status:', err);
      }
    }
  });
});

// Helper function to format time
function formatTime(date) {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  return `${hours}:${minutes < 10 ? '0' : ''}${minutes}`;
}

const PORT = process.env.PORT || 3000;
// Save push subscription
app.post('/api/save-subscription', async (req, res) => {
  try {
    const { email, subscription } = req.body || {};
    if (!email || !subscription) {
      return res.status(400).json({ error: 'email and subscription required' });
    }
    const user = await User.findOneAndUpdate({ email }, { subscription }, { new: true });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ ok: true });
  } catch (e) {
    console.error('Error saving subscription', e);
    res.status(500).json({ error: 'Server error' });
  }
});

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Open http://localhost:${PORT} in your browser`);
});