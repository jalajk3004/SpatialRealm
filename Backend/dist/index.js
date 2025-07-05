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
        if (!roomUsers.has(room))
            roomUsers.set(room, new Set());
        (_a = roomUsers.get(room)) === null || _a === void 0 ? void 0 : _a.add(peerId);
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
        if (!playerPositions.has(playerId)) {
            playerPositions.set(playerId, { x: 150, y: 150 });
        }
        if (character !== undefined) {
            playerCharacters.set(playerId, character);
        }
        const currentPlayers = Array.from(roomPlayers.get(room) || []).map((id) => ({
            id,
            position: playerPositions.get(id) || { x: 150, y: 150 },
            character: playerCharacters.get(id) || 0,
        }));
        socket.emit("room:playerStates", currentPlayers);
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
        const users = roomUsers.get(room);
        if (users && peerId) {
            users.delete(peerId);
            const count = users.size;
            io.to(room).emit("room:userCount", { count });
            socket.to(room).emit("user:left", { peerId });
        }
        if (peerId) {
            (_a = roomPlayers.get(room)) === null || _a === void 0 ? void 0 : _a.delete(peerId);
            playerPositions.delete(peerId);
            playerCharacters.delete(peerId);
            socket.to(room).emit("player:left", { id: peerId });
            console.log(`🎮 Player left game: ${peerId} from room ${room}`);
        }
        console.log(`🚪 User left room: ${peerId} from ${room}`);
    });
    // ---------------------- PRIVATE ROOM JOIN ----------------------
    socket.on("private:join", ({ room, playerId, publicRoom, areaId }) => {
        var _a, _b;
        console.log(`🔐 ${playerId} joining private room: ${room} (area ${areaId})`);
        socket.leave(publicRoom);
        socket.join(room);
        if (!roomUsers.has(room))
            roomUsers.set(room, new Set());
        (_a = roomUsers.get(room)) === null || _a === void 0 ? void 0 : _a.add(playerId);
        socket.to(room).emit("private:userJoined", {
            peerId: playerId,
            areaId,
            type: "private"
        });
        const privateUsers = Array.from(roomUsers.get(room) || []).filter(u => u !== playerId);
        socket.emit("private:existingUsers", { users: privateUsers, areaId });
        const privateCount = ((_b = roomUsers.get(room)) === null || _b === void 0 ? void 0 : _b.size) || 1;
        io.to(room).emit("private:userCount", { count: privateCount, areaId });
        console.log(`🔒 Private room ${room} now has ${privateCount} users`);
    });
    // ---------------------- PRIVATE ROOM LEAVE ----------------------
    socket.on("private:leave", ({ room, playerId, publicRoom }) => {
        console.log(`🚪 ${playerId} leaving private room: ${room}`);
        socket.leave(room);
        const privateUsers = roomUsers.get(room);
        if (privateUsers) {
            privateUsers.delete(playerId);
            const privateCount = privateUsers.size;
            socket.to(room).emit("private:userLeft", { peerId: playerId });
            io.to(room).emit("private:userCount", { count: privateCount });
            if (privateCount === 0) {
                roomUsers.delete(room);
                console.log(`🧹 Cleaned up empty private room: ${room}`);
            }
        }
        // ✨ Notify this client to leave private chat mode
        const clientSocketId = userToSocketMap.get(playerId);
        if (clientSocketId) {
            io.to(clientSocketId).emit("private:forceLeave");
        }
        socket.join(publicRoom);
        console.log(`🔓 ${playerId} rejoined public room: ${publicRoom}`);
    });
    // ---------------------- PRIVATE MESSAGE ----------------------
    socket.on("private:message", ({ room, message, sender }) => {
        console.log(`💬 Private message in ${room} from ${sender}`);
        socket.to(room).emit("private:message", { sender, message, type: "private" });
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
            const users = roomUsers.get(room);
            if (users && username) {
                users.delete(username);
                const count = users.size;
                io.to(room).emit("room:userCount", { count });
                socket.to(room).emit("user:left", { peerId: username });
                console.log(`📹 Removed ${username} from video/chat in room ${room}`);
            }
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
        socketToUsername.delete(socket.id);
        if (username) {
            userToSocketMap.delete(username);
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
