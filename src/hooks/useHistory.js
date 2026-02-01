// src/hooks/useHistory.js
import { useState, useRef, useCallback } from 'react';

export const useHistory = (fabricRef) => {
  const [history, setHistory] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const lockedRef = useRef(false);

  // Initialize history (call this once canvas is ready)
  const initHistory = useCallback(() => {
    if (!fabricRef.current) return;
    const json = JSON.stringify(fabricRef.current.toJSON());
    setHistory([json]);
  }, [fabricRef]);

  // Save current state
  const saveHistory = useCallback(() => {
    if (lockedRef.current || !fabricRef.current) return;
    const json = JSON.stringify(fabricRef.current.toJSON());
    setHistory(prev => {
      // Dedup: Don't save if identical to last state
      if (prev.length > 0 && prev[prev.length - 1] === json) return prev;
      return [...prev, json];
    });
    setRedoStack([]); 
  }, [fabricRef]);

  const undo = useCallback((currentTool) => {
    if (history.length <= 1 || !fabricRef.current) return;
    lockedRef.current = true;

    // 1. RESCUE TRACE IMAGE
    const traceImg = fabricRef.current.getObjects().find(obj => obj.isTraceImage);

    const currentState = history[history.length - 1]; 
    const previousState = history[history.length - 2]; 
    
    setRedoStack(prev => [currentState, ...prev]);
    setHistory(prev => prev.slice(0, -1));

    fabricRef.current.loadFromJSON(previousState, () => {
      // 2. RESTORE TRACE IMAGE
      if (traceImg) {
        fabricRef.current.add(traceImg);
        // Ensure it stays at the correct index (usually bottom or top depending on preference)
        // fabricRef.current.sendToBack(traceImg); 
      }

      fabricRef.current.renderAll();
      
      const isDrawing = currentTool === "PEN" || currentTool === "WHITE_ERASER" || currentTool === "CALLIGRAPHY";
      fabricRef.current.isDrawingMode = isDrawing;
      fabricRef.current.selection = (currentTool === "MOVE");
      lockedRef.current = false;
    });
  }, [history, fabricRef]);

  const redo = useCallback((currentTool) => {
    if (redoStack.length === 0 || !fabricRef.current) return;
    lockedRef.current = true;

    // 1. RESCUE TRACE IMAGE
    const traceImg = fabricRef.current.getObjects().find(obj => obj.isTraceImage);

    const nextState = redoStack[0];
    const newRedo = redoStack.slice(1);

    setHistory(prev => [...prev, nextState]);
    setRedoStack(newRedo);

    fabricRef.current.loadFromJSON(nextState, () => {
      // 2. RESTORE TRACE IMAGE
      if (traceImg) {
        fabricRef.current.add(traceImg);
      }

      fabricRef.current.renderAll();
      const isDrawing = currentTool === "PEN" || currentTool === "WHITE_ERASER" || currentTool === "CALLIGRAPHY";
      fabricRef.current.isDrawingMode = isDrawing;
      fabricRef.current.selection = (currentTool === "MOVE");
      lockedRef.current = false;
    });
  }, [redoStack, fabricRef]);

  return {
    history,
    redoStack,
    lockedRef,
    initHistory,
    saveHistory,
    undo,
    redo
  };
};