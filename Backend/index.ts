// backend/index.ts
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

const roomUsers = new Map<string, Set<string>>();

io.on("connection", (socket) => {
  console.log("✅ A user connected:", socket.id);

  socket.on("room:join", ({ room, username }) => {
    socket.join(room);
    

    if (username !== "Anonymous") {
    socket.to(room).emit("user:joined", { username });
  }

    if (!roomUsers.has(room)) roomUsers.set(room, new Set());
    roomUsers.get(room)?.add(socket.id);

    

    const count = roomUsers.get(room)?.size || 1;
    io.to(room).emit("room:userCount", { count });
  });

  socket.on("message", ({ room, message, sender }) => {
    
    socket.to(room).emit("message", { sender, message });
  });

  socket.on("disconnecting", () => {
    for (const room of socket.rooms) {
      if (room === socket.id) continue;

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

app.use(express.json());

app.get("/", (_, res) => {
  res.send("Hello from backend!");
});

server.listen(9000, () => {
  console.log("🚀 Server running at http://localhost:9000");
});
