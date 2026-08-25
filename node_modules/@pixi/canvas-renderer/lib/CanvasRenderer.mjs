import { utils, SystemManager, RENDERER_TYPE, settings, ExtensionType, extensions } from "@pixi/core";
const { deprecation } = utils, _CanvasRenderer = class _CanvasRenderer2 extends SystemManager {
  /**
   * @param {PIXI.IRendererOptions} [options] - See {@link PIXI.settings.RENDER_OPTIONS} for defaults.
   */
  constructor(options) {
    super(), this.type = RENDERER_TYPE.CANVAS, this.rendererLogId = "Canvas", options = Object.assign({}, settings.RENDER_OPTIONS, options);
    const systemConfig = {
      runners: [
        "init",
        "destroy",
        "contextChange",
        "resolutionChange",
        "reset",
        "update",
        "postrender",
        "prerender",
        "resize"
      ],
      systems: _CanvasRenderer2.__systems,
      priority: [
        "textureGenerator",
        "background",
        "_view",
        "_plugin",
        "startup",
        "mask",
        "canvasContext",
        "objectRenderer"
      ]
    };
    this.setup(systemConfig), "useContextAlpha" in options && (deprecation("7.0.0", "options.useContextAlpha is deprecated, use options.backgroundAlpha instead"), options.backgroundAlpha = options.useContextAlpha === !1 ? 1 : options.backgroundAlpha), this._plugin.rendererPlugins = _CanvasRenderer2.__plugins, this.options = options, this.startup.run(this.options);
  }
  /**
   * Used with autoDetectRenderer, this is always supported for any environment, so return true.
   * @ignore
   */
  static test() {
    return !0;
  }
  /**
   * Useful function that returns a texture of the display object that can then be used to create sprites
   * This can be quite useful if your displayObject is complicated and needs to be reused multiple times.
   * @param displayObject - The displayObject the object will be generated from.
   * @param {IGenerateTextureOptions} options - Generate texture options.
   * @param {PIXI.Rectangle} options.region - The region of the displayObject, that shall be rendered,
   *        if no region is specified, defaults to the local bounds of the displayObject.
   * @param {number} [options.resolution] - If not given, the renderer's resolution is used.
   * @param {PIXI.MSAA_QUALITY} [options.multisample] - If not given, the renderer's multisample is used.
   * @returns A texture of the graphics object.
   */
  generateTexture(displayObject, options) {
    return this.textureGenerator.generateTexture(displayObject, options);
  }
  reset() {
  }
  /**
   * Renders the object to its WebGL view.
   * @param displayObject - The object to be rendered.
   * @param options - Object to use for render options.
   * @param {PIXI.RenderTexture} [options.renderTexture] - The render texture to render to.
   * @param {boolean} [options.clear=true] - Should the canvas be cleared before the new render.
   * @param {PIXI.Matrix} [options.transform] - A transform to apply to the render texture before rendering.
   * @param {boolean} [options.skipUpdateTransform=false] - Should we skip the update transform pass?
   */
  render(displayObject, options) {
    this.objectRenderer.render(displayObject, options);
  }
  /** Clear the canvas of renderer. */
  clear() {
    this.canvasContext.clear();
  }
  /**
   * Removes everything from the renderer and optionally removes the Canvas DOM element.
   * @param {boolean} [removeView=false] - Removes the Canvas element from the DOM.
   */
  destroy(removeView) {
    this.runners.destroy.items.reverse(), this.emitWithCustomOptions(this.runners.destroy, {
      _view: removeView
    }), super.destroy();
  }
  /** Collection of plugins */
  get plugins() {
    return this._plugin.plugins;
  }
  /**
   * Resizes the canvas view to the specified width and height.
   * @param desiredScreenWidth - the desired width of the screen
   * @param desiredScreenHeight - the desired height of the screen
   */
  resize(desiredScreenWidth, desiredScreenHeight) {
    this._view.resizeView(desiredScreenWidth, desiredScreenHeight);
  }
  /**
   * Same as view.width, actual number of pixels in the canvas by horizontal.
   * @member {number}
   * @readonly
   * @default 800
   */
  get width() {
    return this._view.element.width;
  }
  /**
   * Same as view.height, actual number of pixels in the canvas by vertical.
   * @member {number}
   * @readonly
   * @default 600
   */
  get height() {
    return this._view.element.height;
  }
  /** The resolution / device pixel ratio of the renderer. */
  get resolution() {
    return this._view.resolution;
  }
  set resolution(value) {
    this._view.resolution = value, this.runners.resolutionChange.emit(value);
  }
  /** Whether CSS dimensions of canvas view should be resized to screen dimensions automatically. */
  get autoDensity() {
    return this._view.autoDensity;
  }
  /** The canvas element that everything is drawn to.*/
  get view() {
    return this._view.element;
  }
  /**
   * Measurements of the screen. (0, 0, screenWidth, screenHeight).
   * Its safe to use as filterArea or hitArea for the whole stage.
   */
  get screen() {
    return this._view.screen;
  }
  /** the last object rendered by the renderer. Useful for other plugins like interaction managers */
  get lastObjectRendered() {
    return this.objectRenderer.lastObjectRendered;
  }
  /** Flag if we are rendering to the screen vs renderTexture */
  get renderingToScreen() {
    return this.objectRenderer.renderingToScreen;
  }
  /**
   * This sets if the CanvasRenderer will clear the canvas or not before the new render pass.
   * If the scene is NOT transparent PixiJS will use a canvas sized fillRect operation every
   * frame to set the canvas background color. If the scene is transparent PixiJS will use clearRect
   * to clear the canvas every frame. Disable this by setting this to false. For example, if
   * your game has a canvas filling background image you often don't need this set.
   */
  get clearBeforeRender() {
    return this.background.clearBeforeRender;
  }
  // deprecated zone..
  /**
   * Tracks the blend modes useful for this renderer.
   * @deprecated since 7.0.0 use `renderer.canvasContext.blendModes` instead
   */
  get blendModes() {
    return deprecation("7.0.0", "renderer.blendModes has been deprecated, please use renderer.canvasContext.blendModes instead"), this.canvasContext.blendModes;
  }
  /**
   * system that manages canvas masks
   * @deprecated since 7.0.0 use `renderer.canvasContext.mask`
   */
  get maskManager() {
    return deprecation("7.0.0", "renderer.maskManager has been deprecated, please use renderer.mask instead"), this.mask;
  }
  /**
   * Boolean flag controlling canvas refresh.
   * @deprecated since 7.0.0
   */
  get refresh() {
    return deprecation("7.0.0", "renderer.refresh has been deprecated"), !0;
  }
  /**
   * The root canvas 2d context that everything is drawn with.
   * @deprecated since 7.0.0 Use `renderer.canvasContext.rootContext instead
   */
  get rootContext() {
    return deprecation("7.0.0", "renderer.rootContext has been deprecated, please use renderer.canvasContext.rootContext instead"), this.canvasContext.rootContext;
  }
  /**
   * The currently active canvas 2d context (could change with renderTextures)
   * @deprecated since 7.0.0 Use `renderer.canvasContext.activeContext instead
   */
  get context() {
    return deprecation("7.0.0", "renderer.context has been deprecated, please use renderer.canvasContext.activeContext instead"), this.canvasContext.activeContext;
  }
  /**
   * The canvas property used to set the canvas smoothing property.
   * @deprecated since 7.0.0 Use `renderer.canvasContext.smoothProperty` instead.
   */
  get smoothProperty() {
    return deprecation("7.0.0", "renderer.smoothProperty has been deprecated, please use renderer.canvasContext.smoothProperty instead"), this.canvasContext.smoothProperty;
  }
  /**
   * Sets the blend mode of the renderer.
   * @param {number} blendMode - See {@link PIXI.BLEND_MODES} for valid values.
   * @param {boolean} [readyForOuterBlend=false] - Some blendModes are dangerous, they affect outer space of sprite.
   * Pass `true` only if you are ready to use them.
   * @deprecated since 7.0.0 Use `renderer.canvasContext.setBlendMode` instead.
   */
  setBlendMode(blendMode, readyForOuterBlend) {
    deprecation("7.0.0", "renderer.setBlendMode has been deprecated, use renderer.canvasContext.setBlendMode instead"), this.canvasContext.setBlendMode(blendMode, readyForOuterBlend);
  }
  /**
   * Checks if blend mode has changed.
   * @deprecated since 7.0.0 Use `renderer.canvasContext.invalidateBlendMode` instead.
   */
  invalidateBlendMode() {
    deprecation("7.0.0", "renderer.invalidateBlendMode has been deprecated, use renderer.canvasContext.invalidateBlendMode instead"), this.canvasContext.invalidateBlendMode();
  }
  /**
   * Sets matrix of context.
   * called only from render() methods
   * takes care about resolution
   * @param transform - world matrix of current element
   * @param roundPixels - whether to round (tx,ty) coords
   * @param localResolution - If specified, used instead of `renderer.resolution` for local scaling
   * @deprecated since 7.0.0 - Use `renderer.canvasContext.setContextTransform` instead.
   */
  setContextTransform(transform, roundPixels, localResolution) {
    deprecation("7.0.0", "renderer.setContextTransform has been deprecated, use renderer.canvasContext.setContextTransform instead"), this.canvasContext.setContextTransform(transform, roundPixels, localResolution);
  }
  /**
   * The background color to fill if not transparent
   * @deprecated since 7.0.0
   */
  get backgroundColor() {
    return deprecation("7.0.0", "renderer.backgroundColor has been deprecated, use renderer.background.color instead."), this.background.color;
  }
  /**
   * @deprecated since 7.0.0
   * @ignore
   */
  set backgroundColor(value) {
    deprecation("7.0.0", "renderer.backgroundColor has been deprecated, use renderer.background.color instead."), this.background.color = value;
  }
  /**
   * The background color alpha. Setting this to 0 will make the canvas transparent.
   * @member {number}
   * @deprecated since 7.0.0
   */
  get backgroundAlpha() {
    return deprecation("7.0.0", "renderer.backgroundAlpha has been deprecated, use renderer.background.alpha instead."), this.background.alpha;
  }
  /**
   * @deprecated since 7.0.0
   * @ignore
   */
  set backgroundAlpha(value) {
    deprecation("7.0.0", "renderer.backgroundAlpha has been deprecated, use renderer.background.alpha instead."), this.background.alpha = value;
  }
  /**
   * old abstract function not used by canvas renderer
   * @deprecated since 7.0.0
   */
  get preserveDrawingBuffer() {
    return deprecation("7.0.0", "renderer.preserveDrawingBuffer has been deprecated"), !1;
  }
  /**
   * old abstract function not used by canvas renderer
   * @deprecated since 7.0.0
   */
  get useContextAlpha() {
    return deprecation("7.0.0", "renderer.useContextAlpha has been deprecated"), !1;
  }
  /**
   * Collection of installed plugins. These are included by default in PIXI, but can be excluded
   * by creating a custom build. Consult the README for more information about creating custom
   * builds and excluding plugins.
   * @member {object} plugins
   * @readonly
   * @property {PIXI.AccessibilityManager} accessibility Support tabbing interactive elements.
   */
};
_CanvasRenderer.extension = {
  type: ExtensionType.Renderer,
  priority: 0
}, /** @private */
_CanvasRenderer.__plugins = {}, /** @private */
_CanvasRenderer.__systems = {};
let CanvasRenderer = _CanvasRenderer;
extensions.handleByMap(ExtensionType.CanvasRendererPlugin, CanvasRenderer.__plugins);
extensions.handleByMap(ExtensionType.CanvasRendererSystem, CanvasRenderer.__systems);
extensions.add(CanvasRenderer);
export {
  CanvasRenderer
};
//# sourceMappingURL=CanvasRenderer.mjs.map
