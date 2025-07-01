export function getViewportOffset({
  playerPos,
  stageWidth,
  stageHeight,
  mapWidth,
  mapHeight,
}: {
  playerPos: { x: number; y: number };
  stageWidth: number;
  stageHeight: number;
  mapWidth: number;
  mapHeight: number;
}) {
  let offsetX = playerPos.x - stageWidth / 2;
  let offsetY = playerPos.y - stageHeight / 2;

  offsetX = Math.max(0, Math.min(offsetX, mapWidth - stageWidth));
  offsetY = Math.max(0, Math.min(offsetY, mapHeight - stageHeight));

  return { offsetX, offsetY };
}
