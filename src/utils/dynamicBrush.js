import { fabric } from 'fabric';

/**
 * Velocity-based Calligraphy Brush
 * Creates a "filled shape" path instead of a stroke.
 */
export const createDynamicBrush = (canvas) => {
  // 1. Force attach canvas immediately
  const brush = new fabric.BaseBrush(canvas);
  brush.canvas = canvas;

  brush.points = [];
  brush.width = 10;
  brush.color = '#000000';
  brush.lastTime = 0;

  // Configuration
  const MIN_WIDTH_RATIO = 0.2; 
  const MAX_VELOCITY = 3;      
  const SMOOTHING = 0.5;       

  brush.onMouseDown = function (pointer) {
    this.points = [];
    this.lastTime = Date.now();
    // Safety check: Ensure freeDrawingBrush exists before accessing properties
    if (this.canvas.freeDrawingBrush) {
        this.width = this.canvas.freeDrawingBrush.width || 10;
        this.color = this.canvas.freeDrawingBrush.color || '#000000';
    } else {
        this.width = 10;
        this.color = '#000000';
    }
    
    this.addPoint(pointer);
  };

  brush.onMouseMove = function (pointer) {
    this.addPoint(pointer);
    this.render();
  };

  brush.onMouseUp = function () {
    const pathData = this.getSVGPath();
    if (!pathData) return;

    // 1. Create the final object
    const path = new fabric.Path(pathData, {
      fill: this.color,
      stroke: null,
      strokeWidth: 0,
      objectCaching: false, 
      perPixelTargetFind: true, // <--- ADD THIS! Precision Mode enabled.
    });

    // 2. Add to main canvas
    this.canvas.add(path);
    this.canvas.fire('path:created', { path: path });

    // 3. Clear the temporary "ghost" layer
    this.canvas.clearContext(this.canvas.contextTop);

    // 4. Reset points
    this.points = [];
  };

  brush.addPoint = function (pointer) {
    const time = Date.now();
    // Use pointer if points is empty
    const lastPoint = this.points.length > 0 ? this.points[this.points.length - 1] : { ...pointer, w: this.width };
    
    const dist = Math.sqrt(
      Math.pow(pointer.x - lastPoint.x, 2) + Math.pow(pointer.y - lastPoint.y, 2)
    );

    const timeDiff = time - this.lastTime;
    const velocity = timeDiff > 0 ? dist / timeDiff : 0;
    
    const velocityFactor = Math.min(velocity / MAX_VELOCITY, 1);
    const targetWidth = this.width * (1 - (velocityFactor * (1 - MIN_WIDTH_RATIO)));

    const smoothedWidth = this.points.length > 0 
      ? lastPoint.w * SMOOTHING + targetWidth * (1 - SMOOTHING)
      : targetWidth;

    this.points.push({ x: pointer.x, y: pointer.y, w: smoothedWidth });
    this.lastTime = time;
  };

  brush.getSVGPath = function () {
    if (this.points.length < 2) return '';

    let leftPts = [];
    let rightPts = [];

    for (let i = 0; i < this.points.length - 1; i++) {
      const p1 = this.points[i];
      const p2 = this.points[i + 1];

      const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      const perp = angle + Math.PI / 2;

      const r = p1.w / 2;
      
      leftPts.push({
        x: p1.x + Math.cos(perp) * r,
        y: p1.y + Math.sin(perp) * r
      });
      
      rightPts.push({
        x: p1.x - Math.cos(perp) * r,
        y: p1.y - Math.sin(perp) * r
      });
    }

    const last = this.points[this.points.length - 1];
    leftPts.push(last);
    rightPts.push(last);

    let d = `M ${leftPts[0].x} ${leftPts[0].y} `;

    for (let i = 1; i < leftPts.length; i++) {
      d += `L ${leftPts[i].x} ${leftPts[i].y} `;
    }

    for (let i = rightPts.length - 1; i >= 0; i--) {
      d += `L ${rightPts[i].x} ${rightPts[i].y} `;
    }

    d += 'Z'; 
    return d;
  };

  brush.render = function () {
    // 2. CRITICAL SAFETY CHECK
    // If contextTop is missing (can happen during dismount/resize), abort render
    if (!this.canvas || !this.canvas.contextTop) return;
    
    const ctx = this.canvas.contextTop;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    
    if (this.points.length > 0) {
      const p = this.points[this.points.length - 1];
      ctx.arc(p.x, p.y, p.w / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  return brush;
};