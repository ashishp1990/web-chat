const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const multer = require('multer');
require('dotenv').config();

const Message = require('./models/Message');
const User = require('./models/User');
const Contact = require('./models/Contact');
const authMiddleware = require('./middleware/auth');

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET;

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB error:', err));

const upload = multer({ dest: path.join(__dirname, 'uploads') });
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(cors());
app.use(express.json());

const onlineUsers = {};
const socketUserMap = {};
const userSocketMap = {};

// Profile image upload
app.post('/profile/image', authMiddleware, upload.single('image'), async (req, res) => {
  const filename = req.file.filename;
  await User.updateOne({ _id: req.user.id }, { profileImage: filename });
  res.json({ message: 'Image uploaded', filename });
});

// Auth routes
app.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  const exists = await User.findOne({ email });
  if (exists) return res.status(400).json({ error: 'Email exists' });
  const hashed = await bcrypt.hash(password, 10);
  await new User({ name, email, password: hashed }).save();
  res.json({ message: 'Registered' });
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user || !(await bcrypt.compare(password, user.password)))
    return res.status(400).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ id: user._id, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user._id, name: user.name, email: user.email, profileImage: user.profileImage } });
});

// Contacts and user
app.get('/users', authMiddleware, async (req, res) => {
  const all = await User.find({});
  res.json(all);
});

app.get('/contacts', authMiddleware, async (req, res) => {
  const contact = await Contact.findOne({ userId: req.user.id });
  res.json(contact ? contact.contacts : []);
});

app.get('/contacts/blocked', authMiddleware, async (req, res) => {
  const contact = await Contact.findOne({ userId: req.user.id });
  res.json(contact?.blocked?.map(b => b.username) || []);
});

app.post('/contacts/block', authMiddleware, async (req, res) => {
  const { username } = req.body;
  const contact = await Contact.findOneAndUpdate(
    { userId: req.user.id },
    { $addToSet: { blocked: { username } } },
    { upsert: true, new: true }
  );
  res.json({ message: 'User blocked' });
});

app.post('/contacts/unblock', authMiddleware, async (req, res) => {
  const { username } = req.body;
  await Contact.updateOne(
    { userId: req.user.id },
    { $pull: { blocked: { username } } }
  );
  res.json({ message: 'User unblocked' });
});

app.post('/contacts/add', authMiddleware, async (req, res) => {
  const { username } = req.body;
  const userId = req.user.id;
  const existingUser = await User.findOne({ name: username });
  if (!existingUser) return res.status(404).json({ error: 'User not found' });

  const contact = await Contact.findOne({ userId });
  if (contact) {
    const alreadyAdded = contact.contacts.find(c => c.username === username);
    if (alreadyAdded) return res.status(400).json({ error: 'Already added' });
    contact.contacts.push({ username });
    await contact.save();
  } else {
    await new Contact({ userId, contacts: [{ username }] }).save();
  }
  res.json({ message: 'Contact added' });
});

app.get('/messages/:user1/:user2', authMiddleware, async (req, res) => {
  const { user1, user2 } = req.params;
  const messages = await Message.find({
    $or: [
      { sender: user1, receiver: user2 },
      { sender: user2, receiver: user1 },
    ]
  }).sort({ timestamp: 1 });
  res.json(messages);
});

// Socket.IO logic
io.on('connection', (socket) => {
  socket.on('user_online', async ({ name }) => {
    onlineUsers[socket.id] = { name, lastSeen: Date.now() };
    socketUserMap[socket.id] = name;
    userSocketMap[name] = socket.id;
    await User.updateOne({ name }, { status: 'Online', lastActive: new Date() });
    const users = await User.find({});
    io.emit('update_users', users);
  });

  socket.on('user_active', async ({ name }) => {
    if (onlineUsers[socket.id]) {
      onlineUsers[socket.id].lastSeen = Date.now();
      await User.updateOne({ name }, { status: 'Online', lastActive: new Date() });
    }
  });

  socket.on('send_message', async (data) => {
    const { sender, receiver, content } = data;
    const message = new Message({ sender, receiver, content });
    await message.save();

    const receiverUser = await User.findOne({ name: receiver });
    const contactList = await Contact.findOne({ userId: receiverUser._id });
    const isBlocked = contactList?.blocked?.some(b => b.username === sender);
    if (isBlocked) return;

    const isContact = contactList?.contacts?.some(c => c.username === sender);
    const receiverSocketId = userSocketMap[receiver];

    if (isContact) {
      io.to(receiverSocketId).emit('receive_message', data);
    } else {
      io.to(receiverSocketId).emit('message_request', { from: sender, content });
    }
  });

  socket.on('typing', ({ from, to }) => {
    const toSocket = userSocketMap[to];
    if (toSocket) {
      io.to(toSocket).emit('typing', { from });
    }
  });

  // Video call signaling
  socket.on('start_call', ({ from, to, isCaller }) => {
    const toSocket = userSocketMap[to];
    if (toSocket) {
      io.to(toSocket).emit('incoming_call', { from, to, isCaller: false });
    }
  });

  socket.on('accept_call', ({ from, to }) => {
    const toSocket = userSocketMap[to];
    if (toSocket) {
      io.to(toSocket).emit('call_accepted', { from, to, isCaller: true });
    }
  });

  socket.on('reject_call', ({ to }) => {
    const toSocket = userSocketMap[to];
    if (toSocket) {
      io.to(toSocket).emit('end_call');
    }
  });

  socket.on('end_call', ({ to }) => {
    const toSocket = userSocketMap[to];
    if (toSocket) {
      io.to(toSocket).emit('end_call');
    }
  });

  socket.on('video-offer', ({ offer, from, to }) => {
    const toSocket = userSocketMap[to];
    if (toSocket) {
      io.to(toSocket).emit('video-offer', { offer, from });
    }
  });

  socket.on('video-answer', ({ answer, from, to }) => {
    const toSocket = userSocketMap[to];
    if (toSocket) {
      io.to(toSocket).emit('video-answer', { answer, from });
    }
  });

  socket.on('ice-candidate', ({ candidate, from, to }) => {
    const toSocket = userSocketMap[to];
    if (toSocket) {
      io.to(toSocket).emit('ice-candidate', { candidate, from });
    }
  });

  socket.on('disconnect', async () => {
    const info = onlineUsers[socket.id];
    if (info) {
      await User.updateOne({ name: info.name }, { status: 'Offline' });
      delete onlineUsers[socket.id];
      delete socketUserMap[socket.id];
      delete userSocketMap[info.name];
      const users = await User.find({});
      io.emit('update_users', users);
    }
  });
});

// Set Away status if inactive > 5min
setInterval(async () => {
  const now = Date.now();
  for (const [socketId, user] of Object.entries(onlineUsers)) {
    if (now - user.lastSeen > 5 * 60 * 1000) {
      await User.updateOne({ name: user.name }, { status: 'Away' });
    }
  }
  const users = await User.find({});
  io.emit('update_users', users);
}, 60000);

// Serve frontend build
app.use(express.static(path.join(__dirname, '../frontend/dist')));
app.get('*', (req, res) => {
  res.sendFile(path.resolve(__dirname, '../frontend/dist/index.html'));
});

server.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
