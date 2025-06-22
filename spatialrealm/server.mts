import { createServer } from "node:http";
import { parse } from "url";
import next from "next";
import { Server } from "socket.io";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "localhost";
const port = parseInt(process.env.PORT || "3000", 10); 
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(server, {
    cors: {
      origin: "*", // or specify frontend URL
    },
  });

  io.on("connection", (socket) => {
    console.log("WebSocket connected:", socket.id);

    socket.on("room:join", ({ room, username }) => {
      socket.join(room);
      console.log(`${username} joined room: ${room}`);
      socket.to(room).emit("user:joined", { username, room });
    });

    socket.on("disconnect", () => {
      console.log("WebSocket disconnected:", socket.id);
    });
  });

  server.listen(port, () => {
    console.log(`✅ Next.js + WebSocket running at http://${hostname}:${port}`);
  });
});
