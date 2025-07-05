"use client";

import { socket } from "@/lib/socketclient";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";

export const Chat = () => {
  const { data: session } = useSession();
  const params = useParams();
  const publicRoom = params?.game as string;
  const username = session?.user?.name || "Anonymous";

  const [publicMessages, setPublicMessages] = useState<{ sender: string; message: string }[]>([]);
  const [privateMessages, setPrivateMessages] = useState<{ sender: string; message: string }[]>([]);
  const [input, setInput] = useState<string>("");
  const [privateRoomId, setPrivateRoomId] = useState<string | null>(null);
  const [userCount, setUserCount] = useState<number>(1);

  const currentMessages = privateRoomId ? privateMessages : publicMessages;
  const setCurrentMessages = privateRoomId ? setPrivateMessages : setPublicMessages;
  const currentRoom = privateRoomId || publicRoom;

  useEffect(() => {
    if (!publicRoom || !username) return;

    // Join the public chat room
    socket.emit("chat:join", { room: publicRoom, username });

    const handlePublicMessage = (data: { sender: string; message: string }) => {
      if (!privateRoomId) {
        setPublicMessages((prev) => [...prev, data]);
      }
    };

    const handlePrivateMessage = (data: { sender: string; message: string }) => {
      if (privateRoomId) {
        setPrivateMessages((prev) => [...prev, data]);
      }
    };

    const handleUserJoined = ({ username }: { username: string }) => {
      const joinMessage = { sender: "system", message: `${username} joined the room.` };
      if (!privateRoomId) {
        setPublicMessages((prev) => [...prev, joinMessage]);
      }
    };

    const handlePrivateEntry = ({ areaId }: { users: string[]; areaId: string }) => {
      const newPrivateRoom = `${publicRoom}_private_${areaId}`;
      setPrivateRoomId(newPrivateRoom);
    };

    const handlePrivateForceLeave = () => {
      setPrivateRoomId(null);
    };

    const handlePrivateLeaveAck = () => {
      setPrivateRoomId(null);
    };

    socket.on("message", handlePublicMessage);
    socket.on("private:message", handlePrivateMessage);
    socket.on("user:joined", handleUserJoined);
    socket.on("room:userCount", ({ count }) => setUserCount(count));
    socket.on("private:existingUsers", handlePrivateEntry);
    socket.on("private:leave:ack", handlePrivateLeaveAck);
    socket.on("private:forceLeave", handlePrivateForceLeave);

    return () => {
      socket.off("message", handlePublicMessage);
      socket.off("private:message", handlePrivateMessage);
      socket.off("user:joined", handleUserJoined);
      socket.off("room:userCount");
      socket.off("private:existingUsers", handlePrivateEntry);
      socket.off("private:leave:ack", handlePrivateLeaveAck);
      socket.off("private:forceLeave", handlePrivateForceLeave);
    };
  }, [publicRoom, username, privateRoomId]);

  const handleSendMessage = () => {
    if (!input.trim()) return;

    const messageData = {
      room: currentRoom,
      message: input.trim(),
      sender: username,
    };

    if (privateRoomId) {
      socket.emit("private:message", messageData);
      setPrivateMessages((prev) => [...prev, { sender: username, message: input.trim() }]);
    } else {
      socket.emit("message", messageData);
      setPublicMessages((prev) => [...prev, { sender: username, message: input.trim() }]);
    }

    setInput("");
  };

  return (
    <div className="fixed top-4 bottom-4 right-4 w-[320px] bg-white/90 rounded-xl shadow-2xl flex flex-col overflow-hidden border border-gray-200 backdrop-blur-md">
      {/* Header */}
      <div className="p-4 bg-gray-100 border-b font-semibold text-gray-700 flex justify-between items-center">
        <span>{privateRoomId ? "Private Chat" : "Live Chat"}</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 text-sm text-gray-800">
        {currentMessages.map((msg, index) => (
          <div
            key={index}
            className={`flex flex-col ${msg.sender === username ? "items-end" : "items-start"}`}
          >
            {msg.sender !== "system" && (
              <span className="text-xs text-gray-500 mb-1">{msg.sender}</span>
            )}
            <div
              className={`px-3 py-2 rounded-lg max-w-[80%] ${
                msg.sender === username
                  ? "bg-blue-500 text-white"
                  : msg.sender === "system"
                  ? "bg-yellow-100 text-gray-800"
                  : "bg-gray-200 text-gray-900"
              }`}
            >
              {msg.message}
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="p-3 border-t bg-white text-black flex gap-2">
        <input
          type="text"
          placeholder="Send a message..."
          className="flex-1 px-3 py-2 text-sm border rounded-md focus:outline-none"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
        />
        <button
          className="px-4 py-2 text-sm text-white bg-blue-500 rounded-md disabled:opacity-60"
          onClick={handleSendMessage}
          disabled={!input.trim()}
        >
          Send
        </button>
      </div>
    </div>
  );
};
