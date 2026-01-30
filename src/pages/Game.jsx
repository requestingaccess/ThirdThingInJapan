import React, { useState, useEffect, useRef } from "react";
import { onValue, ref, update, get } from "firebase/database";
import { db } from "../firebase";
import { fabric } from "fabric";
import { HexColorPicker } from "react-colorful";

// --- ICONS ---
const TrashIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejn="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
  </svg>
);
const LockIcon = ({ locked }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
    {locked ? (
      <path strokeLinecap="round" strokeLinejn="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0V10.5m-1.5 0h12a2.25 2.25 0 0 1 2.25 2.25v7.5a2.25 2.25 0 0 1-2.25 2.25h-12a2.25 2.25 0 0 1-2.25-2.25v-7.5a2.25 2.25 0 0 1 2.25-2.25Z" />
    ) : (
      <path strokeLinecap="round" strokeLinejn="round" d="M13.5 10.5V6.75a4.5 4.5 0 0 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
    )}
  </svg>
);

export default function Game({ roomId, players, currentUser, settings: initialSettings }) {

  const [currentRound, setCurrentRound] = useState(0);
  const [timer, setTimer] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [settings, setSettings] = useState(initialSettings || {});
  
  // Fabric Refs
  const canvasEl = useRef(null); 
  const fabricRef = useRef(null); 
  const containerRef = useRef(null); 
  
  // Tools
  const [currentColor, setCurrentColor] = useState("#FFFFFF");
  const [brushSize, setBrushSize] = useState(4);
  const [tool, setTool] = useState("PEN"); 
  const [showColorPicker, setShowColorPicker] = useState(false);
  
  // Trace
  const [traceUrl, setTraceUrl] = useState("");
  const [traceImageObj, setTraceImageObj] = useState(null);
  const [isTraceLocked, setIsTraceLocked] = useState(false);

  // Input
  const [inputText, setInputText] = useState("");

  // Previous Data
  const [previousData, setPreviousData] = useState(null);

  // --- HOST LOGIC: The "Brain" of the Game ---
  // Only the first player in the list acts as the "Server"
  const isHost = players.length > 0 && players[0].id === currentUser?.uid;

  useEffect(() => {
    if (!isHost) return;

    // 1. Check if everyone has submitted
    const activePlayers = players.filter(p => p.presence?.state !== 'offline');
    const allSubmitted = activePlayers.every(p => p.submitted);
    
    // 2. Check if timer ran out
    const timerExpired = settings.timerMode === "DYNAMIC" && timer === 0 && currentRound > 0; // Don't expire round 0 instantly

    if ((allSubmitted || timerExpired) && activePlayers.length > 0) {
        // TRIGGER NEXT ROUND
        const updates = {};
        const nextRound = currentRound + 1;
        
        updates[`rooms/${roomId}/round`] = nextRound;
        
        // Reset Submissions
        players.forEach(p => {
            updates[`rooms/${roomId}/players/${p.id}/submitted`] = null;
        });

        // Reset Timer (if dynamic)
        if (settings.timerMode === "DYNAMIC") {
            const baseTime = settings.baseTime || 60;
            // Speed up by 10% each round, min 10s
            const speedFactor = Math.pow(0.9, nextRound); 
            const newDuration = Math.max(15, Math.floor(baseTime * speedFactor));
            updates[`rooms/${roomId}/timerEnd`] = Date.now() + (newDuration * 1000);
        }

        update(ref(db), updates);
    }
  }, [players, timer, isHost, roomId, currentRound, settings]);
  // --------------------------------------------


  // --- LISTENER: Round & Status Updates ---
  useEffect(() => {
    const roomRef = ref(db, `rooms/${roomId}`);
    const unsub = onValue(roomRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) return;

      if (data.settings) setSettings(data.settings);

      // Handle Round Change
      const serverRound = data.round || 0;
      if (serverRound !== currentRound) {
        setCurrentRound(serverRound);
        setSubmitted(false);
        setInputText("");
        setPreviousData(null); // Clear old prompt
        
        // Clear canvas
        if (fabricRef.current) {
          fabricRef.current.clear();
          fabricRef.current.setBackgroundColor("transparent", fabricRef.current.renderAll.bind(fabricRef.current));
          setTraceImageObj(null);
          setIsTraceLocked(false);
        }
      }

      // Handle Timer
      if (data.timerEnd) {
         setTimer(Math.max(0, Math.floor((data.timerEnd - Date.now()) / 1000)));
      } else {
         setTimer(0);
      }
    });

    // Timer Interval (Tick down every second)
    const interval = setInterval(() => {
        setTimer(prev => prev > 0 ? prev - 1 : 0);
    }, 1000);

    return () => { unsub(); clearInterval(interval); };
  }, [roomId, currentRound]);


  // --- LOGIC: Writing vs Drawing ---
  // BUG FIX: Respect the startMode setting
  const isEvenRound = currentRound % 2 === 0;
  const startModeDraw = settings.startMode === "DRAW";
  // If Start=DRAW: Round 0 is Draw (so isWriting is False). Round 1 is Write (True).
  // If Start=WRITE: Round 0 is Write (True).
  const isWritingRound = startModeDraw ? !isEvenRound : isEvenRound;
  const isDrawingRound = !isWritingRound;


  // --- FABRIC JS SETUP ---
  useEffect(() => {
    if (!canvasEl.current || !containerRef.current) return;
    
    // Create canvas
    const canvas = new fabric.Canvas(canvasEl.current, {
      isDrawingMode: true,
      backgroundColor: "transparent", 
    });
    fabricRef.current = canvas;

    const handleResize = () => {
      if (!containerRef.current) return;
      const { clientWidth, clientHeight } = containerRef.current;
      
      let aspect = 1;
      if (settings.aspect === "Wide") aspect = 16 / 9;
      if (settings.aspect === "Tall") aspect = 9 / 16;
      
      let w = clientWidth;
      let h = clientWidth / aspect;

      if (h > clientHeight) {
        h = clientHeight;
        w = clientHeight * aspect;
      }

      canvas.setDimensions({ width: w, height: h });
      canvas.renderAll();
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
    canvas.freeDrawingBrush.color = currentColor;
    canvas.freeDrawingBrush.width = brushSize;

    canvas.on('mouse:down', (options) => {
      if (tool === "STROKE_ERASER" && options.target) {
        canvas.remove(options.target);
        canvas.requestRenderAll();
      }
    });

    return () => {
      window.removeEventListener("resize", handleResize);
      canvas.dispose();
    };
  }, [settings.aspect, currentRound]); 


  // --- TOOL SWITCHING ---
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    if (tool === "PEN") {
      canvas.isDrawingMode = true;
      canvas.freeDrawingBrush.color = currentColor;
      canvas.freeDrawingBrush.width = brushSize;
    } else if (tool === "WHITE_ERASER") {
      canvas.isDrawingMode = true;
      canvas.freeDrawingBrush.color = "#18181b"; 
      canvas.freeDrawingBrush.width = brushSize;
    } else if (tool === "STROKE_ERASER") {
      canvas.isDrawingMode = false;
      canvas.selection = false;
      canvas.defaultCursor = "crosshair";
      canvas.hoverCursor = "crosshair";
    } else if (tool === "TRACE") {
        canvas.isDrawingMode = false;
        canvas.selection = true;
        canvas.defaultCursor = "default";
    }
  }, [tool, currentColor, brushSize]);

  // Trace Helpers
  const handleAddTraceImage = () => {
    if (!traceUrl || !fabricRef.current) return;
    fabric.Image.fromURL(traceUrl, (img) => {
        if(!img) return;
        if(img.width > fabricRef.current.width) img.scaleToWidth(fabricRef.current.width * 0.8);
        img.set({ left: fabricRef.current.width / 2, top: fabricRef.current.height / 2, originX: 'center', originY: 'center', opacity: 1.0 });
        fabricRef.current.add(img);
        fabricRef.current.setActiveObject(img);
        setTraceImageObj(img);
        setTool("TRACE");
    }, { crossOrigin: 'anonymous' });
  };

  const toggleTraceLock = () => {
    if(!traceImageObj) return;
    const isLocked = !isTraceLocked;
    setIsTraceLocked(isLocked);
    traceImageObj.set({ selectable: !isLocked, evented: !isLocked, opacity: isLocked ? 0.35 : 1.0 });
    if(isLocked) {
        fabricRef.current.sendToBack(traceImageObj);
        setTool("PEN");
    } else {
        setTool("TRACE");
    }
    fabricRef.current.requestRenderAll();
  };
  
  const clearCanvas = () => {
     if(fabricRef.current) {
         fabricRef.current.clear();
         fabricRef.current.setBackgroundColor("transparent", null);
         setTraceImageObj(null);
         setIsTraceLocked(false);
     }
  };


  // --- PREVIOUS ROUND DATA ---
  const myIndex = players.findIndex((p) => p.id === currentUser?.uid);
  const bookOwnerIndex = (myIndex + currentRound) % players.length;
  const bookOwner = players[bookOwnerIndex];
  
  useEffect(() => {
    if (currentRound > 0 && bookOwner) {
        const prevRound = currentRound - 1;
        get(ref(db, `rooms/${roomId}/books/${bookOwner.id}/${prevRound}`)).then((snap) => {
            if (snap.exists()) setPreviousData(snap.val());
        });
    }
  }, [currentRound, bookOwner, roomId]);

  const handleSubmit = async () => {
    if (!bookOwner || !currentUser) return;
    setSubmitted(true);

    let content = "";
    let type = "";

    if (isWritingRound) {
        content = inputText;
        type = "PROMPT";
    } else {
        content = JSON.stringify(fabricRef.current.toJSON());
        type = "DRAWING";
    }

    const updates = {};
    updates[`rooms/${roomId}/books/${bookOwner.id}/${currentRound}`] = {
        type,
        value: content,
        author: currentUser.uid,
        timestamp: Date.now()
    };
    updates[`rooms/${roomId}/players/${currentUser.uid}/submitted`] = true;
    
    // Check if this was the LAST person submitting (Client-side optimistic check)
    // The Host Effect will do the real heavy lifting, but we can do a quick check here too?
    // Nah, let the Host Effect handle the transition to keep it safe.
    
    await update(ref(db), updates);
  };


  // --- RENDER ---
  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col overflow-hidden relative selection:bg-cyan-500/30">
      
      {/* Background Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] bg-violet-600/20 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] bg-cyan-600/20 rounded-full blur-[100px] pointer-events-none" />

      {/* HEADER */}
      <header className="h-16 border-b border-white/10 bg-black/20 backdrop-blur-md flex items-center justify-between px-6 z-10">
        <div className="flex items-center gap-4">
            <h1 className="font-bold text-xl tracking-tight">
                Round <span className="text-cyan-400">{currentRound + 1}</span>
            </h1>
            <span className="text-zinc-500">|</span>
            <div className={`px-3 py-1 rounded-full text-sm font-bold border ${submitted ? "bg-green-500/20 border-green-500 text-green-400" : "bg-yellow-500/10 border-yellow-500/50 text-yellow-400"}`}>
                {submitted ? "DONE" : "ACTING"}
            </div>
            {isHost && <span className="text-xs text-zinc-600 font-mono border border-zinc-800 px-2 rounded">HOST</span>}
        </div>
        <div className={`text-2xl font-black font-mono ${timer > 0 && timer < 10 ? "text-red-500 animate-pulse" : "text-white"}`}>
            {timer > 0 ? `${timer}s` : "∞"}
        </div>
      </header>

      {/* MAIN */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 relative z-0">
        
        {/* INSTRUCTIONS */}
        <div className="mb-4 text-center max-w-2xl w-full">
            {currentRound === 0 ? (
                <h2 className="text-2xl font-bold mb-2">
                    {isWritingRound ? "Write a starting prompt!" : "Draw the start!"}
                </h2>
            ) : (
                <div className="glass-panel p-4 rounded-xl">
                   <p className="text-zinc-400 text-xs uppercase tracking-widest mb-2">Previous Player Submitted:</p>
                   {previousData?.type === "PROMPT" ? (
                       <p className="text-xl font-bold text-white">"{previousData.value}"</p>
                   ) : (
                        <div className="text-cyan-400 italic">
                            (Drawing hidden - Implement ReadOnly Canvas in Phase 9)
                        </div>
                   )}
                </div>
            )}
        </div>

        {/* WORKSPACE */}
        <div className="w-full max-w-6xl flex-1 flex gap-4 min-h-0">
            
            {/* TOOLBAR (Drawing Only) */}
            {isDrawingRound && !submitted && (
                <div className="w-16 flex flex-col gap-3 z-10">
                    <button onClick={() => setTool("PEN")} className={`glass-button p-3 rounded-xl ${tool === "PEN" ? "bg-cyan-500/20 border-cyan-500" : ""}`}>P</button>
                    <button onClick={() => setTool("WHITE_ERASER")} className={`glass-button p-3 rounded-xl ${tool === "WHITE_ERASER" ? "bg-white/20" : ""}`}>E</button>
                    <button onClick={() => setTool("STROKE_ERASER")} className={`glass-button p-3 rounded-xl ${tool === "STROKE_ERASER" ? "bg-red-500/20" : ""}`}><TrashIcon /></button>
                    <div className="h-px bg-white/10 my-1" />
                    <div className="relative">
                        <button className="w-10 h-10 rounded-full border border-white/20" style={{ backgroundColor: currentColor }} onClick={() => setShowColorPicker(!showColorPicker)} />
                        {showColorPicker && <div className="absolute left-14 top-0 z-50"><HexColorPicker color={currentColor} onChange={setCurrentColor} /></div>}
                    </div>
                    <div className="h-32 glass-panel rounded-full flex items-center justify-center py-4">
                        <input type="range" min="1" max="50" value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value))} className="h-24 -rotate-90 w-2 accent-cyan-500" />
                    </div>
                    <button onClick={clearCanvas} className="glass-button p-3 rounded-xl text-red-400">X</button>
                </div>
            )}

            {/* CANVAS / INPUT */}
            <div className="flex-1 relative flex items-center justify-center" ref={containerRef}>
                {isWritingRound ? (
                    <textarea 
                        className="glass-input w-full max-w-lg h-64 p-6 text-2xl resize-none rounded-2xl outline-none"
                        placeholder="Type something..."
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        disabled={submitted}
                    />
                ) : (
                    <div className={`relative shadow-2xl rounded-sm overflow-hidden border border-white/5 ${submitted ? 'opacity-50 pointer-events-none' : ''}`}>
                         <canvas ref={canvasEl} />
                    </div>
                )}
            </div>

             {/* TRACE TOOLS */}
             {isDrawingRound && !submitted && (
                <div className="w-64 flex flex-col gap-3 z-10">
                    <div className="glass-panel p-4 rounded-xl flex flex-col gap-3">
                        <h3 className="text-xs font-bold text-zinc-500 uppercase">Trace Image</h3>
                        <div className="flex gap-2">
                            <input type="text" placeholder="URL..." className="glass-input flex-1 px-2 py-1 text-xs rounded-md" value={traceUrl} onChange={(e) => setTraceUrl(e.target.value)} />
                            <button onClick={handleAddTraceImage} className="bg-cyan-600 px-2 py-1 rounded-md text-xs">Add</button>
                        </div>
                        {traceImageObj && (
                            <button onClick={toggleTraceLock} className={`w-full py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 ${isTraceLocked ? "bg-yellow-500/20 text-yellow-400" : "bg-white/10"}`}>
                                <LockIcon locked={isTraceLocked} />
                                {isTraceLocked ? "Unlock" : "Lock & Trace"}
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>

        {/* SUBMIT */}
        <div className="mt-6 z-10">
            {!submitted ? (
                <button onClick={handleSubmit} disabled={isWritingRound && !inputText.trim()} className="glass-button px-12 py-4 text-xl font-bold bg-gradient-to-r from-violet-600 to-cyan-600 rounded-full hover:scale-105 transition-transform disabled:opacity-50">
                    SUBMIT ROUND
                </button>
            ) : (
                <div className="text-zinc-400 animate-pulse">Waiting for others...</div>
            )}
        </div>
      </main>
    </div>
  );
}