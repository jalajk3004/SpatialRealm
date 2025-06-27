"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const peer_1 = require("peer");
const peerServer = (0, peer_1.PeerServer)({
    port: 9001,
    path: "/peerjs",
    allow_discovery: true,
});
peerServer.on("connection", (client) => {
    console.log("🔌 Peer connected:", client.getId());
});
peerServer.on("disconnect", (client) => {
    console.log("❌ Peer disconnected:", client.getId());
});
