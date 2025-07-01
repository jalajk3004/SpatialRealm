"use client";

import { useEffect, useRef, useState } from "react";
import { Stage, Layer, Image as KonvaImage, Circle } from "react-konva";
import useImage from "use-image";

import { getTilesetForGid, getTilePosition } from "@/lib/tilesetLoader";
import { useParams } from "next/navigation";
import { getViewportOffset } from "@/lib/viewport";
import { socket } from "@/lib/socketclient";
import { useSession } from "next-auth/react";

const TILE_SIZE = 32;
const stageWidth = 800;
const stageHeight = 600;

export const Board = () => {
  const { game } = useParams();
  const roomId = game as string;
  const session = useSession();
  const playerId = session?.data?.user?.email || "guest";
  const playerPosRef = useRef({ x: 100, y: 100 });
  const othersRef = useRef<Record<string, { x: number; y: number }>>({});

  const layerRef = useRef<any>(null);
  const [, forceRender] = useState(0);

  const [mapData, setMapData] = useState<any>(null);
  const [tilesetImages, setTilesetImages] = useState<HTMLImageElement[]>([]);

  // Load map and tileset images
  useEffect(() => {
    const loadMap = async () => {
      const res = await fetch("/maps/level1.json");
      const data = await res.json();
      setMapData(data);

      // Preload tileset images
      const loadedImages = await Promise.all(
        data.tilesets.map(
          (ts: any) =>
            new Promise<HTMLImageElement>((resolve) => {
              const img = new Image();
              img.src = ts.image;
              img.onload = () => resolve(img);
            })
        )
      );

      setTilesetImages(loadedImages);
    };

    loadMap();
  }, []);

  // Emit player movement
  useEffect(() => {
    const handleMove = (e: KeyboardEvent) => {
      const pos = playerPosRef.current;
      let moved = false;
      switch (e.key) {
        case "ArrowUp":
        case "w":
          pos.y -= 5;
          moved = true;
          break;
        case "ArrowDown":
        case "s":
          pos.y += 5;
          moved = true;
          break;
        case "ArrowLeft":
        case "a":
          pos.x -= 5;
          moved = true;
          break;
        case "ArrowRight":
        case "d":
          pos.x += 5;
          moved = true;
          break;
      }
      if (moved) {
        socket.emit("player:move", {
          room: roomId,
          playerId,
          position: { ...pos },
        });
      }
    };
    window.addEventListener("keydown", handleMove);
    return () => window.removeEventListener("keydown", handleMove);
  }, [roomId, playerId]);

  // Handle socket
  useEffect(() => {
    socket.emit("room:join", { room: roomId, peerId: playerId });

    socket.on("room:playerStates", (players) => {
      for (const p of players) {
        if (p.id !== playerId) othersRef.current[p.id] = p.position;
      }
    });

    socket.on("player:moved", ({ id, position }) => {
      if (id !== playerId) othersRef.current[id] = position;
    });

    socket.on("player:left", ({ id }) => {
      delete othersRef.current[id];
    });

    return () => {
      socket.off("room:playerStates");
      socket.off("player:moved");
      socket.off("player:left");
    };
  }, [roomId, playerId]);

  // Animation and viewport tracking
  useEffect(() => {
    const render = () => {
      if (!mapData) return;

      const { offsetX, offsetY } = getViewportOffset({
        playerPos: playerPosRef.current,
        stageWidth,
        stageHeight,
        mapWidth: mapData.width * TILE_SIZE,
        mapHeight: mapData.height * TILE_SIZE,
      });

      if (layerRef.current) {
        layerRef.current.offsetX(offsetX);
        layerRef.current.offsetY(offsetY);
        layerRef.current.batchDraw();
      }

      forceRender((r) => r + 1);
      requestAnimationFrame(render);
    };
    requestAnimationFrame(render);
  }, [mapData]);

  if (!mapData) return <div>Loading map...</div>;

  const renderMap = () => {
    const layer = mapData.layers[0];
    const tiles = layer.data;
    const tilesX = mapData.width;

    return tiles.map((gid: number, i: number) => {
      if (gid === 0) return null;

      const tileset = getTilesetForGid(gid, mapData.tilesets);
      if (!tileset) return null;

      const tileImage = tilesetImages[mapData.tilesets.indexOf(tileset)];
      if (!tileImage) return null;

      const { x: sx, y: sy, width, height } = getTilePosition(gid, tileset);
      const dx = (i % tilesX) * TILE_SIZE;
      const dy = Math.floor(i / tilesX) * TILE_SIZE;

      return (
        <KonvaImage
          key={i}
          image={tileImage}
          x={dx}
          y={dy}
          width={TILE_SIZE}
          height={TILE_SIZE}
          crop={{ x: sx, y: sy, width, height }}
        />
      );
    });
  };

  return (
    <div className="fixed left-4 bottom-4 w-[calc(100vw-320px-48px)] top-[calc(25vh+32px)] bg-white/90 rounded-xl shadow-2xl flex flex-col overflow-hidden border border-gray-200 backdrop-blur-md">
      <Stage width={stageWidth} height={stageHeight}>
        <Layer ref={layerRef}>
          {renderMap()}
          <Circle
            x={playerPosRef.current.x}
            y={playerPosRef.current.y}
            radius={10}
            fill="blue"
          />
          {Object.entries(othersRef.current).map(([id, pos]) => (
            <Circle key={id} x={pos.x} y={pos.y} radius={10} fill="red" />
          ))}
        </Layer>
      </Stage>
    </div>
  );
};
