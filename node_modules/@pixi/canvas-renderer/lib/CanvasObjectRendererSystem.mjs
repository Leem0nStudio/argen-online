import { utils, CanvasResource, BLEND_MODES, ExtensionType, extensions } from "@pixi/core";
class CanvasObjectRendererSystem {
  /** @param renderer - A reference to the current renderer */
  constructor(renderer) {
    this.renderer = renderer;
  }
  /**
   * Renders the object to its Canvas view.
   * @param displayObject - The object to be rendered.
   * @param options - the options to be passed to the renderer
   */
  render(displayObject, options) {
    const renderer = this.renderer;
    if (!renderer.view)
      return;
    const _context = renderer.canvasContext;
    let renderTexture, clear, transform, skipUpdateTransform;
    options && (renderTexture = options.renderTexture, clear = options.clear, transform = options.transform, skipUpdateTransform = options.skipUpdateTransform), this.renderingToScreen = !renderTexture, renderer.emit("prerender");
    const rootResolution = renderer.resolution;
    renderTexture ? (renderTexture = renderTexture.castToBaseTexture(), renderTexture._canvasRenderTarget || (renderTexture._canvasRenderTarget = new utils.CanvasRenderTarget(
      renderTexture.width,
      renderTexture.height,
      renderTexture.resolution
    ), renderTexture.resource = new CanvasResource(renderTexture._canvasRenderTarget.canvas), renderTexture.valid = !0), _context.activeContext = renderTexture._canvasRenderTarget.context, renderer.canvasContext.activeResolution = renderTexture._canvasRenderTarget.resolution) : (_context.activeContext = _context.rootContext, _context.activeResolution = rootResolution);
    const context2D = _context.activeContext;
    if (_context._projTransform = transform || null, renderTexture || (this.lastObjectRendered = displayObject), !skipUpdateTransform) {
      const cacheParent = displayObject.enableTempParent();
      displayObject.updateTransform(), displayObject.disableTempParent(cacheParent);
    }
    if (context2D.save(), context2D.setTransform(1, 0, 0, 1, 0, 0), context2D.globalAlpha = 1, _context._activeBlendMode = BLEND_MODES.NORMAL, _context._outerBlend = !1, context2D.globalCompositeOperation = _context.blendModes[BLEND_MODES.NORMAL], clear ?? renderer.background.clearBeforeRender)
      if (this.renderingToScreen) {
        context2D.clearRect(0, 0, renderer.width, renderer.height);
        const background = renderer.background;
        background.alpha > 0 && (context2D.globalAlpha = background.backgroundColor.alpha, context2D.fillStyle = background.backgroundColor.toHex(), context2D.fillRect(0, 0, renderer.width, renderer.height), context2D.globalAlpha = 1);
      } else
        renderTexture = renderTexture, renderTexture._canvasRenderTarget.clear(), renderTexture.clear.alpha > 0 && (context2D.globalAlpha = renderTexture.clear.alpha, context2D.fillStyle = renderTexture.clear.toHex(), context2D.fillRect(0, 0, renderTexture.realWidth, renderTexture.realHeight), context2D.globalAlpha = 1);
    const tempContext = _context.activeContext;
    _context.activeContext = context2D, displayObject.renderCanvas(renderer), _context.activeContext = tempContext, context2D.restore(), _context.activeResolution = rootResolution, _context._projTransform = null, renderer.emit("postrender");
  }
  destroy() {
    this.lastObjectRendered = null, this.render = null;
  }
}
CanvasObjectRendererSystem.extension = {
  type: ExtensionType.CanvasRendererSystem,
  name: "objectRenderer"
};
extensions.add(CanvasObjectRendererSystem);
export {
  CanvasObjectRendererSystem
};
//# sourceMappingURL=CanvasObjectRendererSystem.mjs.map
