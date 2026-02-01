// src/pages/Game.jsx

import React, { useState, useEffect, useRef } from "react";
import { onValue, ref, update } from "firebase/database";
import { db } from "../firebase";
import { fabric } from "fabric";

// Components
import GalleryCanvas from "../components/GalleryCanvas";
import CanvasSelector from "../components/CanvasSelector";
import ToolPicker from "../components/ToolPicker";
import SquishySlider from "../components/SquishySlider";
import PinDeck from "../components/PinDeck";
import LiquidColorPicker from "../components/LiquidColorPicker";

// Icons
import { Undo2, Redo2, Download, Lock, Unlock, Trash2 } from 'lucide-react';

// Hooks & Utils
import { useHistory } from "../hooks/useHistory";
import { useCanvasTools } from "../hooks/useCanvasTools";

export default function Game({ roomId, players, currentUser, settings: initialSettings }) {

  const [currentRound, setCurrentRound] = useState(0);
  const [timer, setTimer] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [settings, setSettings] = useState(initialSettings || {});
  const [roundAspect, setRoundAspect] = useState(null);

  // Refs
  const canvasEl = useRef(null);
  const fabricRef = useRef(null);
  const containerRef = useRef(null);
  const lastTimerEndRef = useRef(0);
  const urgencyAudioRef = useRef(new Audio(`${import.meta.env.BASE_URL}urgencymusic.wav`));

  // State
  const [currentColor, setCurrentColor] = useState("#000000");
  const [brushSize, setBrushSize] = useState(4);
  const [tool, setTool] = useState("PEN");

  const [symmetry, setSymmetry] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [traceUrl, setTraceUrl] = useState("");
  const [traceImageObj, setTraceImageObj] = useState(null);
  const [isTraceLocked, setIsTraceLocked] = useState(false);
  const [inputText, setInputText] = useState("");
  const [submittedData, setSubmittedData] = useState(null);
  const [penaltyFlash, setPenaltyFlash] = useState(null);
  const [isSynced, setIsSynced] = useState(false);

  // Data from the previous player in the chain
  const [previousData, setPreviousData] = useState(null);

  // Pin Deck
  const [pinnedTools, setPinnedTools] = useState(() => {
    try {
      const saved = localStorage.getItem("gartic_pinned_tools");
      return saved ? JSON.parse(saved) : ["PEN", "WHITE_ERASER", "SYMMETRY"];
    } catch { return ["PEN", "WHITE_ERASER", "SYMMETRY"]; }
  });

  // Hooks
  const { history, redoStack, lockedRef, initHistory, saveHistory, undo, redo } = useHistory(fabricRef);

  useCanvasTools({
    fabricRef, tool, brushSize, currentColor, symmetry, saveHistory, lockedRef, traceImageObj
  });

  const isHost = players.length > 0 && players[0].id === currentUser?.uid;
  const isWritingRound = settings.startMode === "DRAW" ? currentRound % 2 !== 0 : currentRound % 2 === 0;
  const isDrawingRound = !isWritingRound;
  
  const activePlayers = players.filter(p => p.presence?.state !== 'offline');
  const submittedCount = activePlayers.filter(p => p.submitted).length;

  // --- 1. GAME LOGIC SYNC ---
  useEffect(() => {
    const roomRef = ref(db, `rooms/${roomId}`);
    const unsub = onValue(roomRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) return;

      if (data.settings) setSettings(data.settings);

      setIsSynced(true);

      // Sync Game State
      if (data.status === 'PLAYING') {
        const serverRound = data.round || 0;
        if (serverRound !== currentRound) {
          // NEW ROUND TRIGGERED
          setCurrentRound(serverRound);
          setSubmitted(false);
          setSubmittedData(null);
          setInputText("");
          setRoundAspect(null);
          setSymmetry(null);
          setPenaltyFlash(null);

          if (fabricRef.current) {
            fabricRef.current.dispose();
            fabricRef.current = null;
          }
          setTraceImageObj(null);
          setIsTraceLocked(false);
        }
      }

      // TIMER & PENALTY DETECTION
      if (data.timerEnd) {
        if (lastTimerEndRef.current && lastTimerEndRef.current - data.timerEnd > 2000) {
            const diff = Math.round((lastTimerEndRef.current - data.timerEnd) / 1000);
            setPenaltyFlash(`-${diff}s`);
            setTimeout(() => setPenaltyFlash(null), 1500);
        }
        lastTimerEndRef.current = data.timerEnd;

        const timeLeft = Math.max(0, Math.floor((data.timerEnd - Date.now()) / 1000));
        setTimer(timeLeft);
      } else {
        setTimer(0);
        lastTimerEndRef.current = 0;
      }
    });

    // Local Timer Tick
    const interval = setInterval(() => { setTimer(prev => prev > 0 ? prev - 1 : 0); }, 1000);
    return () => { unsub(); clearInterval(interval); };
  }, [roomId, currentRound]);

  // --- 2. FETCH PREVIOUS ROUND DATA ---
  useEffect(() => {
    if (!players.length || !currentUser) return;
    const myIndex = players.findIndex(p => p.id === currentUser.uid);
    if (myIndex === -1) return;

    const bookOwnerIndex = (myIndex + currentRound) % players.length;
    const bookOwner = players[bookOwnerIndex];

    if (!bookOwner || currentRound === 0) {
      setPreviousData(null);
      return;
    }

    const prevRoundIdx = currentRound - 1;
    const pageRef = ref(db, `rooms/${roomId}/books/${bookOwner.id}/${prevRoundIdx}`);

    const unsub = onValue(pageRef, (snapshot) => {
      if (snapshot.exists()) setPreviousData(snapshot.val());
      else setPreviousData(null);
    });
    return () => unsub();
  }, [currentRound, players, currentUser, roomId]);

  // --- 3. SUBMISSION HANDLER ---
  // Defined before the effects that use it
  const handleSubmit = async () => {
    if (!players[0] || !currentUser) return;
    setSubmitted(true);
    if (traceImageObj && fabricRef.current) fabricRef.current.remove(traceImageObj);

    const myIndex = players.findIndex((p) => p.id === currentUser?.uid);
    const bookOwnerIndex = (myIndex + currentRound) % players.length;
    const bookOwner = players[bookOwnerIndex];

    let content = "";
    let type = "";

    if (isWritingRound) {
      content = inputText;
      type = "PROMPT";
    } else {
      if (fabricRef.current) {
        const jsonOutput = fabricRef.current.toJSON();
        jsonOutput.width = fabricRef.current.width;
        jsonOutput.height = fabricRef.current.height;
        content = JSON.stringify(jsonOutput);
        setSubmittedData(jsonOutput);
      }
      type = "DRAWING";
    }

    const updates = {};
    updates[`rooms/${roomId}/books/${bookOwner.id}/${currentRound}`] = { type, value: content, author: currentUser.uid, timestamp: Date.now() };
    updates[`rooms/${roomId}/players/${currentUser.uid}/submitted`] = true;

    // DYNAMIC TIMER LOGIC
    if (settings.timerMode === "DYNAMIC") {
      const baseTime = settings.baseTime || 60;
      const penaltySeconds = baseTime * 0.1; 
      
      const currentRemaining = Math.max(0, timer);
      let newSecondsLeft = Math.max(0, currentRemaining - penaltySeconds);

      // Safety floor: Don't reduce below 25s unless already there
      if (newSecondsLeft < 25 && currentRemaining > 25) {
          newSecondsLeft = 25; 
      } else if (currentRemaining <= 25) {
          newSecondsLeft = currentRemaining; 
      }
      
      updates[`rooms/${roomId}/timerEnd`] = Date.now() + (newSecondsLeft * 1000);
    }

    await update(ref(db), updates);
  };

  // --- 4. AUTO-SUBMIT EFFECT ---
  // We moved this OUT of the onValue to avoid stale closure issues.
  // When the timer hits 0, this effect fires with the *fresh* handleSubmit (containing fresh inputText).
  useEffect(() => {
    // MODIFIED: Added !isSynced check to prevent premature submission on load
    if (isSynced && settings.timerMode === "DYNAMIC" && timer === 0 && !submitted) {
        handleSubmit();
    }
  }, [timer, settings.timerMode, submitted, isSynced]);
  // --- 5. HOST LOGIC ---
  useEffect(() => {
    if (!isHost) return;

    const allSubmitted = activePlayers.length > 0 && activePlayers.every(p => p.submitted === true);
    
    if (allSubmitted) {
      const updates = {};
      const nextRound = currentRound + 1;

      if (nextRound >= players.length) {
        updates[`rooms/${roomId}/status`] = "GALLERY";
        update(ref(db), updates);
        return;
      }

      updates[`rooms/${roomId}/round`] = nextRound;
      players.forEach(p => { updates[`rooms/${roomId}/players/${p.id}/submitted`] = null; });

      if (settings.timerMode === "DYNAMIC") {
        const baseTime = settings.baseTime || 60;
        updates[`rooms/${roomId}/timerEnd`] = Date.now() + (baseTime * 1000);
      }

      update(ref(db), updates);
    }
  }, [players, isHost, roomId, currentRound, settings, activePlayers]); // Removed timer dep here to let clients handle their own submission

  // --- 6. CANVAS INIT ---
  useEffect(() => {
    if (!canvasEl.current || !containerRef.current || !isDrawingRound || submitted || !roundAspect) return;

    const canvas = new fabric.Canvas(canvasEl.current, {
      isDrawingMode: true,
      backgroundColor: "#ffffff",
      preserveObjectStacking: true,
    });
    fabricRef.current = canvas;
    initHistory();

    const handleResize = () => {
      if (!containerRef.current || !fabricRef.current) return;
      const { clientWidth, clientHeight } = containerRef.current;
      if (clientWidth === 0 || clientHeight === 0) return;

      let aspect = roundAspect || 1;
      let w = clientWidth;
      let h = clientWidth / aspect;

      if (h > clientHeight) { h = clientHeight; w = clientHeight * aspect; }
      w = w * 0.95; h = h * 0.95;

      fabricRef.current.setDimensions({ width: w, height: h });
      fabricRef.current.renderAll();
    };

    const resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(containerRef.current);
    handleResize();

    return () => {
      resizeObserver.disconnect();
      if (fabricRef.current) {
        fabricRef.current.dispose();
        fabricRef.current = null;
      }
    };
  }, [roundAspect, currentRound, isDrawingRound, submitted]);

  useEffect(() => {
    // 1. Trigger Music at 20s mark
    // Only in Drawing rounds, if round is long enough, and we are synced
    if (
      isSynced &&
      isDrawingRound &&
      timer === 20 &&
      (settings.baseTime || 60) >= 45
    ) {
      urgencyAudioRef.current.play().catch((e) => console.error("Audio play failed:", e));
    }

    // 2. Cleanup / Cutoff Logic
    // If the round changes (currentRound changes) or we submit early
    return () => {
      // We perform this check in the cleanup of the effect or when dependencies change.
      // However, we specifically want to catch the "Round End" event.
    };
  }, [timer, isSynced, isDrawingRound, settings.baseTime]);

  // Separate effect to handle Round Transitions/Early Stopping
  useEffect(() => {
     // If the round number changes, check if we need to cut the music
     const audio = urgencyAudioRef.current;
     if (!audio || audio.paused) return;

     // Logic: If the timer was NOT near zero (e.g., > 1s) when the round moved on,
     // it means we finished early -> Fade it out.
     // If timer WAS <= 1s, we let it finish naturally (the 1s trail off).
     if (timer > 1) {
        stopUrgencyMusic(true); // True = Fade out
     }
     
  }, [currentRound]); // Runs whenever we advance to the next round

  // --- 7. EVENT WRAPPERS ---
  const handlePinTool = (id) => { if (!pinnedTools.includes(id) && pinnedTools.length < 5) setPinnedTools([...pinnedTools, id]); };
  const handleUnpinTool = (id) => setPinnedTools(pinnedTools.filter(t => t !== id));
  useEffect(() => { localStorage.setItem("gartic_pinned_tools", JSON.stringify(pinnedTools)); }, [pinnedTools]);

  const handleSymmetryWheel = (e) => {
    if (tool !== "SYMMETRY" || (symmetry && symmetry.locked)) return;
    setSymmetry(prev => {
      let currentAngle = prev ? prev.angle : 90;
      let delta = e.deltaY > 0 ? 5 : -5;
      if (e.shiftKey) {
        delta = e.deltaY > 0 ? 15 : -15;
        const raw = currentAngle + delta;
        return { ...prev, angle: Math.round(raw / 15) * 15 };
      }
      return { ...prev, angle: currentAngle + delta };
    });
  };

  // --- AUDIO HELPER ---
  const stopUrgencyMusic = (fade = false) => {
    const audio = urgencyAudioRef.current;
    if (!audio) return;

    if (fade) {
      // Quick fade out (e.g. when finishing early)
      const fadeInterval = setInterval(() => {
        if (audio.volume > 0.1) {
          audio.volume -= 0.1;
        } else {
          clearInterval(fadeInterval);
          audio.pause();
          audio.currentTime = 0;
          audio.volume = 1.0; // Reset for next time
        }
      }, 50); // Drop 10% volume every 50ms
    } else {
      // Instant stop
      audio.pause();
      audio.currentTime = 0;
      audio.volume = 1.0;
    }
  };

  const handleCanvasClick = (e) => {
    if (tool !== "SYMMETRY" || !containerRef.current) return;
    if (!symmetry) {
      const rect = containerRef.current.getBoundingClientRect();
      setSymmetry({ x: e.clientX - rect.left, y: e.clientY - rect.top, angle: 90, locked: false });
    } else if (!symmetry.locked) {
      setSymmetry(prev => ({ ...prev, locked: true }));
    }
  };

  const handleMouseMove = (e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setMousePos({ x, y });
    if (tool === "SYMMETRY" && symmetry && !symmetry.locked) setSymmetry(prev => ({ ...prev, x, y }));
  };

  const handleAddTraceImage = () => {
    if (!traceUrl || !fabricRef.current) return;
    fabric.Image.fromURL(traceUrl, (img) => {
      if (!img) return;
      img.set({ left: 0, top: 0, opacity: 0.5 });
      img.scaleToWidth(fabricRef.current.width / 2);
      img.excludeFromExport = true;
      img.isTraceImage = true;
      fabricRef.current.add(img);
      fabricRef.current.setActiveObject(img);
      setTraceImageObj(img);
      setTraceUrl("");
    }, { crossOrigin: 'anonymous' });
  };

  const handleRemoveTraceImage = () => {
    if (traceImageObj && fabricRef.current) {
      fabricRef.current.remove(traceImageObj);
      setTraceImageObj(null);
      setIsTraceLocked(false);
    }
  };

  const toggleTraceLock = () => {
    if (!traceImageObj) return;
    const locked = !isTraceLocked;
    setIsTraceLocked(locked);
    traceImageObj.set({ selectable: !locked, evented: !locked, lockMovementX: locked, lockMovementY: locked, lockScalingX: locked, lockScalingY: locked });
    fabricRef.current.discardActiveObject();
    fabricRef.current.requestRenderAll();
  };

  const handleDownload = () => {
    if (!fabricRef.current) return;
    const dataURL = fabricRef.current.toDataURL({ format: 'png', quality: 1 });
    const link = document.createElement('a');
    link.download = `round-${currentRound}.png`;
    link.href = dataURL;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="h-screen w-screen bg-zinc-950 text-white flex flex-col overflow-hidden relative selection:bg-cyan-500/30">

      {/* BACKGROUND */}
      <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] bg-violet-600/20 rounded-full blur-[100px] pointer-events-none z-0" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] bg-cyan-600/20 rounded-full blur-[100px] pointer-events-none z-0" />

      {/* HEADER */}
      <header className="h-16 shrink-0 border-b border-white/10 bg-black/20 backdrop-blur-md flex items-center justify-between px-6 z-20 relative">
        <div className="flex items-center gap-4">
          <h1 className="font-bold text-xl tracking-tight">Round <span className="text-cyan-400">{currentRound + 1}</span></h1>
          
          {/* STATUS BADGE */}
          <div className={`px-3 py-1 rounded-full text-xs font-bold border ${submitted ? "bg-green-500/20 border-green-500 text-green-400" : "bg-yellow-500/10 border-yellow-500/50 text-yellow-400"}`}>
              {submitted ? "DONE" : "ACTING"}
          </div>

          {/* PLAYER COUNTER */}
          <div className="px-3 py-1 rounded-full text-xs font-mono font-bold border bg-white/5 border-white/10 text-zinc-400 flex gap-2">
              <span className="uppercase">Submitted:</span>
              <span className={submittedCount === activePlayers.length ? "text-green-400" : "text-white"}>
                  {submittedCount} / {activePlayers.length}
              </span>
          </div>
        </div>
        
        {/* TIMER CONTAINER */}
        <div className="relative">
            <div className={`text-2xl font-black font-mono ${timer > 0 && timer < 10 ? "text-red-500 animate-pulse" : "text-white"}`}>
                {/* FIX FOR INFINITY DISPLAY: If Dynamic mode, show 0s on expiry. If Manual, show ∞ */}
                {settings.timerMode === "DYNAMIC" 
                    ? `${timer}s` 
                    : (timer > 0 ? `${timer}s` : "∞")
                }
            </div>
            
            {/* FLY-OUT PENALTY TEXT */}
            {penaltyFlash && (
                <div className="absolute top-0 right-full mr-4 text-red-500 font-bold text-xl animate-fly-out whitespace-nowrap pointer-events-none drop-shadow-lg">
                    {penaltyFlash}
                </div>
            )}
        </div>
      </header>

      {/* MAIN */}
      <main className="flex-1 min-h-0 flex flex-row z-10" onWheel={handleSymmetryWheel}>

        {/* COL 1: LEFT TOOLS */}
        <div className="w-24 border-r border-white/5 bg-zinc-900/30 flex flex-col items-center justify-center gap-8 z-10 backdrop-blur-sm">
          {isDrawingRound && !submitted && roundAspect && (
            <>
              <SquishySlider value={brushSize} onChange={setBrushSize} min={1} max={50} />
              <div className="flex flex-col gap-4 mt-2">
                <button onClick={() => undo(tool)} disabled={history.length <= 1} className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white border border-white/5"><Undo2 className="w-5 h-5" strokeWidth={1.5} /></button>
                <button onClick={() => redo(tool)} disabled={redoStack.length === 0} className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white border border-white/5"><Redo2 className="w-5 h-5" strokeWidth={1.5} /></button>
                <div className="h-px bg-white/10 w-full" />
                <button onClick={handleDownload} className="w-10 h-10 rounded-full bg-cyan-900/30 flex items-center justify-center text-cyan-400 border border-cyan-500/30"><Download className="w-5 h-5" strokeWidth={1.5} /></button>
              </div>
            </>
          )}
        </div>

        {/* COL 2: CANVAS AREA */}
        <div className="flex-1 flex flex-col min-w-0 relative bg-zinc-950/20">

          {/* REFERENCE HEADER: Displays prompt IF previous round was Writing */}
          <div className="shrink-0 py-2 flex items-center justify-center min-h-[40px] z-10 pointer-events-none">
            {currentRound > 0 && previousData?.type === "PROMPT" && (
              <div className="flex flex-col items-center gap-1 pointer-events-auto">
                <div className="text-lg font-bold text-white px-6 py-2 bg-black/60 rounded-full border border-white/10 shadow-lg backdrop-blur-sm truncate max-w-2xl">
                  "{previousData.value}"
                </div>
                {!settings.ghostMode && (
                  <span className="text-xs font-bold text-zinc-500 bg-black/40 px-3 py-1 rounded-full border border-white/5">
                    {players.find(p => p.id === previousData.author)?.name || "Unknown"}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex-1 relative flex items-center justify-center p-4 min-h-0" ref={containerRef} onClick={handleCanvasClick} onMouseMove={handleMouseMove}>

            {/* SCENE 1: CANVAS SELECTION */}
            {isDrawingRound && !submitted && !roundAspect && (
              <CanvasSelector onSelect={setRoundAspect} />
            )}

            {/* SCENE 2: INTERACTION (Drawing or Writing) */}
            {(submitted || roundAspect || isWritingRound) && (
              <>
                {isWritingRound ? (
                  // WRITING MODE
                  <div className="flex flex-col items-center w-full h-full p-4 gap-6 justify-center">
                    {previousData?.type === "DRAWING" && (
                      <div className="relative w-full max-w-lg aspect-video bg-zinc-900/50 rounded-xl border border-white/10 overflow-hidden shadow-2xl flex items-center justify-center">
                        {!settings.ghostMode && (
                          <div className="absolute top-3 left-3 z-10 bg-black/60 border border-white/10 px-3 py-1 rounded-full text-xs font-bold text-white/80 shadow-lg backdrop-blur-sm">
                            By {players.find(p => p.id === previousData.author)?.name || "Unknown"}
                          </div>
                        )}
                        <GalleryCanvas jsonData={previousData.value} />
                      </div>
                    )}

                    <textarea
                      className="glass-input w-full max-w-2xl h-32 p-6 text-2xl resize-none rounded-2xl outline-none text-center bg-transparent border-none placeholder-zinc-700"
                      placeholder={currentRound === 0 ? "Write a sentence to start the game..." : "What is this?"}
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      disabled={submitted}
                    />
                  </div>
                ) : (
                  // DRAWING MODE
                  roundAspect && (
                    submitted && submittedData ? (
                      // 1. PREVIEW MODE
                      <div className="w-full h-full flex items-center justify-center p-4">
                        <div className="relative w-full h-full bg-zinc-900/30 rounded-sm shadow-2xl overflow-hidden border border-white/10">
                          <GalleryCanvas jsonData={submittedData} />
                          <div className="absolute top-4 right-4 z-50">
                            <span className="bg-black/80 text-white px-4 py-2 rounded-full font-bold text-xs border border-white/10 flex items-center gap-3 shadow-lg backdrop-blur-md">
                              <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                              </span>
                              WAITING FOR PLAYERS...
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      // 2. INTERACTIVE MODE
                      <div key={`drawing-stage-${currentRound}`} className="relative shadow-2xl rounded-sm border border-zinc-800 group">
                        <canvas ref={canvasEl} />

                        {tool === "TRACE" && !submitted && (
                          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 bg-zinc-900/90 border border-cyan-500/50 p-2 rounded-lg shadow-xl backdrop-blur-md">
                            <input type="text" placeholder="Image URL..." className="bg-transparent text-xs text-white px-2 py-1 outline-none w-32 border-b border-white/20" value={traceUrl} onChange={(e) => setTraceUrl(e.target.value)} />
                            <button onClick={handleAddTraceImage} className="text-[10px] font-bold bg-cyan-600 px-2 py-1 rounded">LOAD</button>
                            {traceImageObj && (
                              <>
                                <button onClick={toggleTraceLock} className="p-1 rounded text-zinc-500 hover:text-white"><Lock className="w-4 h-4" /></button>
                                <button onClick={handleRemoveTraceImage} className="p-1 rounded text-red-500"><Trash2 className="w-4 h-4" /></button>
                              </>
                            )}
                          </div>
                        )}

                        {!submitted && (symmetry || tool === "SYMMETRY") && (
                          <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
                            {(symmetry || !symmetry) && (
                              <div className="absolute bg-cyan-500/50" style={{
                                left: symmetry ? symmetry.x : mousePos.x,
                                top: symmetry ? symmetry.y : mousePos.y,
                                width: '2000px', height: '2px',
                                transform: `translate(-50%, -50%) rotate(${symmetry ? symmetry.angle : 90}deg)`,
                                borderTop: '2px dashed cyan'
                              }}
                              />
                            )}
                            {symmetry?.locked && tool === "SYMMETRY" && (
                              <div className="absolute pointer-events-auto flex gap-2" style={{ left: symmetry.x + 20, top: symmetry.y - 40 }}>
                                <button onClick={() => setSymmetry(p => ({ ...p, locked: false }))} className="p-2 bg-zinc-900 rounded-full shadow hover:text-yellow-400"><Unlock className="w-4 h-4" /></button>
                                <button onClick={() => setSymmetry(null)} className="p-2 bg-zinc-900 rounded-full shadow hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                              </div>
                            )}
                          </div>
                        )}

                        {!submitted && (
                          <div className="absolute bottom-0 left-0 z-50 flex items-center justify-center w-0 h-0 pointer-events-none">
                            <div className="flex items-center justify-center w-[400px] h-[400px] -translate-x-[20px] -translate-y-[20px]">
                              <LiquidColorPicker initialColor={{ h: 0, s: 100, l: 50, a: 1 }} onChange={(c) => setCurrentColor(`hsla(${c.h.toFixed(1)},${c.s.toFixed(1)}%,${c.l.toFixed(1)}%,${c.a.toFixed(2)})`)} />
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  )
                )}
              </>
            )}
          </div>

          {/* FOOTER: ACTION BUTTONS */}
          <div className="h-auto min-h-[120px] flex flex-col items-center justify-end shrink-0 pb-6 gap-4 z-20">
            {isDrawingRound && !submitted && roundAspect && (
              <PinDeck pinnedIds={pinnedTools} activeToolId={tool} onSelect={setTool} onUnpin={handleUnpinTool} />
            )}
            {!submitted && (
              <button onClick={handleSubmit} disabled={(isWritingRound && !inputText.trim()) || (isDrawingRound && !roundAspect)} className="px-8 py-3 font-bold bg-gradient-to-r from-violet-600 to-cyan-600 rounded-full hover:scale-105 transition-transform disabled:opacity-50 shadow-lg shadow-cyan-900/20">SUBMIT</button>
            )}
          </div>
        </div>

        {/* COL 3: RIGHT TOOLS */}
        <div className="w-24 border-l border-white/5 bg-zinc-900/30 flex flex-col items-center justify-center z-10 backdrop-blur-sm gap-8">
          {isDrawingRound && !submitted && roundAspect && (
            <ToolPicker currentTool={tool} onSelect={setTool} onPin={handlePinTool} pinnedIds={pinnedTools} />
          )}
        </div>

      </main>
    </div>
  );
}