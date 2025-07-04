
"use client";

import { Chat } from "./_components/chat";
import { Call } from "./_components/call";
import { Board } from "./_components/board";
import { RoomProvider } from "./_components/useRoomContext";

export default function WorkspacePage() {
  return (
    <RoomProvider >
      <div className="flex flex-col items-center justify-center h-screen w-screen bg-gray-100">
        <Call />
        <Board />
        <Chat />
      </div>
    </RoomProvider>
  );
}

// fixed left-4 bottom-4 w-[calc(100vw-320px-48px)] top-[calc(25vh+32px)] bg-white/90 rounded-xl shadow-2xl flex flex-col overflow-hidden border border-gray-200 backdrop-blur-md