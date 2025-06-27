import { PeerServer } from "peer";

const peerServer = PeerServer({
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
