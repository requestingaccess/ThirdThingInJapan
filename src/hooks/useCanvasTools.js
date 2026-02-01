import { useEffect, useRef } from 'react';
import { fabric } from 'fabric';
import { reflectPoint } from '../utils/geometry';
import { createDynamicBrush } from '../utils/dynamicBrush';

export const useCanvasTools = ({
  fabricRef,
  tool,
  brushSize,
  currentColor,
  symmetry,
  saveHistory,
  lockedRef,
  traceImageObj
}) => {
  
  const activeShapeRef = useRef(null);  // For Shapes & Single Lines
  const shapeStartRef = useRef(null);   // Start coord for drag operations
  
  // -- MULTI-LINE STATE --
  const polylineRef = useRef(null);     // The main polyline object being built
  const rubberBandRef = useRef(null);   // The "ghost" line following the cursor
  
  // -- ERASER STATE --
  const isErasingRef = useRef(false);   // Track if we are currently dragging-to-delete

  // --- HELPER: SYMMETRY GENERATION ---
  const generateSymmetry = (obj) => {
    if (!symmetry || !symmetry.locked || !obj || !fabricRef.current) return;
    const canvas = fabricRef.current;

    let twin;
    
    // 1. Line Symmetry
    if (obj.type === 'line') {
      // Reflect endpoints
      const p1 = reflectPoint({ x: obj.x1, y: obj.y1 }, symmetry);
      const p2 = reflectPoint({ x: obj.x2, y: obj.y2 }, symmetry);
      
      twin = new fabric.Line([p1.x, p1.y, p2.x, p2.y], {
        fill: obj.fill,
        stroke: obj.stroke,
        strokeWidth: obj.strokeWidth,
        strokeLineCap: obj.strokeLineCap,
        selectable: false,
        evented: false,
      });
    } 
    // 2. Polyline Symmetry
    else if (obj.type === 'polyline') {
      // Reflect all points
      const newPoints = obj.points.map(p => reflectPoint(p, symmetry));
      
      twin = new fabric.Polyline(newPoints, {
        fill: obj.fill,
        stroke: obj.stroke,
        strokeWidth: obj.strokeWidth,
        strokeLineCap: obj.strokeLineCap,
        strokeLineJoin: obj.strokeLineJoin,
        selectable: false,
        evented: false,
        objectCaching: false
      });
    }
    // 3. Rect/Ellipse Symmetry
    else if (obj.type === 'rect' || obj.type === 'ellipse') {
      // Reflect the center point
      const center = obj.getCenterPoint();
      const newCenter = reflectPoint(center, symmetry);
      
      // Calculate reflected angle: 2 * symmetryAngle - objAngle
      // (This works for simple reflections of rotation)
      const symAngleRad = (symmetry.angle * Math.PI) / 180;
      // Convert object angle to 0-360 range for math safety
      const objAngle = obj.angle || 0;
      const newAngle = (2 * symmetry.angle) - objAngle;

      // Clone properties
      // Note: We use specific constructors instead of obj.clone() to avoid async issues
      const options = {
        left: newCenter.x,
        top: newCenter.y,
        angle: newAngle,
        width: obj.width,
        height: obj.height,
        rx: obj.rx, // for ellipse
        ry: obj.ry, // for ellipse
        fill: obj.fill,
        stroke: obj.stroke,
        strokeWidth: obj.strokeWidth,
        originX: 'center', // Important: Position by center for rotation math to work
        originY: 'center',
        selectable: false,
        evented: false
      };

      if (obj.type === 'rect') twin = new fabric.Rect(options);
      else twin = new fabric.Ellipse(options);
    }

    if (twin) {
      canvas.add(twin);
    }
  };

  // --- 1. HANDLE TOOL SWITCHING & CLEANUP ---
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    // A. CLEANUP MULTI-LINE
    if (rubberBandRef.current) {
      canvas.remove(rubberBandRef.current);
      rubberBandRef.current = null;
      
      // If we have a valid polyline, finalize it and reflect it
      if (polylineRef.current) {
        // Ensure coords are baked
        polylineRef.current._calcDimensions();
        polylineRef.current.setCoords();
        
        generateSymmetry(polylineRef.current);
        
        if (!lockedRef.current) saveHistory();
        polylineRef.current = null;
      }
    }

    // B. SETUP NEW TOOL
    canvas.getObjects().forEach(obj => {
      if (obj === traceImageObj) return;
      if (tool === 'MOVE') {
        obj.selectable = true;
        obj.evented = true;
      } else if (tool === 'STROKE_ERASER') {
        obj.selectable = false;
        obj.evented = true; // Needs to be evented for findTarget to work comfortably
      } else {
        obj.selectable = false;
        obj.evented = false;
      }
    });

    // Reset settings
    canvas.isDrawingMode = false; 
    canvas.selection = false;

    if (tool === 'PEN') {
      canvas.isDrawingMode = true;
      canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
      canvas.freeDrawingBrush.color = currentColor;
      canvas.freeDrawingBrush.width = brushSize;
      canvas.defaultCursor = 'default';
    } 
    else if (tool === 'CALLIGRAPHY') {
      canvas.isDrawingMode = true;
      canvas.freeDrawingBrush = createDynamicBrush(canvas);
      canvas.freeDrawingBrush.color = currentColor;
      canvas.freeDrawingBrush.width = brushSize * 1.5;
      canvas.defaultCursor = 'default';
    }
    else if (tool === 'WHITE_ERASER') {
      canvas.isDrawingMode = true;
      canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
      canvas.freeDrawingBrush.color = '#ffffff';
      canvas.freeDrawingBrush.width = brushSize;
      canvas.defaultCursor = 'default';
    } 
    else if (tool === 'MOVE') {
      canvas.selection = true;
      canvas.defaultCursor = 'move';
    }
    else if (tool === 'STROKE_ERASER') {
      canvas.defaultCursor = 'crosshair';
    } 
    else if (tool.includes('RECT') || tool.includes('ELLIPSE') || tool.includes('LINE')) {
      canvas.defaultCursor = 'crosshair';
    } 
    else {
      canvas.defaultCursor = 'default';
    }
    
    canvas.requestRenderAll();
  }, [tool, currentColor, brushSize, traceImageObj, fabricRef]); 


  // --- 2. MOUSE EVENT HANDLERS ---
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    // --- MOUSE DOWN ---
    const onMouseDown = (o) => {
      const pointer = canvas.getPointer(o.e);

      // A. Eraser (Click)
      if (tool === 'STROKE_ERASER') {
        const target = o.target; 
        if (target) {
          canvas.remove(target);
          canvas.requestRenderAll();
          if (!lockedRef.current) saveHistory();
        }
        return;
      }

      // B. Single Line / Shapes (Drag Start)
      if (['RECT_HOLLOW', 'RECT_FILLED', 'ELLIPSE_HOLLOW', 'ELLIPSE_FILLED', 'LINE_SINGLE'].includes(tool)) {
        canvas.isDrawingMode = false;
        shapeStartRef.current = { x: pointer.x, y: pointer.y };
        
        let shape;
        const commonProps = {
          left: pointer.x,
          top: pointer.y,
          stroke: currentColor,
          strokeWidth: brushSize,
          fill: 'transparent',
          selectable: false,
          evented: false,
          originX: 'left',
          originY: 'top'
        };

        if (tool === 'LINE_SINGLE') {
          shape = new fabric.Line([pointer.x, pointer.y, pointer.x, pointer.y], {
            ...commonProps,
            strokeLineCap: 'round'
          });
        } else if (tool.includes('RECT')) {
          shape = new fabric.Rect({ ...commonProps, width: 0, height: 0 });
        } else if (tool.includes('ELLIPSE')) {
          shape = new fabric.Ellipse({ ...commonProps, rx: 0, ry: 0 });
        }

        if (tool.includes('FILLED')) {
          shape.set({ fill: currentColor, strokeWidth: 0 });
        }

        activeShapeRef.current = shape;
        canvas.add(shape);
      }

      // C. Multi-Line (Click to Segment)
      if (tool === 'LINE_MULTI') {
        if (!polylineRef.current) {
          // Start new
          const points = [{ x: pointer.x, y: pointer.y }, { x: pointer.x, y: pointer.y }];
          const polyline = new fabric.Polyline(points, {
            stroke: currentColor,
            strokeWidth: brushSize,
            fill: 'transparent',
            strokeLineCap: 'round',
            strokeLineJoin: 'round',
            selectable: false,
            evented: false,
            objectCaching: false
          });
          polylineRef.current = polyline;
          canvas.add(polyline);

          // Rubber band
          const rubberBand = new fabric.Line([pointer.x, pointer.y, pointer.x, pointer.y], {
            stroke: currentColor,
            strokeWidth: 1,
            strokeDashArray: [5, 5],
            opacity: 0.5,
            selectable: false,
            evented: false
          });
          rubberBandRef.current = rubberBand;
          canvas.add(rubberBand);
        } 
        else {
          // Continue existing
          const poly = polylineRef.current;
          const points = poly.points;
          points.push({ x: pointer.x, y: pointer.y });
          if (rubberBandRef.current) {
            rubberBandRef.current.set({ x1: pointer.x, y1: pointer.y, x2: pointer.x, y2: pointer.y });
          }
          
          poly.set({ points: points, dirty: true });
          poly._calcDimensions();
          poly.setCoords();
          
          canvas.requestRenderAll();
        }
      }
    };

    // --- MOUSE MOVE ---
    const onMouseMove = (o) => {
      const pointer = canvas.getPointer(o.e);

      // A. DRAG ERASER (Drag to delete)
      if (tool === 'STROKE_ERASER' && o.e.buttons === 1) {
        const target = canvas.findTarget(o.e);
        if (target && target !== traceImageObj) { 
           canvas.remove(target);
           canvas.requestRenderAll();
           isErasingRef.current = true; 
        }
        return;
      }

      // B. Dragging Shapes
      if (activeShapeRef.current && shapeStartRef.current) {
        const start = shapeStartRef.current;
        const shape = activeShapeRef.current;
        
        if (shape.type === 'line') {
          let targetX = pointer.x;
          let targetY = pointer.y;

          if (o.e.shiftKey) {
            const dx = pointer.x - start.x;
            const dy = pointer.y - start.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            const snap = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
            targetX = start.x + Math.cos(snap) * dist;
            targetY = start.y + Math.sin(snap) * dist;
          }
          shape.set({ x2: targetX, y2: targetY });
        }
        else {
          let w = Math.abs(pointer.x - start.x);
          let h = Math.abs(pointer.y - start.y);

          if (o.e.shiftKey) {
            const dim = Math.max(w, h);
            w = dim; h = dim;
          }

          const left = pointer.x < start.x ? pointer.x : start.x;
          const top = pointer.y < start.y ? pointer.y : start.y;
          
          if (shape.type === 'rect') {
            shape.set({ width: w, height: h, left, top });
          } else if (shape.type === 'ellipse') {
            shape.set({ rx: w/2, ry: h/2, left, top });
          }
        }
        canvas.requestRenderAll();
      }

      // C. Multi-Line Rubber Band
      if (tool === 'LINE_MULTI' && rubberBandRef.current) {
        rubberBandRef.current.set({ x2: pointer.x, y2: pointer.y });
        canvas.requestRenderAll();
      }
    };

    // --- MOUSE UP ---
    const onMouseUp = () => {
      // A. Finish Eraser Drag
      if (isErasingRef.current) {
        if (!lockedRef.current) saveHistory();
        isErasingRef.current = false;
      }

      // B. Finish Shapes / Single Line
      if (activeShapeRef.current) {
        activeShapeRef.current.setCoords();
        generateSymmetry(activeShapeRef.current);
        if (!lockedRef.current) saveHistory();
        activeShapeRef.current = null;
        shapeStartRef.current = null;
      }
    };

    // --- PATH CREATED (Pen/Calligraphy) ---
    const onPathCreated = (e) => {
      if (!lockedRef.current) saveHistory();
      if (symmetry && symmetry.locked) {
        const path = e.path;
        if (!path) return;
        const originalPoints = path.path; 
        const reflectedPathData = originalPoints.map(cmd => {
          const newCmd = [...cmd];
          for (let i = 1; i < newCmd.length; i += 2) {
            const p = { x: newCmd[i], y: newCmd[i+1] };
            const ref = reflectPoint(p, symmetry);
            newCmd[i] = ref.x;
            newCmd[i+1] = ref.y;
          }
          return newCmd;
        });
        const reflectedPath = new fabric.Path(reflectedPathData, {
          fill: path.fill,
          stroke: path.stroke,
          strokeWidth: path.strokeWidth,
          strokeLineCap: path.strokeLineCap,
          strokeLineJoin: path.strokeLineJoin,
          objectCaching: false,
          selectable: false,
          evented: false,
        });

        lockedRef.current = true; 
        canvas.add(reflectedPath);
        lockedRef.current = false;
      }
    };

    // --- OBJECT MODIFIED (Transforms) ---
    // This definition MUST be here before we use it below
    const onObjectModified = (e) => {
        // If the modified object is the trace image, DO NOT save history
        if (e.target && e.target.isTraceImage) return;
        if (!lockedRef.current) saveHistory();
    };

    // --- ATTACH LISTENERS ---
    canvas.on('mouse:down', onMouseDown);
    canvas.on('mouse:move', onMouseMove);
    canvas.on('mouse:up', onMouseUp);
    canvas.on('path:created', onPathCreated);
    canvas.on('object:modified', onObjectModified); // <--- ATTACH

    // --- CLEANUP ---
    return () => {
      canvas.off('mouse:down', onMouseDown);
      canvas.off('mouse:move', onMouseMove);
      canvas.off('mouse:up', onMouseUp);
      canvas.off('path:created', onPathCreated);
      canvas.off('object:modified', onObjectModified); // <--- DETACH
    };
  }, [tool, currentColor, brushSize, symmetry, saveHistory, fabricRef]);

  return {};
};