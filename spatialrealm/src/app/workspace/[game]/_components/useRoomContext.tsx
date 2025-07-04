"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from "react";
import Peer, { MediaConnection } from "peerjs";
import { socket } from "@/lib/socketclient";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";

interface RoomContextType {
  socket: typeof socket;
  localStream: MediaStream | null;
  remoteStreams: MediaStream[];
  peerId: string;
  roomId: string;
  isConnected: boolean;
  error: string | null;
}

const RoomContext = createContext<RoomContextType | undefined>(undefined);

export const useRoom = (): RoomContextType => {
  const context = useContext(RoomContext);
  if (!context) {
    throw new Error("❌ useRoom must be used inside a <RoomProvider />");
  }
  return context;
};

export const RoomProvider = ({ children }: { children: ReactNode }) => {
  const params = useParams();
  const roomId = params?.game as string;
  const session = useSession();
  const userId = session.data?.user?.email || "guest";

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<MediaStream[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const peersRef = useRef<{ [id: string]: MediaConnection }>({});
  const peerInstance = useRef<Peer | null>(null);
  const currentPeerIdRef = useRef<string>("");
  const localStreamRef = useRef<MediaStream | null>(null);
  const socketHandlersSetup = useRef(false);
  const activePeerIds = useRef<Set<string>>(new Set());
  const peerStreamsRef = useRef<Record<string, MediaStream>>({});
  useEffect(() => {
    if (!roomId || !session.data?.user?.email) {
      if (!roomId) setError("Room ID is required");
      return;
    }

    // Connect socket with authentication
    socket.connect(userId);

    const initializePeer = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        setLocalStream(stream);
        localStreamRef.current = stream;

        const peer = new Peer({
          host: process.env.NEXT_PUBLIC_PEER_HOST || "localhost",
          port: parseInt(process.env.NEXT_PUBLIC_PEER_PORT || "9001"),
          path: "/peerjs",
          secure: process.env.NODE_ENV === "production",
          debug: 0,
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' },
              { urls: 'stun:stun2.l.google.com:19302' }
            ]
          }
        });

        peerInstance.current = peer;

        peer.on("error", (err) => {
          if (!err.message.includes("Could not connect to peer")) {
            console.error("PeerJS error:", err);
            setError(err.message);
          }
        });

        peer.on("disconnected", () => {
          peer.reconnect();
        });

        peer.on("call", (call) => {
          if (!call.peer || call.peer === currentPeerIdRef.current) return;

          // Add to active peers immediately
          activePeerIds.current.add(call.peer);

          call.answer(stream);
          call.on("stream", (remoteStream) => {
            peerStreamsRef.current[call.peer] = remoteStream;
            setRemoteStreams(prev =>
              prev.some(s => s.id === remoteStream.id) ? prev : [...prev, remoteStream]
            );
          });

          call.on("close", () => {
            removePeerStream(call.peer);
            activePeerIds.current.delete(call.peer);
          });

          call.on("error", () => {
            removePeerStream(call.peer);
            activePeerIds.current.delete(call.peer);
          });

          peersRef.current[call.peer] = call;
        });

        peer.on("open", (id) => {
          currentPeerIdRef.current = id;
          setIsConnected(true);
          socket.emit("room:join", { room: roomId, peerId: id });
        });
      } catch (err) {
        setError("Media access error");
      }
    };

    const handleExistingUsers = ({ users }: { users: string[] }) => {
      users.forEach((peerId) => {
        if (peerId && peerId !== currentPeerIdRef.current) {
          activePeerIds.current.add(peerId);
          makeCall(peerId);
        }
      });
    };

    const handleUserJoined = ({ peerId }: { peerId: string }) => {
      if (peerId && peerId !== currentPeerIdRef.current) {
        activePeerIds.current.add(peerId);
        setTimeout(() => makeCall(peerId), 1000);
      }
    };

    const handleUserLeft = ({ peerId }: { peerId: string }) => {
      removePeerStream(peerId);
      activePeerIds.current.delete(peerId);
    };

    // Handle forced disconnects (page refresh/close)
    const handleBeforeUnload = () => {
      if (currentPeerIdRef.current && roomId) {
        // Send immediate disconnect notification
        socket.emit("user:force-disconnect", {
          room: roomId,
          peerId: currentPeerIdRef.current
        });
      }
    };

    if (!socketHandlersSetup.current) {
      socket.on("room:existing-users", handleExistingUsers);
      socket.on("user:joined", handleUserJoined);
      socket.on("user:left", handleUserLeft);

      // Handle forced disconnects from other users
      socket.on("user:force-disconnect", ({ peerId }: { peerId: string }) => {
        console.log("Force disconnect detected for:", peerId);
        removePeerStream(peerId);
        activePeerIds.current.delete(peerId);
      });

      socketHandlersSetup.current = true;
    }

    window.addEventListener("beforeunload", handleBeforeUnload);

    const heartbeatInterval = setInterval(() => {
      if (currentPeerIdRef.current && roomId) {
        socket.emit("heartbeat", {
          peerId: currentPeerIdRef.current,
          room: roomId
        });
      }
    }, 5000);

    initializePeer();

    return () => {
      // Cleanup function
      window.removeEventListener("beforeunload", handleBeforeUnload);
      clearInterval(heartbeatInterval);

      // Clean up socket handlers
      socket.off("room:existing-users", handleExistingUsers);
      socket.off("user:joined", handleUserJoined);
      socket.off("user:left", handleUserLeft);
      socket.off("user:force-disconnect");
      socketHandlersSetup.current = false;

      // Notify about our own disconnect
      if (currentPeerIdRef.current && roomId) {
        socket.emit("room:leave", {
          room: roomId,
          peerId: currentPeerIdRef.current
        });
      }

      // Close all peer connections
      Object.values(peersRef.current).forEach(call => call.close());
      peersRef.current = {};

      // Stop local stream
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }

      // Destroy peer instance
      if (peerInstance.current && !peerInstance.current.destroyed) {
        peerInstance.current.destroy();
        peerInstance.current = null;
      }

      // Leave room
      if (currentPeerIdRef.current && roomId) {
        socket.emit("room:leave", {
          room: roomId,
          peerId: currentPeerIdRef.current
        });
      }

      setRemoteStreams([]);
      setLocalStream(null);
      setIsConnected(false);
      currentPeerIdRef.current = "";
      activePeerIds.current.clear();
      peerStreamsRef.current = {};
    };
  }, [roomId, session.status]);

  const makeCall = (targetPeerId: string) => {
    if (!localStreamRef.current ||
      !peerInstance.current ||
      targetPeerId === currentPeerIdRef.current) return;

    if (peersRef.current[targetPeerId]) return;

    const call = peerInstance.current.call(targetPeerId, localStreamRef.current);
    if (!call) return;

    // Add to active peers
    activePeerIds.current.add(targetPeerId);

    const timeout = setTimeout(() => {
      call.close();
      delete peersRef.current[targetPeerId];
      activePeerIds.current.delete(targetPeerId);
    }, 10000);

    call.on("stream", (remoteStream) => {
      clearTimeout(timeout);
      peerStreamsRef.current[targetPeerId] = remoteStream;
      setRemoteStreams(prev =>
        prev.some(s => s.id === remoteStream.id) ? prev : [...prev, remoteStream]
      );
    });

    call.on("close", () => {
      clearTimeout(timeout);
      removePeerStream(targetPeerId);
      activePeerIds.current.delete(targetPeerId);
    });

    call.on("error", () => {
      clearTimeout(timeout);
      removePeerStream(targetPeerId);
      activePeerIds.current.delete(targetPeerId);
    });

    peersRef.current[targetPeerId] = call;
  };

  const removePeerStream = (peerId: string) => {
    if (!peerId) return;

    if (peersRef.current[peerId]) {
      peersRef.current[peerId].close();
      delete peersRef.current[peerId];
    }

    if (peerStreamsRef.current[peerId]) {
      const streamToRemove = peerStreamsRef.current[peerId];
      delete peerStreamsRef.current[peerId];

      setRemoteStreams((prev) => prev.filter((s) => s.id !== streamToRemove.id));
    }
  };

  const contextValue: RoomContextType = {
    socket,
    localStream,
    remoteStreams,
    peerId: currentPeerIdRef.current,
    roomId: roomId || "",
    isConnected,
    error,
  };

  return (
    <RoomContext.Provider value={contextValue}>
      {children}
    </RoomContext.Provider>
  );
};