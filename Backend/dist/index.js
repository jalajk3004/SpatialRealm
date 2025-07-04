"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
const io = new socket_io_1.Server(server, {
    cors: {
        origin: "*",
    },
});
// Trackers
const roomUsers = new Map(); // video/chat
const roomPlayers = new Map(); // board movement
const playerPositions = new Map();
const playerCharacters = new Map(); // player character assignments
const socketToUsername = new Map();
const userToSocketMap = new Map();
io.on("connection", (socket) => {
    var _a, _b;
    const userId = (_a = socket.handshake.auth) === null || _a === void 0 ? void 0 : _a.userId;
    if (!userId) {
        console.log("❌ No user ID provided, disconnecting");
        socket.disconnect(true);
        return;
    }
    // Disconnect previous socket if same user
    const existingSocketId = userToSocketMap.get(userId);
    if (existingSocketId && existingSocketId !== socket.id) {
        io.to(existingSocketId).emit("force-disconnect");
        (_b = io.sockets.sockets.get(existingSocketId)) === null || _b === void 0 ? void 0 : _b.disconnect(true);
    }
    userToSocketMap.set(userId, socket.id);
    socketToUsername.set(socket.id, userId);
    console.log(`✅ User connected: ${userId} → ${socket.id}`);
    // ---------------------- VIDEO CALL JOIN ----------------------
    socket.on("room:join", ({ room, peerId }) => {
        var _a, _b;
        socket.join(room);
        socketToUsername.set(socket.id, peerId);
        // Notify others
        socket.to(room).emit("user:joined", { peerId });
        // Send existing users to new peer
        const users = Array.from(roomUsers.get(room) || []).filter(u => u !== peerId);
        socket.emit("room:existing-users", { users });
        // Track peer
        if (!roomUsers.has(room))
            roomUsers.set(room, new Set());
        (_a = roomUsers.get(room)) === null || _a === void 0 ? void 0 : _a.add(peerId);
        // Broadcast video call user count
        const count = ((_b = roomUsers.get(room)) === null || _b === void 0 ? void 0 : _b.size) || 1;
        io.to(room).emit("room:userCount", { count });
    });
    // ---------------------- CHAT JOIN ----------------------
    socket.on("chat:join", ({ room, username }) => {
        var _a, _b;
        socket.join(room);
        socketToUsername.set(socket.id, username);
        if (!roomUsers.has(room))
            roomUsers.set(room, new Set());
        (_a = roomUsers.get(room)) === null || _a === void 0 ? void 0 : _a.add(username);
        const count = ((_b = roomUsers.get(room)) === null || _b === void 0 ? void 0 : _b.size) || 1;
        io.to(room).emit("room:userCount", { count });
        socket.to(room).emit("user:joined", { username });
    });
    // ---------------------- PLAYER JOIN ----------------------
    socket.on("player:join", ({ room, playerId, character }) => {
        var _a;
        socket.join(room);
        socketToUsername.set(socket.id, playerId);
        if (!roomPlayers.has(room))
            roomPlayers.set(room, new Set());
        (_a = roomPlayers.get(room)) === null || _a === void 0 ? void 0 : _a.add(playerId);
        // Set default spawn position if not exists (spawn in walkable area)
        if (!playerPositions.has(playerId)) {
            playerPositions.set(playerId, { x: 150, y: 150 });
        }
        // Store player character
        if (character !== undefined) {
            playerCharacters.set(playerId, character);
        }
        // Send existing player positions and characters to new user
        const currentPlayers = Array.from(roomPlayers.get(room) || []).map((id) => ({
            id,
            position: playerPositions.get(id) || { x: 150, y: 150 },
            character: playerCharacters.get(id) || 0,
        }));
        socket.emit("room:playerStates", currentPlayers);
        // Notify other players about new player joining
        socket.to(room).emit("player:joined", {
            id: playerId,
            position: playerPositions.get(playerId) || { x: 150, y: 150 },
            character: playerCharacters.get(playerId) || 0
        });
        console.log(`🎮 Player joined game: ${playerId} (character ${character}) in room ${room}`);
    });
    // ---------------------- PLAYER MOVE ----------------------
    socket.on("player:move", ({ room, playerId, position }) => {
        playerPositions.set(playerId, position);
        socket.to(room).emit("player:moved", { id: playerId, position });
    });
    // ---------------------- ROOM LEAVE ----------------------
    socket.on("room:leave", ({ room, peerId }) => {
        var _a;
        socket.leave(room);
        // Remove from video/chat users
        const users = roomUsers.get(room);
        if (users && peerId) {
            users.delete(peerId);
            const count = users.size;
            io.to(room).emit("room:userCount", { count });
            socket.to(room).emit("user:left", { peerId });
        }
        // Also remove from board/game
        if (peerId) {
            (_a = roomPlayers.get(room)) === null || _a === void 0 ? void 0 : _a.delete(peerId);
            playerPositions.delete(peerId);
            playerCharacters.delete(peerId);
            socket.to(room).emit("player:left", { id: peerId });
            console.log(`🎮 Player left game: ${peerId} from room ${room}`);
        }
        console.log(`🚪 User left room: ${peerId} from ${room}`);
    });
    // ---------------------- CHAT MESSAGE ----------------------
    socket.on("message", ({ room, message, sender }) => {
        socket.to(room).emit("message", { sender, message });
    });
    // ---------------------- DISCONNECT HANDLER ----------------------
    socket.on("disconnecting", () => {
        const username = socketToUsername.get(socket.id);
        console.log(`🔌 User disconnecting: ${username} (${socket.id})`);
        for (const room of socket.rooms) {
            if (room === socket.id)
                continue;
            console.log(`🧹 Cleaning up user ${username} from room ${room}`);
            // Remove from chat/video
            const users = roomUsers.get(room);
            if (users && username) {
                users.delete(username);
                const count = users.size;
                io.to(room).emit("room:userCount", { count });
                socket.to(room).emit("user:left", { peerId: username });
                console.log(`📹 Removed ${username} from video/chat in room ${room}`);
            }
            // Remove from board/game
            const players = roomPlayers.get(room);
            if (players && username) {
                players.delete(username);
                playerPositions.delete(username);
                playerCharacters.delete(username);
                socket.to(room).emit("player:left", { id: username });
                console.log(`🎮 Removed player ${username} from game in room ${room}`);
            }
        }
    });
    socket.on("disconnect", () => {
        const username = socketToUsername.get(socket.id);
        console.log(`🛑 User fully disconnected: ${username} (${socket.id})`);
        // Clean up all references
        socketToUsername.delete(socket.id);
        if (username) {
            userToSocketMap.delete(username);
            // Final cleanup - remove from any remaining positions and characters
            playerPositions.delete(username);
            playerCharacters.delete(username);
        }
    });
});
app.use(express_1.default.json());
app.get("/", (_, res) => {
    res.send("Hello from backend!");
});
server.listen(9000, () => {
    console.log("🚀 Server running at http://localhost:9000");
});
