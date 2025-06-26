"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// backend/index.ts
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
const roomUsers = new Map();
io.on("connection", (socket) => {
    console.log("✅ A user connected:", socket.id);
    socket.on("room:join", ({ room, username }) => {
        var _a, _b;
        socket.join(room);
        if (username !== "Anonymous") {
            socket.to(room).emit("user:joined", { username });
        }
        if (!roomUsers.has(room))
            roomUsers.set(room, new Set());
        (_a = roomUsers.get(room)) === null || _a === void 0 ? void 0 : _a.add(socket.id);
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
            const userSet = roomUsers.get(room);
            if (userSet) {
                userSet.delete(socket.id);
                const count = userSet.size;
                io.to(room).emit("room:userCount", { count });
            }
        }
    });
    socket.on("disconnect", () => {
        console.log("🛑 Disconnected:", socket.id);
    });
});
app.use(express_1.default.json());
app.get("/", (_, res) => {
    res.send("Hello from backend!");
});
server.listen(9000, () => {
    console.log("🚀 Server running at http://localhost:9000");
});
