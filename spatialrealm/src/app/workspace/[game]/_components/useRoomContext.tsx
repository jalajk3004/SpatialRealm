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
  isInPrivateArea: boolean;
  currentAreaId: number | null;
  encryptionKey: string | null;
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
  const [isInPrivateArea, setIsInPrivateArea] = useState(false);
  const [currentAreaId, setCurrentAreaId] = useState<number | null>(null);
  const [encryptionKey, setEncryptionKey] = useState<string | null>(null);
  const [userAreaStatus, setUserAreaStatus] = useState<Record<string, { inPrivate: boolean; areaId?: number }>>({});

  const peersRef = useRef<{ [id: string]: MediaConnection }>({});
  const peerInstance = useRef<Peer | null>(null);
  const privatePeerInstance = useRef<Peer | null>(null);
  const currentPeerIdRef = useRef<string>("");
  const currentPrivatePeerIdRef = useRef<string>("");
  const localStreamRef = useRef<MediaStream | null>(null);
  const socketHandlersSetup = useRef(false);
  const activePeerIds = useRef<Set<string>>(new Set());
  const peerStreamsRef = useRef<Record<string, MediaStream>>({});
  const peerToUserMap = useRef<Record<string, string>>({});
  const isInitializing = useRef(false);
  
  // Computed filtered streams based on area compatibility
  const filteredStreams = remoteStreams.filter(stream => {
    // Find which peer this stream belongs to
    const streamPeerId = Object.keys(peerStreamsRef.current).find(
      peerId => peerStreamsRef.current[peerId]?.id === stream.id
    );
    
    if (!streamPeerId) return false;
    
    // Get the user ID for this peer
    const streamUserId = peerToUserMap.current[streamPeerId];
    if (!streamUserId) return true; // Show if we don't know the user (fallback)
    
    // Get area status for this user
    const streamUserStatus = userAreaStatus[streamUserId];
    if (!streamUserStatus) return !isInPrivateArea; // If no status, show only in public
    
    // Area compatibility check
    if (isInPrivateArea && currentAreaId) {
      // We're in private area - only show users in the same private area
      return streamUserStatus.inPrivate && streamUserStatus.areaId === currentAreaId;
    } else {
      // We're in public area - only show users who are also in public
      return !streamUserStatus.inPrivate;
    }
  });
  
  console.log(`🔍 Stream filtering: ${remoteStreams.length} total -> ${filteredStreams.length} visible (inPrivate: ${isInPrivateArea}, area: ${currentAreaId})`);
  console.log(`🔍 User area statuses:`, userAreaStatus);
  useEffect(() => {
    if (!roomId || !session.data?.user?.email) {
      if (!roomId) setError("Room ID is required");
      return;
    }

    // Connect socket with authentication
    socket.connect(userId);

    const initializePublicPeer = async (stream: MediaStream) => {
      console.log('🌍 Initializing PUBLIC peer instance');
      
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
          console.error("PUBLIC PeerJS error:", err);
          setError(err.message);
        }
      });

      peer.on("disconnected", () => {
        peer.reconnect();
      });

      peer.on("call", (call) => {
        console.log(`🌍 PUBLIC: Incoming call from ${call.peer}`);
        
        // REJECT if we're in private area
        if (isInPrivateArea) {
          console.log(`🚫 PUBLIC: Rejecting call - currently in private area`);
          call.close();
          return;
        }
        
        if (!call.peer || call.peer === currentPeerIdRef.current || call.peer.includes('private')) {
          console.log(`🚫 PUBLIC: Rejecting call - invalid peer`);
          call.close();
          return;
        }

        activePeerIds.current.add(call.peer);
        call.answer(stream);
        
        call.on("stream", (remoteStream) => {
          console.log(`🌊 PUBLIC: Stream from ${call.peer}`);
          
          // Double check we're still in public area
          if (isInPrivateArea) {
            console.log(`🚫 PUBLIC: Rejecting stream - now in private area`);
            call.close();
            return;
          }
          
          peerStreamsRef.current[call.peer] = remoteStream;
          setRemoteStreams(prev => {
            const filtered = prev.filter(s => s.id !== remoteStream.id);
            return [...filtered, remoteStream];
          });
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
        console.log(`🌍 PUBLIC peer opened with ID: ${id}`);
        currentPeerIdRef.current = id;
        setIsConnected(true);
        socket.emit("room:join", { room: roomId, peerId: id });
      });
    };
    
    const initializePrivatePeer = async (stream: MediaStream, areaId: number) => {
      console.log(`🔐 Initializing PRIVATE peer instance for area ${areaId}`);
      
      const privatePeer = new Peer(`private_${userId}_${areaId}_${Date.now()}`, {
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

      privatePeerInstance.current = privatePeer;

      privatePeer.on("error", (err) => {
        if (!err.message.includes("Could not connect to peer")) {
          console.error("PRIVATE PeerJS error:", err);
        }
      });

      privatePeer.on("call", (call) => {
        console.log(`🔐 PRIVATE: Incoming call from ${call.peer}`);
        
        // REJECT if we're NOT in private area or wrong area
        if (!isInPrivateArea || currentAreaId !== areaId) {
          console.log(`🚫 PRIVATE: Rejecting call - not in correct private area`);
          call.close();
          return;
        }
        
        if (!call.peer || call.peer === currentPrivatePeerIdRef.current || !call.peer.includes('private')) {
          console.log(`🚫 PRIVATE: Rejecting call - invalid private peer`);
          call.close();
          return;
        }

        activePeerIds.current.add(call.peer);
        call.answer(stream);
        
        call.on("stream", (remoteStream) => {
          console.log(`🌊 PRIVATE: Stream from ${call.peer}`);
          
          // Double check we're still in correct private area
          if (!isInPrivateArea || currentAreaId !== areaId) {
            console.log(`🚫 PRIVATE: Rejecting stream - not in correct area`);
            call.close();
            return;
          }
          
          peerStreamsRef.current[call.peer] = remoteStream;
          setRemoteStreams(prev => {
            const filtered = prev.filter(s => s.id !== remoteStream.id);
            return [...filtered, remoteStream];
          });
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

      privatePeer.on("open", (id) => {
        console.log(`🔐 PRIVATE peer opened with ID: ${id}`);
        currentPrivatePeerIdRef.current = id;
        
        // Register this private peer ID with the backend
        socket.emit("video:register-private-peer", {
          privatePeerId: id,
          areaId: areaId
        });
      });
    };

    const initializePeer = async () => {
      if (isInitializing.current) return;
      isInitializing.current = true;
      
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        setLocalStream(stream);
        localStreamRef.current = stream;

        // Initialize public peer first
        await initializePublicPeer(stream);
        
      } catch (err) {
        setError("Media access error");
      } finally {
        isInitializing.current = false;
      }
    };

    const handleExistingUsers = ({ users }: { users: string[] }) => {
      console.log(`📹 Received existing users:`, users, `(inPrivate: ${isInPrivateArea})`);
      
      // Track user area status (existing users are in public area)
      users.forEach(userId => {
        if (userId !== userId) { // Not ourselves
          setUserAreaStatus(prev => ({
            ...prev,
            [userId]: { inPrivate: false }
          }));
          // Map peer ID to user ID
          peerToUserMap.current[userId] = userId;
        }
      });
      
      // Connect to users
      users.forEach((peerId) => {
        if (peerId && peerId !== currentPeerIdRef.current) {
          activePeerIds.current.add(peerId);
          setTimeout(() => makeCall(peerId), 500);
        }
      });
    };
    
    // Handler for when we request public users after leaving private area
    const handlePublicUsersResponse = ({ users }: { users: string[] }) => {
      console.log(`📹 Received public users response:`, users);
      if (!isInPrivateArea) {
        console.log(`📹 Reconnecting to ${users.length} public users after leaving private area`);
        users.forEach((peerId) => {
          if (peerId && peerId !== currentPeerIdRef.current) {
            activePeerIds.current.add(peerId);
            setTimeout(() => makeCall(peerId), 1000);
          }
        });
      }
    };

    const handleUserJoined = ({ peerId }: { peerId: string }) => {
      console.log(`📹 User joined:`, peerId, `(inPrivate: ${isInPrivateArea})`);
      
      // Track user as public (they just joined main room)
      setUserAreaStatus(prev => ({
        ...prev,
        [peerId]: { inPrivate: false }
      }));
      peerToUserMap.current[peerId] = peerId;
      
      // Connect to user
      if (peerId && peerId !== currentPeerIdRef.current) {
        activePeerIds.current.add(peerId);
        setTimeout(() => makeCall(peerId), 1000);
      }
    };

    const handleUserLeft = ({ peerId }: { peerId: string }) => {
      console.log(`🚪 User left:`, peerId);
      
      // Remove user from area tracking
      setUserAreaStatus(prev => {
        const updated = { ...prev };
        delete updated[peerId];
        return updated;
      });
      delete peerToUserMap.current[peerId];
      
      removePeerStream(peerId);
      activePeerIds.current.delete(peerId);
    };
    
    // Private area handlers
    const handlePrivateEncryptionKey = ({ key }: { key: string }) => {
      console.log('🔐 Received encryption key for private area');
      setEncryptionKey(key);
      setIsInPrivateArea(true);
    };
    
    const handlePrivateVideoUserJoined = ({ peerId, areaId, encrypted }: { peerId: string; areaId: number; encrypted: boolean }) => {
      console.log(`🔐 Private video user joined: ${peerId} (area: ${areaId}, encrypted: ${encrypted})`);
      
      // Track user as in private area
      setUserAreaStatus(prev => ({
        ...prev,
        [peerId]: { inPrivate: true, areaId }
      }));
      peerToUserMap.current[peerId] = peerId;
      
      if (peerId && peerId !== currentPeerIdRef.current && isInPrivateArea && currentAreaId === areaId) {
        activePeerIds.current.add(peerId);
        setTimeout(() => makeCall(peerId), 1000);
      }
    };
    
    const handlePrivateVideoUserLeft = ({ peerId, reason }: { peerId: string; reason: string }) => {
      console.log(`🚪 Private video user left: ${peerId} (${reason})`);
      
      // Update user status based on reason
      if (reason === "left_private_area") {
        // User returned to public area
        setUserAreaStatus(prev => ({
          ...prev,
          [peerId]: { inPrivate: false }
        }));
      } else {
        // User completely left
        setUserAreaStatus(prev => {
          const updated = { ...prev };
          delete updated[peerId];
          return updated;
        });
        delete peerToUserMap.current[peerId];
      }
      
      removePeerStream(peerId);
      activePeerIds.current.delete(peerId);
    };
    
    const handlePrivateVideoExistingUsers = ({ users, areaId, encrypted }: { users: string[]; areaId: number; encrypted: boolean }) => {
      console.log(`🔐 Private video existing users in area ${areaId}:`, users);
      console.log(`🔐 Current state - inPrivate: ${isInPrivateArea}, currentAreaId: ${currentAreaId}`);
      
      // Only connect if we're in the same private area
      if (isInPrivateArea && currentAreaId === areaId) {
        console.log(`🔐 Connecting to ${users.length} users in private area ${areaId}`);
        users.forEach((peerId) => {
          if (peerId && peerId !== currentPeerIdRef.current) {
            activePeerIds.current.add(peerId);
            setTimeout(() => makeCall(peerId), 500);
          }
        });
      } else {
        console.log(`🔐 Ignoring private users - not in same area`);
      }
    };
    
    const handlePublicVideoUserJoined = ({ peerId, reason }: { peerId: string; reason?: string }) => {
      console.log(`📹 Public video user joined: ${peerId} ${reason ? `(${reason})` : ''}`);
      
      // Track user as in public area
      setUserAreaStatus(prev => ({
        ...prev,
        [peerId]: { inPrivate: false }
      }));
      peerToUserMap.current[peerId] = peerId;
      
      if (peerId && peerId !== currentPeerIdRef.current && !isInPrivateArea) {
        activePeerIds.current.add(peerId);
        setTimeout(() => makeCall(peerId), 1000);
      }
    };
    
    const handlePublicVideoUserLeft = ({ peerId, reason }: { peerId: string; reason: string }) => {
      console.log(`📹 Public video user left: ${peerId} (${reason})`);
      
      // Update user status based on reason
      if (reason === "entered_private_area") {
        // User entered private area - we don't know which area yet
        setUserAreaStatus(prev => ({
          ...prev,
          [peerId]: { inPrivate: true }
        }));
      } else {
        // User completely left
        setUserAreaStatus(prev => {
          const updated = { ...prev };
          delete updated[peerId];
          return updated;
        });
        delete peerToUserMap.current[peerId];
      }
      
      removePeerStream(peerId);
      activePeerIds.current.delete(peerId);
    };
    
    // Board events for private area state management
    const handlePrivateAreaEntered = async ({ areaId }: { areaId: number }) => {
      console.log(`🔐 ====== ENTERING PRIVATE AREA: ${areaId} ======`);
      
      // IMMEDIATELY SET STATE
      setIsInPrivateArea(true);
      setCurrentAreaId(areaId);
      
      // Update our own area status
      setUserAreaStatus(prev => ({
        ...prev,
        [userId]: { inPrivate: true, areaId }
      }));
      
      // DESTROY ALL PUBLIC CONNECTIONS
      console.log('💥 Destroying ALL public connections');
      Object.keys(peersRef.current).forEach(peerId => {
        try {
          peersRef.current[peerId]?.close();
          delete peersRef.current[peerId];
        } catch (e) {
          console.log('Error closing connection:', e);
        }
      });
      
      // Clear all streams
      setRemoteStreams([]);
      activePeerIds.current.clear();
      peerStreamsRef.current = {};
      
      // DESTROY PUBLIC PEER INSTANCE
      if (peerInstance.current && !peerInstance.current.destroyed) {
        console.log('💥 Destroying public peer instance');
        peerInstance.current.destroy();
        peerInstance.current = null;
      }
      
      // CREATE PRIVATE PEER INSTANCE
      if (localStreamRef.current) {
        console.log('🔐 Creating private peer instance');
        await initializePrivatePeer(localStreamRef.current, areaId);
      }
      
      console.log('💫 PRIVATE MODE ACTIVATED');
    };
    
    const handlePrivateAreaLeft = async () => {
      console.log('🔓 ====== LEAVING PRIVATE AREA ======');
      
      // IMMEDIATELY SET STATE
      setIsInPrivateArea(false);
      const oldAreaId = currentAreaId;
      setCurrentAreaId(null);
      setEncryptionKey(null);
      
      // Update our own area status
      setUserAreaStatus(prev => ({
        ...prev,
        [userId]: { inPrivate: false }
      }));
      
      // DESTROY ALL PRIVATE CONNECTIONS
      console.log('💥 Destroying ALL private connections');
      Object.keys(peersRef.current).forEach(peerId => {
        try {
          peersRef.current[peerId]?.close();
          delete peersRef.current[peerId];
        } catch (e) {
          console.log('Error closing private connection:', e);
        }
      });
      
      // Clear all streams
      setRemoteStreams([]);
      activePeerIds.current.clear();
      peerStreamsRef.current = {};
      
      // DESTROY PRIVATE PEER INSTANCE
      if (privatePeerInstance.current && !privatePeerInstance.current.destroyed) {
        console.log('💥 Destroying private peer instance');
        privatePeerInstance.current.destroy();
        privatePeerInstance.current = null;
        currentPrivatePeerIdRef.current = "";
      }
      
      // RECREATE PUBLIC PEER INSTANCE
      if (localStreamRef.current) {
        console.log('🌍 Recreating public peer instance');
        await initializePublicPeer(localStreamRef.current);
        
        // Wait for peer to be ready then request users
        setTimeout(() => {
          console.log('🔄 Requesting fresh public user list');
          socket.emit('video:request-public-users', { room: roomId });
        }, 1000);
      }
      
      console.log('💫 PUBLIC MODE ACTIVATED');
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
      
      // Private area video events
      socket.on("private:encryption-key", handlePrivateEncryptionKey);
      socket.on("private:video-user-joined", handlePrivateVideoUserJoined);
      socket.on("private:video-user-left", handlePrivateVideoUserLeft);
      socket.on("private:video-existing-users", handlePrivateVideoExistingUsers);
      
      // Public area video events
      socket.on("public:video-user-joined", handlePublicVideoUserJoined);
      socket.on("public:video-user-left", handlePublicVideoUserLeft);
      
      // Board events for private area management
      socket.on("board:private-area-entered", handlePrivateAreaEntered);
      socket.on("board:private-area-left", handlePrivateAreaLeft);
      
      // Video area management events
      socket.on("video:public-users-response", handlePublicUsersResponse);

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
    
    // Aggressive cleanup interval to ensure area isolation
    const cleanupInterval = setInterval(() => {
      performAreaCleanup();
    }, 2000);

    initializePeer();

    return () => {
      // Cleanup function
      window.removeEventListener("beforeunload", handleBeforeUnload);
      clearInterval(heartbeatInterval);
      clearInterval(cleanupInterval);

      // Clean up socket handlers
      socket.off("room:existing-users", handleExistingUsers);
      socket.off("user:joined", handleUserJoined);
      socket.off("user:left", handleUserLeft);
      socket.off("user:force-disconnect");
      socket.off("private:encryption-key", handlePrivateEncryptionKey);
      socket.off("private:video-user-joined", handlePrivateVideoUserJoined);
      socket.off("private:video-user-left", handlePrivateVideoUserLeft);
      socket.off("private:video-existing-users", handlePrivateVideoExistingUsers);
      socket.off("public:video-user-joined", handlePublicVideoUserJoined);
      socket.off("public:video-user-left", handlePublicVideoUserLeft);
      socket.off("board:private-area-entered", handlePrivateAreaEntered);
      socket.off("board:private-area-left", handlePrivateAreaLeft);
      socket.off("video:public-users-response", handlePublicUsersResponse);
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
    console.log(`📞 Attempting call to ${targetPeerId} (inPrivate: ${isInPrivateArea}, area: ${currentAreaId})`);
    
    if (!localStreamRef.current) {
      console.log(`🚫 Call blocked - no local stream`);
      return;
    }

    // Choose the appropriate peer instance based on current area
    const activePeer = isInPrivateArea ? privatePeerInstance.current : peerInstance.current;
    const activePeerId = isInPrivateArea ? currentPrivatePeerIdRef.current : currentPeerIdRef.current;
    
    if (!activePeer || targetPeerId === activePeerId) {
      console.log(`🚫 Call blocked - no active peer or self-call`);
      return;
    }

    if (peersRef.current[targetPeerId]) {
      console.log(`🚫 Call blocked - already connected to ${targetPeerId}`);
      return;
    }
    
    // Area validation for target peer
    if (isInPrivateArea && !targetPeerId.includes('private')) {
      console.log(`🚫 Call blocked - trying to call public user from private area`);
      return;
    }
    
    if (!isInPrivateArea && targetPeerId.includes('private')) {
      console.log(`🚫 Call blocked - trying to call private user from public area`);
      return;
    }

    const call = activePeer.call(targetPeerId, localStreamRef.current);
    if (!call) {
      console.log(`🚫 Call failed - no call object created`);
      return;
    }

    console.log(`📞 ${isInPrivateArea ? 'PRIVATE' : 'PUBLIC'} call initiated to ${targetPeerId}`);
    
    // Add to active peers
    activePeerIds.current.add(targetPeerId);

    const timeout = setTimeout(() => {
      console.log(`⏰ Call timeout to ${targetPeerId}`);
      call.close();
      delete peersRef.current[targetPeerId];
      activePeerIds.current.delete(targetPeerId);
    }, 10000);

    call.on("stream", (remoteStream) => {
      console.log(`🌊 ${isInPrivateArea ? 'PRIVATE' : 'PUBLIC'} stream from ${targetPeerId}`);
      clearTimeout(timeout);
      
      peerStreamsRef.current[targetPeerId] = remoteStream;
      setRemoteStreams(prev => {
        const filtered = prev.filter(s => s.id !== remoteStream.id);
        return [...filtered, remoteStream];
      });
      
      console.log(`✅ Stream added from ${targetPeerId}`);
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

    if (peersRef.current[peerId]) {
      try {
        peersRef.current[peerId].close();
      } catch (e) {
        console.log('Error closing peer connection:', e);
      }
      delete peersRef.current[peerId];
    }

    if (peerStreamsRef.current[peerId]) {
      const streamToRemove = peerStreamsRef.current[peerId];
      delete peerStreamsRef.current[peerId];

      setRemoteStreams((prev) => {
        const filtered = prev.filter((s) => s.id !== streamToRemove.id);
        console.log(`🧹 Stream list updated: ${prev.length} -> ${filtered.length}`);
        return filtered;
      });
    }
    
    activePeerIds.current.delete(peerId);
  };
  
  // Periodic cleanup function to ensure streams are properly isolated
  const performAreaCleanup = () => {
    console.log(`🧹 Performing area cleanup (inPrivate: ${isInPrivateArea}, area: ${currentAreaId})`);
    
    // Force clear all streams when in wrong area context
    const currentStreams = remoteStreams.length;
    if (currentStreams > 0) {
      console.log(`🧹 Found ${currentStreams} streams during cleanup`);
      
      // Nuclear option: clear everything and let it rebuild
      Object.keys(peersRef.current).forEach(peerId => {
        console.log(`🧹 Cleanup: Removing connection to ${peerId}`);
        removePeerStream(peerId);
      });
      
      // Force empty state
      setRemoteStreams([]);
    }
  };

  const contextValue: RoomContextType = {
    socket,
    localStream,
    remoteStreams: filteredStreams, // Use filtered streams instead of all streams
    peerId: currentPeerIdRef.current,
    roomId: roomId || "",
    isConnected,
    error,
    isInPrivateArea,
    currentAreaId,
    encryptionKey,
  };

  return (
    <RoomContext.Provider value={contextValue}>
      {children}
    </RoomContext.Provider>
  );
};