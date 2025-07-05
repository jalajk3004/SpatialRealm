
export interface Tileset {
  firstgid: number;
  image: string;
  imagewidth: number;
  imageheight: number;
  tilewidth: number;
  tileheight: number;
  columns: number;
  tilecount: number;
}

export function getTilesetForGid(gid: number, tilesets: Tileset[]) {
  for (let i = tilesets.length - 1; i >= 0; i--) {
    if (gid >= tilesets[i].firstgid) return tilesets[i];
  }
  return null;
}

export function getTilePosition(gid: number, tileset: Tileset) {
  const id = gid - tileset.firstgid;
  const col = id % tileset.columns;
  const row = Math.floor(id / tileset.columns);

  return {
    x: col * tileset.tilewidth,
    y: row * tileset.tileheight,
    width: tileset.tilewidth,
    height: tileset.tileheight,
  };
}
