"use strict";
var core = require("@pixi/core"), mapCanvasBlendModesToPixi = require("./utils/mapCanvasBlendModesToPixi.js");
const tempMatrix = new core.Matrix();
class CanvasContextSystem {
  /** @param renderer - A reference to the current renderer */
  constructor(renderer) {
    this.activeResolution = 1, this.smoothProperty = "imageSmoothingEnabled", this.blendModes = mapCanvasBlendModesToPixi.mapCanvasBlendModesToPixi(), this._activeBlendMode = null, this._projTransform = null, this._outerBlend = !1, this.renderer = renderer;
  }
  /** initiates the system */
  init() {
    const alpha = this.renderer.background.alpha < 1;
    if (this.rootContext = this.renderer.view.getContext("2d", { alpha }), this.activeContext = this.rootContext, !this.rootContext.imageSmoothingEnabled) {
      const rc = this.rootContext;
      rc.webkitImageSmoothingEnabled ? this.smoothProperty = "webkitImageSmoothingEnabled" : rc.mozImageSmoothingEnabled ? this.smoothProperty = "mozImageSmoothingEnabled" : rc.oImageSmoothingEnabled ? this.smoothProperty = "oImageSmoothingEnabled" : rc.msImageSmoothingEnabled && (this.smoothProperty = "msImageSmoothingEnabled");
    }
  }
  /**
   * Sets matrix of context.
   * called only from render() methods
   * takes care about resolution
   * @param transform - world matrix of current element
   * @param roundPixels - whether to round (tx,ty) coords
   * @param localResolution - If specified, used instead of `renderer.resolution` for local scaling
   */
  setContextTransform(transform, roundPixels, localResolution) {
    let mat = transform;
    const proj = this._projTransform, contextResolution = this.activeResolution;
    localResolution = localResolution || contextResolution, proj && (mat = tempMatrix, mat.copyFrom(transform), mat.prepend(proj)), roundPixels ? this.activeContext.setTransform(
      mat.a * localResolution,
      mat.b * localResolution,
      mat.c * localResolution,
      mat.d * localResolution,
      mat.tx * contextResolution | 0,
      mat.ty * contextResolution | 0
    ) : this.activeContext.setTransform(
      mat.a * localResolution,
      mat.b * localResolution,
      mat.c * localResolution,
      mat.d * localResolution,
      mat.tx * contextResolution,
      mat.ty * contextResolution
    );
  }
  /**
   * Clear the canvas of renderer.
   * @param {string} [clearColor] - Clear the canvas with this color, except the canvas is transparent.
   * @param {number} [alpha] - Alpha to apply to the background fill color.
   */
  clear(clearColor, alpha) {
    const { activeContext: context, renderer } = this, fillColor = clearColor ? core.Color.shared.setValue(clearColor) : this.renderer.background.backgroundColor;
    context.clearRect(0, 0, renderer.width, renderer.height), clearColor && (context.globalAlpha = alpha ?? this.renderer.background.alpha, context.fillStyle = fillColor.toHex(), context.fillRect(0, 0, renderer.width, renderer.height), context.globalAlpha = 1);
  }
  /**
   * Sets the blend mode of the renderer.
   * @param {number} blendMode - See {@link PIXI.BLEND_MODES} for valid values.
   * @param {boolean} [readyForOuterBlend=false] - Some blendModes are dangerous, they affect outer space of sprite.
   * Pass `true` only if you are ready to use them.
   */
  setBlendMode(blendMode, readyForOuterBlend) {
    const outerBlend = blendMode === core.BLEND_MODES.SRC_IN || blendMode === core.BLEND_MODES.SRC_OUT || blendMode === core.BLEND_MODES.DST_IN || blendMode === core.BLEND_MODES.DST_ATOP;
    !readyForOuterBlend && outerBlend && (blendMode = core.BLEND_MODES.NORMAL), this._activeBlendMode !== blendMode && (this._activeBlendMode = blendMode, this._outerBlend = outerBlend, this.activeContext.globalCompositeOperation = this.blendModes[blendMode]);
  }
  resize() {
    this.smoothProperty && (this.rootContext[this.smoothProperty] = core.BaseTexture.defaultOptions.scaleMode === core.SCALE_MODES.LINEAR);
  }
  /** Checks if blend mode has changed. */
  invalidateBlendMode() {
    this._activeBlendMode = this.blendModes.indexOf(this.activeContext.globalCompositeOperation);
  }
  destroy() {
    this.renderer = null, this.rootContext = null, this.activeContext = null, this.smoothProperty = null;
  }
}
CanvasContextSystem.extension = {
  type: core.ExtensionType.CanvasRendererSystem,
  name: "canvasContext"
};
core.extensions.add(CanvasContextSystem);
exports.CanvasContextSystem = CanvasContextSystem;
//# sourceMappingURL=CanvasContextSystem.js.map
