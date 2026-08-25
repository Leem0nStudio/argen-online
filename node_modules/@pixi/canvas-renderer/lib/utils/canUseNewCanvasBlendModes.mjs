import { settings } from "@pixi/core";
let canUseNewCanvasBlendModesValue;
function createColoredCanvas(color) {
  const canvas = settings.ADAPTER.createCanvas(6, 1), context = canvas.getContext("2d");
  return context.fillStyle = color, context.fillRect(0, 0, 6, 1), canvas;
}
function canUseNewCanvasBlendModes() {
  if (typeof document > "u")
    return !1;
  if (canUseNewCanvasBlendModesValue !== void 0)
    return canUseNewCanvasBlendModesValue;
  const magenta = createColoredCanvas("#ff00ff"), yellow = createColoredCanvas("#ffff00"), context = settings.ADAPTER.createCanvas(6, 1).getContext("2d");
  context.globalCompositeOperation = "multiply", context.drawImage(magenta, 0, 0), context.drawImage(yellow, 2, 0);
  const imageData = context.getImageData(2, 0, 1, 1);
  if (!imageData)
    canUseNewCanvasBlendModesValue = !1;
  else {
    const data = imageData.data;
    canUseNewCanvasBlendModesValue = data[0] === 255 && data[1] === 0 && data[2] === 0;
  }
  return canUseNewCanvasBlendModesValue;
}
export {
  canUseNewCanvasBlendModes
};
//# sourceMappingURL=canUseNewCanvasBlendModes.mjs.map
