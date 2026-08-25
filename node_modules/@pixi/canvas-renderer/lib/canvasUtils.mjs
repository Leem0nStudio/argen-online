import { Color, settings, utils } from "@pixi/core";
import { canUseNewCanvasBlendModes } from "./utils/canUseNewCanvasBlendModes.mjs";
const canvasUtils = {
  canvas: null,
  /**
   * Basically this method just needs a sprite and a color and tints the sprite with the given color.
   * @memberof PIXI.canvasUtils
   * @param {PIXI.Sprite} sprite - the sprite to tint
   * @param sprite.texture
   * @param {number} color - the color to use to tint the sprite with
   * @returns {ICanvas|HTMLImageElement} The tinted canvas
   */
  getTintedCanvas: (sprite, color) => {
    const texture = sprite.texture, stringColor = Color.shared.setValue(color).toHex();
    texture.tintCache = texture.tintCache || {};
    const cachedCanvas = texture.tintCache[stringColor];
    let canvas;
    if (cachedCanvas) {
      if (cachedCanvas.tintId === texture._updateID)
        return texture.tintCache[stringColor];
      canvas = texture.tintCache[stringColor];
    } else
      canvas = settings.ADAPTER.createCanvas();
    if (canvasUtils.tintMethod(texture, color, canvas), canvas.tintId = texture._updateID, canvasUtils.convertTintToImage && canvas.toDataURL !== void 0) {
      const tintImage = new Image();
      tintImage.src = canvas.toDataURL(), texture.tintCache[stringColor] = tintImage;
    } else
      texture.tintCache[stringColor] = canvas;
    return canvas;
  },
  /**
   * Basically this method just needs a sprite and a color and tints the sprite with the given color.
   * @memberof PIXI.canvasUtils
   * @param {PIXI.Texture} texture - the sprite to tint
   * @param {number} color - the color to use to tint the sprite with
   * @returns {CanvasPattern} The tinted canvas
   */
  getTintedPattern: (texture, color) => {
    const stringColor = Color.shared.setValue(color).toHex();
    texture.patternCache = texture.patternCache || {};
    let pattern = texture.patternCache[stringColor];
    return pattern?.tintId === texture._updateID || (canvasUtils.canvas || (canvasUtils.canvas = settings.ADAPTER.createCanvas()), canvasUtils.tintMethod(texture, color, canvasUtils.canvas), pattern = canvasUtils.canvas.getContext("2d").createPattern(canvasUtils.canvas, "repeat"), pattern.tintId = texture._updateID, texture.patternCache[stringColor] = pattern), pattern;
  },
  /**
   * Tint a texture using the 'multiply' operation.
   * @memberof PIXI.canvasUtils
   * @param {PIXI.Texture} texture - the texture to tint
   * @param {number} color - the color to use to tint the sprite with
   * @param {PIXI.ICanvas} canvas - the current canvas
   */
  tintWithMultiply: (texture, color, canvas) => {
    const context = canvas.getContext("2d"), crop = texture._frame.clone(), resolution = texture.baseTexture.resolution;
    crop.x *= resolution, crop.y *= resolution, crop.width *= resolution, crop.height *= resolution, canvas.width = Math.ceil(crop.width), canvas.height = Math.ceil(crop.height), context.save(), context.fillStyle = Color.shared.setValue(color).toHex(), context.fillRect(0, 0, crop.width, crop.height), context.globalCompositeOperation = "multiply";
    const source = texture.baseTexture.getDrawableSource();
    context.drawImage(
      source,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      crop.width,
      crop.height
    ), context.globalCompositeOperation = "destination-atop", context.drawImage(
      source,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      crop.width,
      crop.height
    ), context.restore();
  },
  /**
   * Tint a texture using the 'overlay' operation.
   * @memberof PIXI.canvasUtils
   * @param {PIXI.Texture} texture - the texture to tint
   * @param {number} color - the color to use to tint the sprite with
   * @param {PIXI.ICanvas} canvas - the current canvas
   */
  tintWithOverlay: (texture, color, canvas) => {
    const context = canvas.getContext("2d"), crop = texture._frame.clone(), resolution = texture.baseTexture.resolution;
    crop.x *= resolution, crop.y *= resolution, crop.width *= resolution, crop.height *= resolution, canvas.width = Math.ceil(crop.width), canvas.height = Math.ceil(crop.height), context.save(), context.globalCompositeOperation = "copy", context.fillStyle = `#${`00000${(color | 0).toString(16)}`.slice(-6)}`, context.fillRect(0, 0, crop.width, crop.height), context.globalCompositeOperation = "destination-atop", context.drawImage(
      texture.baseTexture.getDrawableSource(),
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      crop.width,
      crop.height
    ), context.restore();
  },
  /**
   * Tint a texture pixel per pixel.
   * @memberof PIXI.canvasUtils
   * @param {PIXI.Texture} texture - the texture to tint
   * @param {number} color - the color to use to tint the sprite with
   * @param {PIXI.ICanvas} canvas - the current canvas
   */
  tintWithPerPixel: (texture, color, canvas) => {
    const context = canvas.getContext("2d"), crop = texture._frame.clone(), resolution = texture.baseTexture.resolution;
    crop.x *= resolution, crop.y *= resolution, crop.width *= resolution, crop.height *= resolution, canvas.width = Math.ceil(crop.width), canvas.height = Math.ceil(crop.height), context.save(), context.globalCompositeOperation = "copy", context.drawImage(
      texture.baseTexture.getDrawableSource(),
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      crop.width,
      crop.height
    ), context.restore();
    const [r, g, b] = Color.shared.setValue(color).toArray(), pixelData = context.getImageData(0, 0, crop.width, crop.height), pixels = pixelData.data;
    for (let i = 0; i < pixels.length; i += 4)
      pixels[i + 0] *= r, pixels[i + 1] *= g, pixels[i + 2] *= b;
    context.putImageData(pixelData, 0, 0);
  },
  /**
   * Rounds the specified color according to the canvasUtils.cacheStepsPerColorChannel.
   * @memberof PIXI.canvasUtils
   * @deprecated since 7.3.0
   * @see PIXI.Color.round
   * @param {number} color - the color to round, should be a hex color
   * @returns {number} The rounded color.
   */
  roundColor: (color) => (utils.deprecation("7.3.0", "PIXI.canvasUtils.roundColor is deprecated"), Color.shared.setValue(color).round(canvasUtils.cacheStepsPerColorChannel).toNumber()),
  /**
   * Number of steps which will be used as a cap when rounding colors.
   * @memberof PIXI.canvasUtils
   * @deprecated since 7.3.0
   * @type {number}
   */
  cacheStepsPerColorChannel: 8,
  /**
   * Tint cache boolean flag.
   * @memberof PIXI.canvasUtils
   * @type {boolean}
   */
  convertTintToImage: !1,
  /**
   * Whether or not the Canvas BlendModes are supported, consequently the ability to tint using the multiply method.
   * @memberof PIXI.canvasUtils
   * @type {boolean}
   */
  canUseMultiply: canUseNewCanvasBlendModes(),
  /**
   * The tinting method that will be used.
   * @memberof PIXI.canvasUtils
   * @type {Function}
   */
  tintMethod: null
};
canvasUtils.tintMethod = canvasUtils.canUseMultiply ? canvasUtils.tintWithMultiply : canvasUtils.tintWithPerPixel;
export {
  canvasUtils
};
//# sourceMappingURL=canvasUtils.mjs.map
