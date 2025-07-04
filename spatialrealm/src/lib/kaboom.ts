import kaboom from "kaboom";

export const createKaboom = (canvas: HTMLCanvasElement) =>
  kaboom({
    canvas,
    width: 800,
    height: 600,
    scale: 2,
    crisp: true,
    background: [0.9, 0.9, 1],
    global: true,
    touchToMouse: true,
  });