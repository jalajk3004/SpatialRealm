"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const crypto_1 = __importDefault(require("crypto"));
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
const io = new socket_io_1.Server(server, {
    cors: {
        origin: "*",
    },
});
// Trackers
const roomUsers = new Map(); // chat users
const roomVideoUsers = new Map(); // video peer IDs
const roomPlayers = new Map(); // board movement
const playerPositions = new Map();
const playerCharacters = new Map();
const socketToUsername = new Map();
const userToSocketMap = new Map();
const privateRoomUsers = new Map(); // private area users
const userPrivateStatus = new Map();
const privateAreaKeys = new Map(); // encryption keys for private areas
const privatePeerIds = new Map(); // userId -> privatePeerId mapping
// Utility functions for private area management
const generateEncryptionKey = () => {
    return crypto_1.default.randomBytes(32).toString('hex');
};
const getOrCreatePrivateKey = (areaId) => {
    if (!privateAreaKeys.has(areaId)) {
        privateAreaKeys.set(areaId, generateEncryptionKey());
    }
    return privateAreaKeys.get(areaId);
};
io.on("connection", (socket) => {
    var _a, _b;
    const userId = (_a = socket.handshake.auth) === null || _a === void 0 ? void 0 : _a.userId;
    if (!userId) {
        console.log("❌ No user ID provided, disconnecting");
        socket.disconnect(true);
        return;
    }
    const existingSocketId = userToSocketMap.get(userId);
    if (existingSocketId && existingSocketId !== socket.id) {
        io.to(existingSocketId).emit("force-disconnect");
        (_b = io.sockets.sockets.get(existingSocketId)) === null || _b === void 0 ? void 0 : _b.disconnect(true);
    }
    userToSocketMap.set(userId, socket.id);
    socketToUsername.set(socket.id, userId);
    // Initialize private status
    userPrivateStatus.set(userId, { inPrivate: false });
    console.log(`✅ User connected: ${userId} → ${socket.id}`);
    // ---------------------- VIDEO SIGNAL ROOM JOIN ----------------------
    socket.on("user:call", ({ to, offer }) => {
        io.to(to).emit("incomming:call", { from: socket.id, offer });
    });
    socket.on("call:accepted", ({ to, ans }) => {
        io.to(to).emit("call:accepted", { from: socket.id, ans });
    });
    socket.on("peer:nego:needed", ({ to, offer }) => {
        console.log("peer:nego:needed", offer);
        io.to(to).emit("peer:nego:needed", { from: socket.id, offer });
    });
    socket.on("peer:nego:done", ({ to, ans }) => {
        console.log("peer:nego:done", ans);
        io.to(to).emit("peer:nego:final", { from: socket.id, ans });
    });
    // ---------------------- VIDEO CALL JOIN ----------------------
    socket.on("room:join", ({ room, peerId }) => {
        var _a, _b;
        console.log(`📹 Video join request: ${peerId} joining room ${room}`);
        socket.join(room);
        socketToUsername.set(socket.id, peerId);
        // Update user's public room status
        const userStatus = userPrivateStatus.get(userId) || { inPrivate: false };
        userStatus.publicRoom = room;
        userPrivateStatus.set(userId, userStatus);
        // Join public video room initially
        const publicVideoRoom = `${room}_video_public`;
        socket.join(publicVideoRoom);
        console.log(`📹 ${userId} joined public video room: ${publicVideoRoom}`);
        // Notify existing public users about new video participant
        socket.to(publicVideoRoom).emit("user:joined", { peerId });
        // Get existing public video users (not in private areas)
        const publicVideoUsers = Array.from(roomVideoUsers.get(room) || [])
            .filter(u => {
            const uStatus = userPrivateStatus.get(u);
            return u !== peerId && (!uStatus || !uStatus.inPrivate);
        });
        console.log(`📹 Sending existing video users to ${peerId}:`, publicVideoUsers);
        socket.emit("room:existing-users", { users: publicVideoUsers });
        if (!roomVideoUsers.has(room))
            roomVideoUsers.set(room, new Set());
        (_a = roomVideoUsers.get(room)) === null || _a === void 0 ? void 0 : _a.add(peerId);
        const count = ((_b = roomVideoUsers.get(room)) === null || _b === void 0 ? void 0 : _b.size) || 1;
        console.log(`📹 Video room ${room} now has ${count} users`);
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
        // Also leave video rooms
        const publicVideoRoom = `${room}_video_public`;
        socket.leave(publicVideoRoom);
        // Leave any private video rooms
        const userStatus = userPrivateStatus.get(userId);
        if ((userStatus === null || userStatus === void 0 ? void 0 : userStatus.inPrivate) && userStatus.areaId) {
            const privateVideoRoom = `${room}_video_private_${userStatus.areaId}`;
            socket.leave(privateVideoRoom);
        }
        const videoUsers = roomVideoUsers.get(room);
        if (videoUsers && peerId) {
            videoUsers.delete(peerId);
            const count = videoUsers.size;
            console.log(`📹 Video user ${peerId} left room ${room}, ${count} users remaining`);
            io.to(room).emit("room:userCount", { count });
            socket.to(room).emit("user:left", { peerId });
            socket.to(publicVideoRoom).emit("user:left", { peerId });
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
    // ---------------------- PRIVATE JOIN ----------------------
    socket.on("private:join", ({ room, playerId, publicRoom, areaId }) => {
        var _a, _b, _c;
        console.log(`🔐 ${playerId} joining private room: ${room} (area ${areaId})`);
        socket.leave(publicRoom);
        socket.join(room);
        // Update user's private status
        const userStatus = userPrivateStatus.get(userId) || { inPrivate: false };
        userStatus.inPrivate = true;
        userStatus.areaId = areaId;
        userStatus.publicRoom = publicRoom;
        userPrivateStatus.set(userId, userStatus);
        if (!privateRoomUsers.has(room))
            privateRoomUsers.set(room, new Set());
        (_a = privateRoomUsers.get(room)) === null || _a === void 0 ? void 0 : _a.add(playerId);
        if (!roomUsers.has(room))
            roomUsers.set(room, new Set());
        (_b = roomUsers.get(room)) === null || _b === void 0 ? void 0 : _b.add(playerId);
        socket.to(room).emit("private:userJoined", {
            peerId: playerId,
            areaId,
            type: "private"
        });
        const privateChatUsers = Array.from(roomUsers.get(room) || []).filter(u => u !== playerId);
        socket.emit("private:existingUsers", { users: privateChatUsers, areaId });
        const privateCount = ((_c = roomUsers.get(room)) === null || _c === void 0 ? void 0 : _c.size) || 1;
        io.to(room).emit("private:userCount", { count: privateCount, areaId });
        // Handle video connection transition to private area
        const publicVideoRoom = `${publicRoom}_video_public`;
        const privateVideoRoom = `${publicRoom}_video_private_${areaId}`;
        // Leave public video room
        socket.leave(publicVideoRoom);
        socket.join(privateVideoRoom);
        // Send encryption key to user
        const encryptionKey = getOrCreatePrivateKey(`${publicRoom}_private_${areaId}`);
        socket.emit("private:encryption-key", { key: encryptionKey });
        console.log(`🔐 ${playerId} joined encrypted private video room: ${privateVideoRoom}`);
        // Notify other users in private area about new video participant
        socket.to(privateVideoRoom).emit("private:video-user-joined", {
            peerId: playerId,
            areaId: areaId,
            encrypted: true
        });
        // Note: Existing private peer IDs will be sent when the user registers their private peer
        // FORCE all public users to remove this user's video stream
        socket.to(publicVideoRoom).emit("user:left", { peerId: playerId });
        socket.to(publicVideoRoom).emit("public:video-user-left", {
            peerId: playerId,
            reason: "entered_private_area"
        });
        console.log(`📵 Notified public users to remove ${playerId}'s video stream`);
        console.log(`🔒 Private room ${room} now has ${privateCount} users`);
    });
    // ---------------------- PRIVATE LEAVE ----------------------
    socket.on("private:leave", ({ room, playerId, publicRoom, areaId }) => {
        console.log(`🚪 ${playerId} leaving private room: ${room}`);
        socket.leave(room);
        // Update user's private status
        const userStatus = userPrivateStatus.get(userId) || { inPrivate: false };
        userStatus.inPrivate = false;
        userStatus.areaId = undefined;
        userPrivateStatus.set(userId, userStatus);
        const privateUsers = roomUsers.get(room);
        const privateRoomUserSet = privateRoomUsers.get(room);
        if (privateUsers) {
            privateUsers.delete(playerId);
            const privateCount = privateUsers.size;
            socket.to(room).emit("private:userLeft", { peerId: playerId });
            io.to(room).emit("private:userCount", { count: privateCount });
            if (privateCount === 0) {
                roomUsers.delete(room);
                privateRoomUsers.delete(room);
                // Clean up encryption key for empty private area
                privateAreaKeys.delete(`${publicRoom}_private_${areaId}`);
                console.log(`🧹 Cleaned up empty private room: ${room}`);
            }
        }
        if (privateRoomUserSet) {
            privateRoomUserSet.delete(playerId);
        }
        socket.join(publicRoom);
        console.log(`🔓 ${playerId} rejoined public room: ${publicRoom}`);
        // Handle video connection transition back to public area
        const privateVideoRoom = `${publicRoom}_video_private_${areaId}`;
        const publicVideoRoom = `${publicRoom}_video_public`;
        // Leave private video room and join public
        socket.leave(privateVideoRoom);
        socket.join(publicVideoRoom);
        console.log(`📹 ${playerId} rejoined public video room: ${publicVideoRoom}`);
        // FORCE all private users to remove this user's video stream
        socket.to(privateVideoRoom).emit("user:left", { peerId: playerId });
        socket.to(privateVideoRoom).emit("private:video-user-left", {
            peerId: playerId,
            reason: "left_private_area"
        });
        console.log(`📵 Notified private users to remove ${playerId}'s video stream`);
        // Notify public area users that this user is now available for video
        socket.to(publicVideoRoom).emit("user:joined", { peerId: playerId });
        socket.to(publicVideoRoom).emit("public:video-user-joined", {
            peerId: playerId,
            reason: "returned_from_private_area"
        });
        console.log(`📹 Notified public users that ${playerId} is available for video`);
        // Get existing public users for this returning user
        const publicUsers = Array.from(roomUsers.get(publicRoom) || [])
            .filter(u => {
            const uStatus = userPrivateStatus.get(u);
            return u !== playerId && (!uStatus || !uStatus.inPrivate);
        });
        socket.emit("room:existing-users", { users: publicUsers });
        socket.emit("private:leave:ack");
    });
    // ---------------------- PRIVATE MESSAGE ----------------------
    socket.on("private:message", ({ room, message, sender, attachment, type }) => {
        if (type === 'attachment' && attachment) {
            console.log(`📎 Private attachment in ${room} from ${sender}: ${attachment.originalName}`);
            socket.to(room).emit("private:message", { sender, attachment, type: "attachment" });
        }
        else {
            console.log(`💬 Private message in ${room} from ${sender}`);
            socket.to(room).emit("private:message", { sender, message, type: "text" });
        }
    });
    // ---------------------- CHAT MESSAGE ----------------------
    socket.on("message", ({ room, message, sender, attachment, type }) => {
        if (type === 'attachment' && attachment) {
            console.log(`📎 Public attachment in ${room} from ${sender}: ${attachment.originalName}`);
            socket.to(room).emit("message", { sender, attachment, type: "attachment" });
        }
        else {
            socket.to(room).emit("message", { sender, message, type: "text" });
        }
    });
    // ---------------------- SCREEN SHARING ----------------------
    socket.on("screen-share:start", ({ room, peerId, isPrivate, areaId }) => {
        console.log(`🖥️ ${peerId} started screen sharing in ${isPrivate ? 'private' : 'public'} area ${areaId || 'N/A'}`);
        console.log(`🖥️ Target room: ${room}`);
        // Notify users in the specific room (already calculated in frontend)
        socket.to(room).emit("screen-share:user-started", {
            peerId,
            isPrivate,
            areaId
        });
    });
    socket.on("screen-share:stop", ({ room, peerId, isPrivate, areaId }) => {
        console.log(`🖥️ ${peerId} stopped screen sharing`);
        console.log(`🖥️ Target room: ${room}`);
        // Notify users in the specific room (already calculated in frontend)
        socket.to(room).emit("screen-share:user-stopped", { peerId });
    });
    // ---------------------- VIDEO AREA MANAGEMENT ----------------------
    socket.on("video:enter-private-area", ({ areaId, peerId }) => {
        console.log(`🔐 Video: ${peerId} entering private area ${areaId}`);
        // This is handled by the private:join event above
    });
    socket.on("video:leave-private-area", ({ peerId }) => {
        console.log(`🔓 Video: ${peerId} leaving private area`);
        // This is handled by the private:leave event above
    });
    socket.on("video:request-public-users", ({ room }) => {
        console.log(`📹 Video: Requesting public users for room ${room}`);
        // Get users who are NOT in private areas
        const publicUsers = Array.from(roomUsers.get(room) || [])
            .filter(userId => {
            const userStatus = userPrivateStatus.get(userId);
            return !userStatus || !userStatus.inPrivate;
        })
            .filter(userId => userId !== socketToUsername.get(socket.id)); // Exclude the requester
        console.log(`📹 Sending ${publicUsers.length} public users:`, publicUsers);
        socket.emit("video:public-users-response", { users: publicUsers });
    });
    // Handle private peer ID registration
    socket.on("video:register-private-peer", ({ privatePeerId, areaId }) => {
        var _a, _b;
        const username = socketToUsername.get(socket.id);
        if (username) {
            privatePeerIds.set(username, privatePeerId);
            console.log(`🔐 Registered private peer ID for ${username}: ${privatePeerId}`);
            // Notify other users in the same private area
            const privateRoom = `${(_a = userPrivateStatus.get(username)) === null || _a === void 0 ? void 0 : _a.publicRoom}_private_${areaId}`;
            const privateVideoRoom = `${(_b = userPrivateStatus.get(username)) === null || _b === void 0 ? void 0 : _b.publicRoom}_video_private_${areaId}`;
            socket.to(privateVideoRoom).emit("private:video-user-joined", {
                peerId: privatePeerId,
                areaId: areaId,
                encrypted: true
            });
            // Send existing private peer IDs to the new user
            const existingPrivatePeers = Array.from(privateRoomUsers.get(privateRoom) || [])
                .filter(u => u !== username)
                .map(u => privatePeerIds.get(u))
                .filter(id => id); // Filter out undefined values
            socket.emit("private:video-existing-users", {
                users: existingPrivatePeers,
                areaId: areaId,
                encrypted: true
            });
        }
    });
    // ---------------------- DISCONNECT HANDLER ----------------------
    socket.on("disconnecting", () => {
        const username = socketToUsername.get(socket.id);
        console.log(`🔌 User disconnecting: ${username} (${socket.id})`);
        for (const room of socket.rooms) {
            if (room === socket.id)
                continue;
            const users = roomUsers.get(room);
            if (users && username) {
                users.delete(username);
                const count = users.size;
                io.to(room).emit("room:userCount", { count });
                socket.to(room).emit("user:left", { peerId: username });
                console.log(`📹 Removed ${username} from chat in room ${room}`);
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
            // Clean up private status and peer IDs
            const userStatus = userPrivateStatus.get(username);
            if ((userStatus === null || userStatus === void 0 ? void 0 : userStatus.inPrivate) && userStatus.areaId && userStatus.publicRoom) {
                const privateRoom = `${userStatus.publicRoom}_private_${userStatus.areaId}`;
                const privateUsers = privateRoomUsers.get(privateRoom);
                if (privateUsers) {
                    privateUsers.delete(username);
                    if (privateUsers.size === 0) {
                        privateRoomUsers.delete(privateRoom);
                        // Clean up encryption key for empty private area
                        privateAreaKeys.delete(privateRoom);
                    }
                }
            }
            userPrivateStatus.delete(username);
            privatePeerIds.delete(username);
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
