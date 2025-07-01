import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

// Trackers
const roomUsers = new Map<string, Set<string>>();         // video/chat
const roomPlayers = new Map<string, Set<string>>();       // board movement
const playerPositions = new Map<string, { x: number; y: number }>();
const socketToUsername = new Map<string, string>();
const userToSocketMap = new Map<string, string>();

io.on("connection", (socket) => {
  const userId = socket.handshake.auth?.userId as string;

  if (!userId) {
    console.log("❌ No user ID provided, disconnecting");
    socket.disconnect(true);
    return;
  }

  // Disconnect previous socket if same user
  const existingSocketId = userToSocketMap.get(userId);
  if (existingSocketId && existingSocketId !== socket.id) {
    io.to(existingSocketId).emit("force-disconnect");
    io.sockets.sockets.get(existingSocketId)?.disconnect(true);
  }

  userToSocketMap.set(userId, socket.id);
  socketToUsername.set(socket.id, userId);

  console.log(`✅ User connected: ${userId} → ${socket.id}`);

  // ---------------------- VIDEO CALL JOIN ----------------------
  socket.on("room:join", ({ room, peerId }) => {
    socket.join(room);
    socketToUsername.set(socket.id, peerId);

    // Notify others
    socket.to(room).emit("user:joined", { peerId });

    // Send existing users to new peer
    const users = Array.from(roomUsers.get(room) || []).filter(u => u !== peerId);
    socket.emit("room:existing-users", { users });

    // Track peer
    if (!roomUsers.has(room)) roomUsers.set(room, new Set());
    roomUsers.get(room)?.add(peerId);

    // Broadcast video call user count
    const count = roomUsers.get(room)?.size || 1;
    io.to(room).emit("room:userCount", { count });
  });

  // ---------------------- CHAT JOIN ----------------------
  socket.on("chat:join", ({ room, username }) => {
    socket.join(room);
    socketToUsername.set(socket.id, username);

    if (!roomUsers.has(room)) roomUsers.set(room, new Set());
    roomUsers.get(room)?.add(username);

    const count = roomUsers.get(room)?.size || 1;
    io.to(room).emit("room:userCount", { count });

    socket.to(room).emit("user:joined", { username });
  });

  // ---------------------- PLAYER JOIN ----------------------
  socket.on("player:join", ({ room, playerId }) => {
    socket.join(room);
    socketToUsername.set(socket.id, playerId);

    if (!roomPlayers.has(room)) roomPlayers.set(room, new Set());
    roomPlayers.get(room)?.add(playerId);

    // Send existing player positions to new user
    const currentPlayers = Array.from(roomPlayers.get(room) || []).map((id) => ({
      id,
      position: playerPositions.get(id) || { x: 0, y: 0 },
    }));
    socket.emit("room:playerStates", currentPlayers);
  });

  // ---------------------- PLAYER MOVE ----------------------
  socket.on("player:move", ({ room, playerId, position }) => {
    playerPositions.set(playerId, position);
    socket.to(room).emit("player:moved", { id: playerId, position });
  });

  // ---------------------- CHAT MESSAGE ----------------------
  socket.on("message", ({ room, message, sender }) => {
    socket.to(room).emit("message", { sender, message });
  });

  // ---------------------- DISCONNECT HANDLER ----------------------
  socket.on("disconnecting", () => {
    for (const room of socket.rooms) {
      if (room === socket.id) continue;

      const username = socketToUsername.get(socket.id);

      // Remove from chat/video
      const users = roomUsers.get(room);
      if (users && username) {
        users.delete(username);
        const count = users.size;
        io.to(room).emit("room:userCount", { count });
      }

      // Remove from board
      if (username) {
        roomPlayers.get(room)?.delete(username);
        playerPositions.delete(username);
        socket.to(room).emit("player:left", { id: username });
      }
    }
  });

  socket.on("disconnect", () => {
    console.log("🛑 Disconnected:", socket.id);
    socketToUsername.delete(socket.id);
  });
});

app.use(express.json());

app.get("/", (_, res) => {
  res.send("Hello from backend!");
});

server.listen(9000, () => {
  console.log("🚀 Server running at http://localhost:9000");
});
