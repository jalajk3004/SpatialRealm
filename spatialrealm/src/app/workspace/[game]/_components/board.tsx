"use client";

import { useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { socketClient } from "@/lib/socketclient";
import { createKaboom } from "@/lib/kaboom";
import { getViewportOffset } from "@/lib/viewport";
import { Socket } from "socket.io-client";

export const Board = () => {
  const { game } = useParams();
  const roomId = game as string;
  const session = useSession();
  const playerId = session?.data?.user?.email || "guest";

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const playerRef = useRef<any>(null);
  const othersRef = useRef<Record<string, any>>({});
  const playerCharacters = useRef<Record<string, number>>({});
  const currentPrivateArea = useRef<number | null>(null);
  const privateAreas = useRef<Array<{id: number, x: number, y: number, width: number, height: number}>>([]);

  useEffect(() => {
    if (!canvasRef.current || !session.data?.user?.email) return;

    // Connect socket with authentication
    const socket = socketClient.connect(playerId);

    // Private area helper functions
    const getPrivateAreaAtPosition = (x: number, y: number): number | null => {
      for (const area of privateAreas.current) {
        if (x >= area.x && x <= area.x + area.width && 
            y >= area.y && y <= area.y + area.height) {
          return area.id;
        }
      }
      return null;
    };
    
    const handlePrivateAreaChange = (newAreaId: number | null) => {
      const previousArea = currentPrivateArea.current;
      
      if (previousArea !== newAreaId) {
        console.log(`🔒 Private area change: ${previousArea} → ${newAreaId}`);
        
        // Leave previous private room if any
        if (previousArea !== null) {
          const privateRoomId = `${roomId}_private_${previousArea}`;
          socket.emit("private:leave", { room: privateRoomId, playerId, publicRoom: roomId });
          console.log(`🚪 Left private area ${previousArea}`);
        }
        
        // Join new private room if any
        if (newAreaId !== null) {
          const privateRoomId = `${roomId}_private_${newAreaId}`;
          socket.emit("private:join", { room: privateRoomId, playerId, publicRoom: roomId, areaId: newAreaId });
          console.log(`🔐 Joined private area ${newAreaId}`);
        }
        
        currentPrivateArea.current = newAreaId;
      }
    };

    // Create Kaboom instance with proper canvas sizing
    const k = createKaboom(canvasRef.current);
    
    // Set canvas to fill the container
    const resizeCanvas = () => {
      if (canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        canvasRef.current.width = rect.width;
        canvasRef.current.height = rect.height;
      }
    };
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // ✅ Define empty scene to prevent error on unmount
    k.scene("empty", () => {});

    // Load map tileset
    k.loadSprite("map", "/maps/map.png");
    
    // Load player sprites from spritesheet
    // Assuming player sprites are at the bottom of the spritesheet
    // You may need to adjust sliceX, sliceY, and frame numbers based on your actual spritesheet
    k.loadSprite("player", "/maps/spritesheet.png", {
      sliceX: 39, // Assuming 39 columns (624/16 = 39)
      sliceY: 31, // Assuming 31 rows (496/16 = 31)
      anims: {
        // Adjust these frame numbers based on where your player sprites are located
        // These are example frame numbers - you'll need to find the correct ones
        "idle-down": { from: 1100, to: 1100 },    // Player facing down
        "idle-up": { from: 1101, to: 1101 },      // Player facing up  
        "idle-left": { from: 1102, to: 1102 },    // Player facing left
        "idle-right": { from: 1103, to: 1103 },   // Player facing right
        "walk-down": { from: 1100, to: 1103, loop: true, speed: 8 },
        "walk-up": { from: 1101, to: 1104, loop: true, speed: 8 },
        "walk-left": { from: 1102, to: 1105, loop: true, speed: 8 },
        "walk-right": { from: 1103, to: 1106, loop: true, speed: 8 },
      },
    });
    
    k.loadRoot("/maps/");

    // Join the game room (separate from video call)
    socket.emit("player:join", { room: roomId, playerId });

    // Handle existing players in the room
    socket.on("room:playerStates", (players) => {
      console.log("Received existing players:", players);
      for (const p of players) {
        if (p.id !== playerId && !othersRef.current[p.id]) {
          // Create other player with sprite instead of rectangle
          othersRef.current[p.id] = k.add([
            k.sprite("player", { anim: "idle-down" }),
            k.pos(p.position.x, p.position.y),
            k.area({ shape: new k.Rect(k.vec2(0, 3), 16, 16) }),
            k.anchor("center"),
            k.scale(1),
            k.z(5),
            {
              playerId: p.id,
              direction: "down",
            },
            "otherPlayer",
          ]);
          console.log(`Added existing player: ${p.id} at (${p.position.x}, ${p.position.y})`);
        }
      }
    });

    // Handle new player joining
    socket.on("player:joined", ({ id, position }) => {
      console.log(`New player joined: ${id} at (${position.x}, ${position.y})`);
      if (id !== playerId && !othersRef.current[id]) {
        othersRef.current[id] = k.add([
          k.sprite("player", { anim: "idle-down" }),
          k.pos(position.x, position.y),
          k.area({ shape: new k.Rect(k.vec2(0, 3), 16, 16) }),
          k.anchor("center"),
          k.scale(1),
          k.z(5),
          {
            playerId: id,
            direction: "down",
          },
          "otherPlayer",
        ]);
      }
    });

    // Handle player movement
    socket.on("player:moved", ({ id, position }) => {
      if (id !== playerId && othersRef.current[id]) {
        othersRef.current[id].pos = k.vec2(position.x, position.y);
      }
    });

    // Handle player leaving - add more debugging
    const handlePlayerLeft = ({ id }: { id: string }) => {
      console.log(`🚪 Player left event received: ${id}`);
      console.log(`📋 Current players in othersRef:`, Object.keys(othersRef.current));
      
      if (othersRef.current[id]) {
        console.log(`🗑️ Removing player sprite for: ${id}`);
        try {
          k.destroy(othersRef.current[id]);
          delete othersRef.current[id];
          console.log(`✅ Successfully removed player: ${id}`);
          console.log(`📋 Remaining players:`, Object.keys(othersRef.current));
        } catch (error) {
          console.error(`❌ Error removing player ${id}:`, error);
          // Force delete from ref even if destroy failed
          delete othersRef.current[id];
        }
      } else {
        console.log(`⚠️ Player ${id} not found in othersRef for removal`);
        console.log(`📋 Available players:`, Object.keys(othersRef.current));
      }
    };
    
    socket.on("player:left", handlePlayerLeft);

    k.scene("game", async () => {
      // Add the map sprite (no fixed positioning so it moves with camera)
      const mapSprite = k.add([
        k.sprite("map"),
        k.pos(0, 0),
        k.z(0),
        "mapSprite",
      ]);

      const mapData = await fetch("/maps/map.json").then((res) => res.json());
      
      // Load private areas from map
      const privateLayer = mapData.layers.find(
        (layer: any) => layer.name === "Private"
      );
      
      if (privateLayer && privateLayer.objects) {
        privateAreas.current = privateLayer.objects.map((obj: any) => ({
          id: obj.id,
          x: obj.x,
          y: obj.y,
          width: obj.width,
          height: obj.height
        }));
        
        console.log(`🔐 Loaded ${privateAreas.current.length} private areas:`, privateAreas.current);
        
        // Add visual indicators for private areas (optional, semi-transparent blue)
        for (const area of privateAreas.current) {
          k.add([
            k.rect(area.width, area.height),
            k.pos(area.x, area.y),
            k.color(0, 0, 1), // Blue for private areas
            k.opacity(0.2),   // Very transparent
            k.z(1),
            "privateArea",
          ]);
        }
      }
      
      // Load boundaries
      const boundaryLayer = mapData.layers.find(
        (layer: any) => layer.name === "BOUNDARY"
      );

      if (boundaryLayer && boundaryLayer.objects) {
        for (const obj of boundaryLayer.objects) {
          k.add([
            k.rect(obj.width, obj.height),
            k.pos(obj.x, obj.y),
            k.area(),
            k.body({ isStatic: true }),
            k.color(1, 0, 0), // Red boundary
            k.opacity(0.3),   // Semi-transparent so you can see it
            k.z(10),
            "boundary",
          ]);
        }
      }

      const player = k.add([
        k.sprite("player", { anim: "idle-down" }),
        k.pos(150, 150), // Better spawn position in walkable area
        k.area({
          shape: new k.Rect(k.vec2(0, 3), 16, 16),
        }),
        k.body(),
        k.anchor("center"),
        k.scale(1),
        k.z(5),
        {
          speed: 100, // Reduced speed for better control
          direction: "down",
        },
        "player",
      ]);

      playerRef.current = player;
      
      // Focus the canvas to capture keyboard events
      setTimeout(() => {
        if (canvasRef.current) {
          canvasRef.current.focus();
        }
      }, 100);

      // Movement with Arrow Keys
      k.onKeyDown("left", () => {
        player.move(-player.speed, 0);
        player.play("idle-left");
        player.direction = "left";
      });

      k.onKeyDown("right", () => {
        player.move(player.speed, 0);
        player.play("idle-right");
        player.direction = "right";
      });

      k.onKeyDown("up", () => {
        player.move(0, -player.speed);
        player.play("idle-up");
        player.direction = "up";
      });

      k.onKeyDown("down", () => {
        player.move(0, player.speed);
        player.play("idle-down");
        player.direction = "down";
      });

      // Movement with WASD Keys
      k.onKeyDown("a", () => {
        player.move(-player.speed, 0);
        player.play("idle-left");
        player.direction = "left";
      });

      k.onKeyDown("d", () => {
        player.move(player.speed, 0);
        player.play("idle-right");
        player.direction = "right";
      });

      k.onKeyDown("w", () => {
        player.move(0, -player.speed);
        player.play("idle-up");
        player.direction = "up";
      });

      k.onKeyDown("s", () => {
        player.move(0, player.speed);
        player.play("idle-down");
        player.direction = "down";
      });

      // Throttle position updates to avoid spam
      let lastPositionUpdate = 0;
      const UPDATE_INTERVAL = 50; // Update every 50ms (20 FPS)
      
      k.onUpdate(() => {
        // Update camera to follow player
        const mapWidth = 480;  // 30 tiles * 16px
        const mapHeight = 320; // 20 tiles * 16px
        
        // Center camera on player with map boundaries
        let camX = player.pos.x;
        let camY = player.pos.y;
        
        // Constrain camera to map boundaries
        const halfScreenWidth = k.width() / 2;
        const halfScreenHeight = k.height() / 2;
        
        camX = Math.max(halfScreenWidth, Math.min(mapWidth - halfScreenWidth, camX));
        camY = Math.max(halfScreenHeight, Math.min(mapHeight - halfScreenHeight, camY));
        
        k.camPos(camX, camY);
        
        // Check for private area changes
        const currentAreaId = getPrivateAreaAtPosition(player.pos.x, player.pos.y);
        handlePrivateAreaChange(currentAreaId);
        
        // Send position updates
        const now = Date.now();
        if (now - lastPositionUpdate > UPDATE_INTERVAL) {
          socket.emit("player:move", {
            room: roomId,
            playerId,
            position: {
              x: Math.round(player.pos.x),
              y: Math.round(player.pos.y),
            },
          });
          lastPositionUpdate = now;
        }
      });
    });

    k.go("game");

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      
      // Clean up all other players before leaving
      Object.keys(othersRef.current).forEach(playerId => {
        try {
          if (othersRef.current[playerId]) {
            k.destroy(othersRef.current[playerId]);
            delete othersRef.current[playerId];
          }
        } catch (error) {
          console.error(`Error cleaning up player ${playerId}:`, error);
        }
      });
      
      k.go("empty"); // ✅ This now works because the scene is defined
      
      // Remove socket event listeners
      socket.off("room:playerStates");
      socket.off("player:joined");
      socket.off("player:moved");
      socket.off("player:left", handlePlayerLeft);
      
      console.log('🧹 Board cleanup completed');
    };
  }, [roomId, playerId, session.status]);

  return (
    <div className="fixed left-4 bottom-4 w-[calc(100vw-320px-48px)] top-[calc(25vh+32px)] bg-white/90 rounded-xl shadow-2xl flex flex-col overflow-hidden border border-gray-200 backdrop-blur-md">
      <canvas 
        ref={canvasRef} 
        className="w-full h-full" 
        tabIndex={0}
        style={{ outline: 'none' }}
        onClick={() => canvasRef.current?.focus()}
        onMouseDown={() => canvasRef.current?.focus()}
      />
    </div>
  );
};
