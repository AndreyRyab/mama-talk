const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin:
      process.env.NODE_ENV === 'production'
        ? ['https://mama-talk.onrender.com', 'https://your-app-name.onrender.com']
        : ['http://localhost:5173', 'http://localhost:3000'],
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));

  // Handle client-side routing
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
} else {
  // Health check endpoint
  app.get('/', (req, res) => {
    res.json({ status: 'OK', message: 'Mama Talk Server Running' });
  });
}

// Health check endpoint (works in both dev and prod)
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// Store active rooms and users
const rooms = new Map();
const users = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join a room
  socket.on('join-room', ({ roomId, userName }) => {
    socket.join(roomId);

    // Store user info
    users.set(socket.id, { roomId, userName });

    // Initialize room if it doesn't exist
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }

    const room = rooms.get(roomId);
    room.add(socket.id);

    // Notify others in the room
    socket.to(roomId).emit('user-joined', {
      userId: socket.id,
      userName,
    });

    // Send list of existing users to the new user
    const existingUsers = Array.from(room)
      .filter((id) => id !== socket.id)
      .map((id) => ({
        userId: id,
        userName: users.get(id)?.userName || 'Unknown',
      }));

    socket.emit('existing-users', existingUsers);

    console.log(`${userName} joined room ${roomId}`);
  });

  // Handle WebRTC signaling
  socket.on('offer', ({ offer, targetUserId }) => {
    socket.to(targetUserId).emit('offer', {
      offer,
      fromUserId: socket.id,
      fromUserName: users.get(socket.id)?.userName,
    });
  });

  socket.on('answer', ({ answer, targetUserId }) => {
    socket.to(targetUserId).emit('answer', {
      answer,
      fromUserId: socket.id,
    });
  });

  socket.on('ice-candidate', ({ candidate, targetUserId }) => {
    socket.to(targetUserId).emit('ice-candidate', {
      candidate,
      fromUserId: socket.id,
    });
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    if (user) {
      const { roomId, userName } = user;
      const room = rooms.get(roomId);

      if (room) {
        room.delete(socket.id);

        // Remove room if empty
        if (room.size === 0) {
          rooms.delete(roomId);
        } else {
          // Notify others in the room
          socket.to(roomId).emit('user-left', {
            userId: socket.id,
            userName,
          });
        }
      }

      users.delete(socket.id);
      console.log(`${userName} left room ${roomId}`);
    }

    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
