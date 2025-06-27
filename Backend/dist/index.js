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
// room ID => Set of peer usernames (for call)
const roomUsers = new Map();
// socket ID => peer username (to clean up later)
const socketToUsername = new Map();
io.on("connection", (socket) => {
    console.log("✅ A user connected:", socket.id);
    socket.on('room:join', ({ room, peerId }) => {
        var _a, _b;
        socket.join(room);
        socketToUsername.set(socket.id, peerId);
        // Notify others in the room (for call)
        socket.to(room).emit("user:joined", { peerId });
        // Send existing peer usernames to the new user (for call)
        const users = Array.from(roomUsers.get(room) || []).filter((user) => user !== peerId);
        socket.emit("room:existing-users", { users });
        // Track users per room (for call)
        if (!roomUsers.has(room))
            roomUsers.set(room, new Set());
        (_a = roomUsers.get(room)) === null || _a === void 0 ? void 0 : _a.add(peerId);
        // Chat functionality (unchanged)
        const count = ((_b = roomUsers.get(room)) === null || _b === void 0 ? void 0 : _b.size) || 1;
        io.to(room).emit("room:userCount", { count });
    });
    socket.on("message", ({ room, message, sender }) => {
        socket.to(room).emit("message", { sender, message });
    });
    socket.on("disconnecting", () => {
        for (const room of socket.rooms) {
            if (room === socket.id)
                continue;
            // Get peer ID (username) from socket ID
            const username = socketToUsername.get(socket.id);
            const userSet = roomUsers.get(room);
            if (userSet && username) {
                userSet.delete(username);
                const count = userSet.size;
                io.to(room).emit("room:userCount", { count });
            }
        }
    });
    socket.on("disconnect", () => {
        console.log("🛑 Disconnected:", socket.id);
        socketToUsername.delete(socket.id);
    });
});
app.use(express_1.default.json());
app.get("/", (_, res) => {
    res.send("Hello from backend!");
});
server.listen(9000, () => {
    console.log("🚀 Server running at http://localhost:9000");
});
