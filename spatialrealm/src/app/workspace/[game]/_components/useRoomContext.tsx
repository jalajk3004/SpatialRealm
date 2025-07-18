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
  // Screen sharing
  isScreenSharing: boolean;
  startScreenShare: () => Promise<void>;
  stopScreenShare: () => void;
  screenShareStreams: Map<string, { stream: MediaStream; peerId: string; isOwn: boolean }>;
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
  
  // Screen sharing state
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenShareStreams, setScreenShareStreams] = useState<Map<string, { stream: MediaStream; peerId: string; isOwn: boolean }>>(new Map());
  const screenShareStreamRef = useRef<MediaStream | null>(null);
  const screenSharePeersRef = useRef<{ [id: string]: MediaConnection }>({});

  const peersRef = useRef<{ [id: string]: MediaConnection }>({});
  const peerInstance = useRef<Peer | null>(null);
  const currentPeerIdRef = useRef<string>("");
  const localStreamRef = useRef<MediaStream | null>(null);
  const socketHandlersSetup = useRef(false);
  const activePeerIds = useRef<Set<string>>(new Set());
  const peerStreamsRef = useRef<Record<string, MediaStream>>({});
  const isInitializing = useRef(false);

  useEffect(() => {
    if (!roomId || !session.data?.user?.email) {
      if (!roomId) setError("Room ID is required");
      return;
    }

    // Only run on client side
    if (typeof window === 'undefined') return;

    // Connect socket
    socket.connect(userId);

    const initializePeer = async () => {
      if (isInitializing.current) return;
      isInitializing.current = true;
      
      try {
        // Get user media
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        setLocalStream(stream);
        localStreamRef.current = stream;

        // Create peer instance with a clean ID
        const cleanUserId = userId.replace(/[^a-zA-Z0-9]/g, '') + '_' + Date.now();
        const peer = new Peer(cleanUserId, {
          host: process.env.NEXT_PUBLIC_PEER_HOST,
          port: parseInt(process.env.NEXT_PUBLIC_PEER_PORT || "443"),
          path: "/peerjs",
          secure: true,
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
          console.error("PeerJS error:", err);
          // Only show critical errors to user, not connection errors
          if (err.type === 'server-error' || err.type === 'socket-error') {
            setError(err.message);
          }
        });

        peer.on("disconnected", () => {
          peer.reconnect();
        });

        peer.on("call", (call) => {
          console.log(`📞 Incoming call from ${call.peer}`);
          
          // Check if this is a screen share call
          const isScreenShare = call.metadata?.type === 'screen-share';
          
          if (!call.peer || call.peer === currentPeerIdRef.current) {
            call.close();
            return;
          }

          activePeerIds.current.add(call.peer);
          
          // Answer with appropriate stream
          if (isScreenShare) {
            call.answer(); // Don't send our stream for screen share
          } else {
            call.answer(stream);
          }
          
          call.on("stream", (remoteStream) => {
            console.log(`🌊 Stream from ${call.peer} (${isScreenShare ? 'screen' : 'video'})`);
            
            if (isScreenShare) {
              // Handle screen share stream
              setScreenShareStreams(prev => {
                const newMap = new Map(prev);
                newMap.set(call.peer, {
                  stream: remoteStream,
                  peerId: call.peer,
                  isOwn: false
                });
                return newMap;
              });
            } else {
              // Handle regular video stream
              peerStreamsRef.current[call.peer] = remoteStream;
              setRemoteStreams(prev => {
                const filtered = prev.filter(s => s.id !== remoteStream.id);
                return [...filtered, remoteStream];
              });
            }
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
          console.log(`🌍 Peer opened with ID: ${id}`);
          currentPeerIdRef.current = id;
          setIsConnected(true);
          socket.emit("room:join", { room: roomId, peerId: id });
        });
        
      } catch (err) {
        console.error("Media access error:", err);
        setError("Media access error");
      } finally {
        isInitializing.current = false;
      }
    };

    const handleExistingUsers = ({ users }: { users: string[] }) => {
      console.log(`📹 Received existing users:`, users);
      
      // Connect to existing users
      users.forEach((peerId) => {
        if (peerId && peerId !== currentPeerIdRef.current) {
          activePeerIds.current.add(peerId);
          setTimeout(() => makeCall(peerId), 500);
        }
      });
    };

    const handleUserJoined = ({ peerId }: { peerId: string }) => {
      console.log(`📹 User joined:`, peerId);
      
      if (peerId && peerId !== currentPeerIdRef.current) {
        activePeerIds.current.add(peerId);
        setTimeout(() => makeCall(peerId), 1000);
      }
    };

    const handleUserLeft = ({ peerId }: { peerId: string }) => {
      console.log(`🚚 User left:`, peerId);
      
      // Remove screen shares from this user
      setScreenShareStreams(prev => {
        const newMap = new Map(prev);
        if (newMap.has(peerId)) {
          newMap.delete(peerId);
        }
        return newMap;
      });
      
      removePeerStream(peerId);
      activePeerIds.current.delete(peerId);
    };

    const handleScreenShareStarted = ({ peerId }: { peerId: string }) => {
      console.log(`🖥️ Screen share started by ${peerId}`);
    };

    const handleScreenShareStopped = ({ peerId }: { peerId: string }) => {
      console.log(`🖥️ Screen share stopped by ${peerId}`);
      
      // Remove screen share from display
      setScreenShareStreams(prev => {
        const newMap = new Map(prev);
        newMap.delete(peerId);
        return newMap;
      });
    };

    // Setup socket handlers
    if (!socketHandlersSetup.current) {
      socket.on("room:existing-users", handleExistingUsers);
      socket.on("user:joined", handleUserJoined);
      socket.on("user:left", handleUserLeft);
      socket.on("screen-share:user-started", handleScreenShareStarted);
      socket.on("screen-share:user-stopped", handleScreenShareStopped);

      socketHandlersSetup.current = true;
    }

    // Initialize peer
    initializePeer();

    // Cleanup function
    return () => {
      // Clean up socket handlers
      socket.off("room:existing-users", handleExistingUsers);
      socket.off("user:joined", handleUserJoined);
      socket.off("user:left", handleUserLeft);
      socket.off("screen-share:user-started", handleScreenShareStarted);
      socket.off("screen-share:user-stopped", handleScreenShareStopped);
      socketHandlersSetup.current = false;

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
    console.log(`📞 Making call to ${targetPeerId}`);
    
    if (!localStreamRef.current || !peerInstance.current) {
      console.log(`🚫 Call blocked - no local stream or peer instance`);
      return;
    }

    if (targetPeerId === currentPeerIdRef.current) {
      console.log(`🚫 Call blocked - self-call`);
      return;
    }

    if (peersRef.current[targetPeerId]) {
      console.log(`🚫 Call blocked - already connected`);
      return;
    }

    // Validate peer ID format
    if (!targetPeerId || typeof targetPeerId !== 'string' || targetPeerId.trim() === '') {
      console.log(`🚫 Call blocked - invalid peer ID: ${targetPeerId}`);
      return;
    }

    const call = peerInstance.current.call(targetPeerId, localStreamRef.current);
    if (!call) {
      console.log(`🚫 Call failed - no call object`);
      return;
    }

    console.log(`📞 Call initiated to ${targetPeerId}`);
    
    activePeerIds.current.add(targetPeerId);

    const timeout = setTimeout(() => {
      console.log(`⏰ Call timeout to ${targetPeerId}`);
      call.close();
      delete peersRef.current[targetPeerId];
      activePeerIds.current.delete(targetPeerId);
    }, 10000);

    call.on("stream", (remoteStream) => {
      console.log(`🌊 Stream from ${targetPeerId}`);
      clearTimeout(timeout);
      
      peerStreamsRef.current[targetPeerId] = remoteStream;
      setRemoteStreams(prev => {
        const filtered = prev.filter(s => s.id !== remoteStream.id);
        return [...filtered, remoteStream];
      });
    });

    call.on("close", () => {
      console.log(`📵 Call closed with ${targetPeerId}`);
      clearTimeout(timeout);
      removePeerStream(targetPeerId);
      activePeerIds.current.delete(targetPeerId);
    });

    call.on("error", (err) => {
      console.log(`❌ Call error with ${targetPeerId}:`, err);
      clearTimeout(timeout);
      removePeerStream(targetPeerId);
      activePeerIds.current.delete(targetPeerId);
    });

    peersRef.current[targetPeerId] = call;
  };

  const removePeerStream = (peerId: string) => {
    if (!peerId) return;
    
    console.log(`🧹 Removing peer stream: ${peerId}`);

    // Close peer connection
    if (peersRef.current[peerId]) {
      try {
        peersRef.current[peerId].close();
      } catch (e) {
        console.log('Error closing peer connection:', e);
      }
      delete peersRef.current[peerId];
    }

    // Remove from streams
    if (peerStreamsRef.current[peerId]) {
      const streamToRemove = peerStreamsRef.current[peerId];
      delete peerStreamsRef.current[peerId];

      setRemoteStreams((prev) => {
        const filtered = prev.filter((s) => s.id !== streamToRemove.id);
        return filtered;
      });
    }
    
    // Remove screen share
    setScreenShareStreams(prev => {
      const newMap = new Map(prev);
      if (newMap.has(peerId)) {
        newMap.delete(peerId);
      }
      return newMap;
    });
    
    // Clean up screen share peer connections
    if (screenSharePeersRef.current[peerId]) {
      try {
        screenSharePeersRef.current[peerId].close();
      } catch (e) {
        console.log('Error closing screen share connection:', e);
      }
      delete screenSharePeersRef.current[peerId];
    }
    
    activePeerIds.current.delete(peerId);
  };

  // Screen sharing functions
  const startScreenShare = async (): Promise<void> => {
    try {
      console.log('🖥️ Starting screen share...');
      
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920, max: 1920 },
          height: { ideal: 1080, max: 1080 },
          frameRate: { ideal: 30, max: 60 }
        },
        audio: true
      });
      
      screenShareStreamRef.current = screenStream;
      setIsScreenSharing(true);
      
      // Add our own screen share to display
      setScreenShareStreams(prev => {
        const newMap = new Map(prev);
        newMap.set(currentPeerIdRef.current, {
          stream: screenStream,
          peerId: currentPeerIdRef.current,
          isOwn: true
        });
        return newMap;
      });
      
      // Notify other users
      socket.emit('screen-share:start', {
        room: roomId,
        peerId: currentPeerIdRef.current
      });
      
      // Handle screen share ending
      screenStream.getVideoTracks()[0].onended = () => {
        console.log('🖥️ Screen share ended by user');
        stopScreenShare();
      };
      
      // Share screen with existing peers
      if (peerInstance.current) {
        Object.keys(peersRef.current).forEach(targetPeerId => {
          console.log(`🖥️ Sharing screen with ${targetPeerId}`);
          const screenCall = peerInstance.current!.call(targetPeerId, screenStream, {
            metadata: { type: 'screen-share' }
          });
          
          if (screenCall) {
            screenSharePeersRef.current[targetPeerId] = screenCall;
            
            screenCall.on('close', () => {
              delete screenSharePeersRef.current[targetPeerId];
            });
            
            screenCall.on('error', (err) => {
              console.error(`Screen share call error with ${targetPeerId}:`, err);
              delete screenSharePeersRef.current[targetPeerId];
            });
          }
        });
      }
      
      console.log('✅ Screen share started successfully');
      
    } catch (error) {
      console.error('❌ Failed to start screen share:', error);
      setError('Failed to start screen sharing. Please check permissions.');
      throw error;
    }
  };
  
  const stopScreenShare = (): void => {
    console.log('🖥️ Stopping screen share...');
    
    if (screenShareStreamRef.current) {
      screenShareStreamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      screenShareStreamRef.current = null;
    }
    
    // Close all screen sharing peer connections
    Object.values(screenSharePeersRef.current).forEach(call => {
      try {
        call.close();
      } catch (e) {
        console.log('Error closing screen share call:', e);
      }
    });
    screenSharePeersRef.current = {};
    
    // Remove our screen share from display
    setScreenShareStreams(prev => {
      const newMap = new Map(prev);
      newMap.delete(currentPeerIdRef.current);
      return newMap;
    });
    
    setIsScreenSharing(false);
    
    // Notify other users
    socket.emit('screen-share:stop', {
      room: roomId,
      peerId: currentPeerIdRef.current
    });
    
    console.log('✅ Screen share stopped');
  };

  const contextValue: RoomContextType = {
    socket,
    localStream,
    remoteStreams,
    peerId: currentPeerIdRef.current,
    roomId: roomId || "",
    isConnected,
    error,
    isScreenSharing,
    startScreenShare,
    stopScreenShare,
    screenShareStreams,
  };

  return (
    <RoomContext.Provider value={contextValue}>
      {children}
    </RoomContext.Provider>
  );
};
