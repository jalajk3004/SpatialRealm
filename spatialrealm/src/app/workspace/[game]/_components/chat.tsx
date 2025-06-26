
"use client";

import { socket } from "@/lib/socketclient";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";

export const Chat = () => {
  const { data: session } = useSession();
  const params = useParams();
  console.log("params:", params);
  const room = params?.id as string;
  const username = session?.user?.name || "Anonymous";

  const [messages, setMessages] = useState<{ sender: string; message: string }[]>([]);
  const [input, setInput] = useState<string>("");
  const [userCount, setUserCount] = useState<number>(1);

  useEffect(() => {
    if (!room || !username) return;

    socket.emit("room:join", { room, username });

    socket.on("message", (data) => setMessages((prev) => [...prev, data]));
    socket.on("user:joined", ({ username }) => {
  if (username !== "Anonymous") {
    setMessages((prev) => [
      ...prev,
      { sender: "system", message: `${username} joined the room.` },
    ]);
  }
});
    socket.on("room:userCount", ({ count }) => setUserCount(count));

    return () => {
      socket.off("message");
      socket.off("user:joined");
      socket.off("room:userCount");
    };
  }, [room, username]);

  const handleSendMessage = () => {
    if (input.trim()) {
      socket.emit("message", { room, message: input.trim(), sender: username });
      setMessages((prev) => [...prev, { sender: username, message: input.trim() }]);
      setInput("");
    }
  };

  return (
    <div className="fixed bottom-4 right-4 w-[320px] h-[500px] bg-white/90 rounded-xl shadow-2xl flex flex-col overflow-hidden border border-gray-200 backdrop-blur-md">
    {/* Header */}
    <div className="p-4 bg-gray-100 border-b font-semibold text-gray-700 flex justify-between items-center">
      <span>Live Chat</span>
      <span className="text-xs text-gray-500">{userCount} online</span>
    </div>

    {/* Scrollable messages */}
    <div className="flex-1 overflow-y-auto p-4 space-y-3 text-sm text-gray-800">
      {messages.map((msg, index) => (
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
