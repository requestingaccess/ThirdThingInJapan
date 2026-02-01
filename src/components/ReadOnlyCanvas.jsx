import React, { useEffect, useRef } from "react";
import { fabric } from "fabric";

export default function ReadOnlyCanvas({ data, width = 300, height = 300 }) {
  const canvasEl = useRef(null);

  useEffect(() => {
    if (!canvasEl.current) return;

    // 1. Init Static Canvas (Interaction Disabled)
    const canvas = new fabric.StaticCanvas(canvasEl.current, {
      backgroundColor: "#ffffff",
      renderOnAddRemove: false,
    });

    // 2. Load Data
    if (data) {
        let parsedData = data;
        if (typeof data === "string") {
            try { parsedData = JSON.parse(data); } catch (e) { console.error("Canvas Parse Error", e); }
        }

        canvas.loadFromJSON(parsedData, () => {
            // 3. Auto-Scale to fit container
            const objects = canvas.getObjects();
            if (objects.length > 0) {
                // Determine scale based on assumed original size (usually window size)
                // If your saved data has width/height, use that. Otherwise guess 800x600 or calc bounds.
                // For simplicity, we just scale based on the incoming props vs the canvas internal size
                
                const vpt = canvas.viewportTransform;
                // Simple zoom: just fit the canvas width
                const scale = width / (parsedData.width || 800); 
                canvas.setZoom(scale);
                canvas.setWidth(width);
                canvas.setHeight(height);
            }
            canvas.renderAll();
        });
    }

    return () => {
      canvas.dispose();
    };
  }, [data, width, height]);

  return (
    <div className="overflow-hidden rounded-lg shadow-sm border border-white/10 bg-white inline-block">
      <canvas ref={canvasEl} width={width} height={height} />
    </div>
  );
}