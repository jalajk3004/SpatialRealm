
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
