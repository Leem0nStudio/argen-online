import { SHAPES, ExtensionType, extensions } from "@pixi/core";
class CanvasMaskSystem {
  /** @param renderer - A reference to the current renderer */
  constructor(renderer) {
    this._foundShapes = [], this.renderer = renderer;
  }
  /**
   * This method adds it to the current stack of masks.
   * @param maskData - the maskData that will be pushed
   */
  pushMask(maskData) {
    const renderer = this.renderer, maskObject = maskData.maskObject || maskData;
    renderer.canvasContext.activeContext.save();
    const foundShapes = this._foundShapes;
    if (this.recursiveFindShapes(maskObject, foundShapes), foundShapes.length > 0) {
      const context = renderer.canvasContext.activeContext;
      context.beginPath();
      for (let i = 0; i < foundShapes.length; i++) {
        const shape = foundShapes[i], transform = shape.transform.worldTransform;
        this.renderer.canvasContext.setContextTransform(transform), this.renderGraphicsShape(shape);
      }
      foundShapes.length = 0, context.clip();
    }
  }
  /**
   * Renders all PIXI.Graphics shapes in a subtree.
   * @param container - container to scan.
   * @param out - where to put found shapes
   */
  recursiveFindShapes(container, out) {
    container.geometry && container.geometry.graphicsData && out.push(container);
    const { children } = container;
    if (children)
      for (let i = 0; i < children.length; i++)
        this.recursiveFindShapes(children[i], out);
  }
  /**
   * Renders a PIXI.Graphics shape.
   * @param graphics - The object to render.
   */
  renderGraphicsShape(graphics) {
    graphics.finishPoly();
    const context = this.renderer.canvasContext.activeContext, graphicsData = graphics.geometry.graphicsData, len = graphicsData.length;
    if (len !== 0)
      for (let i = 0; i < len; i++) {
        const data = graphicsData[i], shape = data.shape;
        if (shape.type === SHAPES.POLY) {
          let points = shape.points;
          const holes = data.holes;
          let outerArea, innerArea, px, py;
          context.moveTo(points[0], points[1]);
          for (let j = 1; j < points.length / 2; j++)
            context.lineTo(points[j * 2], points[j * 2 + 1]);
          if (holes.length > 0) {
            outerArea = 0, px = points[0], py = points[1];
            for (let j = 2; j + 2 < points.length; j += 2)
              outerArea += (points[j] - px) * (points[j + 3] - py) - (points[j + 2] - px) * (points[j + 1] - py);
            for (let k = 0; k < holes.length; k++)
              if (points = holes[k].shape.points, !!points) {
                innerArea = 0, px = points[0], py = points[1];
                for (let j = 2; j + 2 < points.length; j += 2)
                  innerArea += (points[j] - px) * (points[j + 3] - py) - (points[j + 2] - px) * (points[j + 1] - py);
                if (innerArea * outerArea < 0) {
                  context.moveTo(points[0], points[1]);
                  for (let j = 2; j < points.length; j += 2)
                    context.lineTo(points[j], points[j + 1]);
                } else {
                  context.moveTo(points[points.length - 2], points[points.length - 1]);
                  for (let j = points.length - 4; j >= 0; j -= 2)
                    context.lineTo(points[j], points[j + 1]);
                }
                holes[k].shape.closeStroke && context.closePath();
              }
          }
          points[0] === points[points.length - 2] && points[1] === points[points.length - 1] && context.closePath();
        } else if (shape.type === SHAPES.RECT)
          context.rect(shape.x, shape.y, shape.width, shape.height), context.closePath();
        else if (shape.type === SHAPES.CIRC)
          context.arc(shape.x, shape.y, shape.radius, 0, 2 * Math.PI), context.closePath();
        else if (shape.type === SHAPES.ELIP) {
          const w = shape.width * 2, h = shape.height * 2, x = shape.x - w / 2, y = shape.y - h / 2, kappa = 0.5522848, ox = w / 2 * kappa, oy = h / 2 * kappa, xe = x + w, ye = y + h, xm = x + w / 2, ym = y + h / 2;
          context.moveTo(x, ym), context.bezierCurveTo(x, ym - oy, xm - ox, y, xm, y), context.bezierCurveTo(xm + ox, y, xe, ym - oy, xe, ym), context.bezierCurveTo(xe, ym + oy, xm + ox, ye, xm, ye), context.bezierCurveTo(xm - ox, ye, x, ym + oy, x, ym), context.closePath();
        } else if (shape.type === SHAPES.RREC) {
          const rx = shape.x, ry = shape.y, width = shape.width, height = shape.height;
          let radius = shape.radius;
          const maxRadius = Math.min(width, height) / 2;
          radius = radius > maxRadius ? maxRadius : radius, context.moveTo(rx, ry + radius), context.lineTo(rx, ry + height - radius), context.quadraticCurveTo(rx, ry + height, rx + radius, ry + height), context.lineTo(rx + width - radius, ry + height), context.quadraticCurveTo(rx + width, ry + height, rx + width, ry + height - radius), context.lineTo(rx + width, ry + radius), context.quadraticCurveTo(rx + width, ry, rx + width - radius, ry), context.lineTo(rx + radius, ry), context.quadraticCurveTo(rx, ry, rx, ry + radius), context.closePath();
        }
      }
  }
  /**
   * Restores the current drawing context to the state it was before the mask was applied.
   * @param renderer - The renderer context to use.
   */
  popMask(renderer) {
    renderer.canvasContext.activeContext.restore(), renderer.canvasContext.invalidateBlendMode();
  }
  /** Destroys this canvas mask manager. */
  destroy() {
  }
}
CanvasMaskSystem.extension = {
  type: ExtensionType.CanvasRendererSystem,
  name: "mask"
};
extensions.add(CanvasMaskSystem);
export {
  CanvasMaskSystem
};
//# sourceMappingURL=CanvasMaskSystem.mjs.map
