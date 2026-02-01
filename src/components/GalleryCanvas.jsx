import React, { useEffect, useRef } from 'react';
import { fabric } from 'fabric';

const GalleryCanvas = ({ jsonData }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !jsonData) return;

    // 1. Parse Data
    let parsedData;
    try {
      parsedData = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
    } catch (e) {
      console.error("Gallery JSON parse error:", e);
      return;
    }

    // Default to 800x600 if no dimensions found (legacy data support)
    const originalW = parsedData.width || 800;
    const originalH = parsedData.height || 600;

    // 2. Init Static Canvas
    // Note: We don't set width/height here yet.
    const canvas = new fabric.StaticCanvas(canvasRef.current, {
      renderOnAddRemove: false,
      selection: false,
      backgroundColor: '#ffffff', // The "Paper" color
    });

    canvas.loadFromJSON(parsedData, () => {
      if (!containerRef.current) return;
      
      const containerW = containerRef.current.clientWidth;
      const containerH = containerRef.current.clientHeight;

      // 3. Calculate Scale (Contain strategy)
      // "How much do I need to shrink the paper to fit inside the card?"
      const scaleX = containerW / originalW;
      const scaleY = containerH / originalH;
      const scale = Math.min(scaleX, scaleY);

      // 4. Set Canvas Dimensions to the SCALED size
      // This makes the canvas element exactly the size of the paper.
      const finalW = originalW * scale;
      const finalH = originalH * scale;

      canvas.setDimensions({ width: finalW, height: finalH });
      canvas.setZoom(scale);

      // No panning needed because the canvas element itself is the view
      canvas.requestRenderAll();
    });

    return () => {
      canvas.dispose();
    };
  }, [jsonData]);

  return (
    // Flexbox centering handles the whitespace (grey bars)
    <div ref={containerRef} className="w-full h-full flex items-center justify-center overflow-hidden pointer-events-none">
      <canvas ref={canvasRef} className="shadow-2xl" />
    </div>
  );
};

export default GalleryCanvas;