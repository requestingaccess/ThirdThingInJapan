import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { ref, onValue, set, update, get } from 'firebase/database';
import CanvasDraw from "react-canvas-draw";
import Gallery from './Gallery';

function Game({ roomId, players, currentUser, settings }) {
  const [round, setRound] = useState(0);
  const [promptText, setPromptText] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [prevData, setPrevData] = useState(null); 
  const [currentBooks, setCurrentBooks] = useState({});
  const [timeLeft, setTimeLeft] = useState(null);
  const [penaltyTrigger, setPenaltyTrigger] = useState(false); // For Animation
  const canvasRef = useRef(null);

  const isHost = players[0]?.id === currentUser.uid;
  const isDrawRound = settings.startMode === "DRAW" ? (round % 2 === 0) : (round % 2 !== 0);

  // 1. Listen for Round Updates
  useEffect(() => {
    const roundRef = ref(db, `rooms/${roomId}/round`);
    const unsubscribe = onValue(roundRef, (snapshot) => {
      const r = snapshot.val();
      if (r !== null) {
        setRound(r);
        setSubmitted(false);
        setPromptText("");
        setPrevData(null);
        if (isHost && settings.timerMode === "DYNAMIC") {
             update(ref(db, `rooms/${roomId}`), { timer: settings.baseTime || 60 });
        }
      }
    });
    return () => unsubscribe();
  }, [roomId, isHost, settings.timerMode, settings.baseTime]);

  // 2. Listen for Timer (And Trigger Animation)
  useEffect(() => {
      if (settings.timerMode !== "DYNAMIC") return;
      
      const timerRef = ref(db, `rooms/${roomId}/timer`);
      let lastTime = null;

      const unsub = onValue(timerRef, (snap) => {
          const newTime = snap.val();
          
          // Detect Penalty (Drop > 1 second)
          if (lastTime !== null && (lastTime - newTime) > 2) {
              setPenaltyTrigger(true);
              setTimeout(() => setPenaltyTrigger(false), 600);
          }
          
          lastTime = newTime;
          setTimeLeft(newTime);
      });
      return () => unsub();
  }, [roomId, settings.timerMode]);

  // 3. HOST: Run the Timer Logic
  useEffect(() => {
    if (!isHost || settings.timerMode !== "DYNAMIC") return;

    const interval = setInterval(() => {
        setTimeLeft(prev => {
            const newVal = (prev || settings.baseTime) - 1;
            update(ref(db, `rooms/${roomId}`), { timer: newVal });
            
            if (newVal <= 0) {
                 update(ref(db), { [`rooms/${roomId}/round`]: round + 1 });
                 return settings.baseTime;
            }
            return newVal;
        });
    }, 1000);
    return () => clearInterval(interval);
  }, [isHost, settings.timerMode, round, roomId]);

  // 4. HOST: Check Books & Speed Up
  useEffect(() => {
    const booksRef = ref(db, `rooms/${roomId}/books`);
    let previousCount = 0;

    const unsubscribe = onValue(booksRef, (snapshot) => {
        const data = snapshot.val() || {};
        setCurrentBooks(data);
        
        if (isHost) {
            let submitCount = 0;
            let allDone = true;
            players.forEach(p => {
                if (data[p.id] && data[p.id][round]) submitCount++;
                else allDone = false;
            });

            if (allDone) {
                setTimeout(() => {
                    update(ref(db), { [`rooms/${roomId}/round`]: round + 1 });
                }, 1000);
            } 
            else if (settings.timerMode === "DYNAMIC" && submitCount > previousCount) {
                // Someone submitted -> Drop time by 10%
                get(ref(db, `rooms/${roomId}/timer`)).then(snap => {
                    const currentT = snap.val();
                    // SAFETY: Don't drop below 10 seconds unless it was ALREADY low
                    if (currentT > 10) { 
                        const reduction = Math.floor(currentT * 0.90);
                        const safeTime = Math.max(reduction, 10); // Floor at 10s
                        update(ref(db, `rooms/${roomId}`), { timer: safeTime });
                    }
                });
            }
            previousCount = submitCount;
        }
    });
    return () => unsubscribe();
  }, [roomId, isHost, round, players, settings.timerMode]);


  // ... Previous Fetch Data & Submit Logic ...
  useEffect(() => {
    if (round === 0) return;
    const myIndex = players.findIndex(p => p.id === currentUser.uid);
    const ownerIndex = (myIndex + round) % players.length;
    const ownerId = players[ownerIndex].id;
    const prevRound = round - 1;

    get(ref(db, `rooms/${roomId}/books/${ownerId}/${prevRound}`)).then((snapshot) => {
       if (snapshot.exists()) setPrevData(snapshot.val());
    });
  }, [round, players, currentUser, roomId]);

  const handleSubmit = async () => {
    if (!currentUser) return;
    const myIndex = players.findIndex(p => p.id === currentUser.uid);
    const ownerIndex = (myIndex + round) % players.length;
    const ownerId = players[ownerIndex].id;
    const entryRef = ref(db, `rooms/${roomId}/books/${ownerId}/${round}`);

    if (!isDrawRound) {
       await set(entryRef, { type: "PROMPT", value: promptText || "...", author: currentUser.uid });
    } else {
        const drawingData = canvasRef.current.getSaveData();
        await set(entryRef, { type: "DRAWING", value: drawingData, author: currentUser.uid });
    }
    setSubmitted(true);
  };

  // ... Smart Enforcer (Copied from previous step) ...
  useEffect(() => {
    if (!isHost) return;
    const interval = setInterval(() => {
        const pendingPlayers = players.filter(p => {
            const pIndex = players.findIndex(pl => pl.id === p.id);
            const ownerIndex = (pIndex + round) % players.length;
            const ownerId = players[ownerIndex].id;
            const hasSubmitted = currentBooks[ownerId] && currentBooks[ownerId][round];
            return !hasSubmitted;
        });

        pendingPlayers.forEach(p => {
            if (p.presence?.state === 'offline') {
                const lastSeen = p.presence.last_changed || Date.now();
                const timeoutLimit = (pendingPlayers.length === 1) ? 5000 : 60000;
                if (Date.now() - lastSeen > timeoutLimit) {
                    const pIndex = players.findIndex(pl => pl.id === p.id);
                    const ownerIndex = (pIndex + round) % players.length;
                    const ownerId = players[ownerIndex].id;
                    if (!currentBooks[ownerId] || !currentBooks[ownerId][round]) {
                        get(ref(db, `rooms/${roomId}/books/${ownerId}/${round - 1}`)).then((prevSnap) => {
                            const prev = prevSnap.val();
                            let skipValue = "DISCONNECTED"; 
                            if (prev) skipValue = prev.value;
                            set(ref(db, `rooms/${roomId}/books/${ownerId}/${round}`), {
                                type: "SKIPPED", value: skipValue, author: p.id
                            });
                        });
                    }
                }
            }
        });
    }, 1000); 
    return () => clearInterval(interval);
  }, [isHost, players, round, roomId, currentBooks]);


  // --- VIEW RENDERING ---
  const isSkipped = prevData?.type === "SKIPPED";
  const displayValue = isSkipped ? prevData.value : (prevData?.value || "...");
  const previousAuthorName = players.find(p => p.id === prevData?.author)?.name || "Unknown";
  
  const myIndex = players.findIndex(p => p.id === currentUser.uid);
  const ownerIndex = (myIndex + round) % players.length;
  const ownerOfCurrentBook = players[ownerIndex];
  const bookOwnerName = settings.ghostMode ? "???" : ownerOfCurrentBook?.name;

  if (round >= players.length) return <Gallery roomId={roomId} players={players} />;
  
  if (submitted) return (
      <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
              <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
              <h2 className="text-2xl font-bold tracking-widest text-green-500">WAITING FOR PLAYERS...</h2>
              {settings.timerMode === "DYNAMIC" && timeLeft !== null && (
                  <div className="mt-4 text-4xl font-mono text-white opacity-50">{timeLeft}s</div>
              )}
          </div>
      </div>
  );

  // Helper for Timer UI
  const TimerDisplay = () => (
      settings.timerMode === "DYNAMIC" && timeLeft !== null && (
        <div className={`absolute top-6 right-6 text-3xl font-mono font-bold transition-transform ${timeLeft < 10 ? 'text-red-500 animate-pulse' : 'text-gray-500'} ${penaltyTrigger ? 'animate-penalty' : ''}`}>
            {timeLeft}s
        </div>
      )
  );

  // --- ROUND 0 ---
  if (round === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <TimerDisplay />
        <div className="glass-panel p-8 rounded-2xl w-full max-w-lg text-center">
          <h2 className="text-sm font-bold text-gray-400 mb-6 tracking-[0.2em] uppercase">
            Round 0: {settings.startMode === "DRAW" ? "Draw Anything" : "Write a Prompt"}
          </h2>
          
          {settings.startMode === "DRAW" ? (
             <div className="flex flex-col items-center">
                <div className="bg-white rounded-lg overflow-hidden mb-4">
                    <CanvasDraw ref={canvasRef} brushRadius={3} lazyRadius={0} canvasWidth={350} canvasHeight={350} />
                </div>
                <button onClick={() => canvasRef.current.clear()} className="glass-button-danger w-full py-2 mb-2 rounded-xl">CLEAR</button>
             </div>
          ) : (
             <input type="text" className="glass-input w-full text-2xl font-bold p-6 text-center rounded-xl mb-6" placeholder="Start a story..." value={promptText} onChange={(e) => setPromptText(e.target.value)} autoFocus />
          )}
          <button onClick={handleSubmit} className="glass-button-primary w-full py-4 rounded-xl text-lg">DONE</button>
        </div>
      </div>
    );
  }

  // --- NORMAL GAME LOOP ---
  if (!isDrawRound) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4">
            <TimerDisplay />
            <h2 className="text-sm font-bold text-gray-400 mb-4 tracking-[0.2em] uppercase">
                Guess what {settings.ghostMode ? "???" : previousAuthorName} drew
            </h2>
            {isSkipped && <div className="bg-red-500/20 border border-red-500/50 text-red-200 p-4 rounded-lg mb-4 max-w-md text-center text-xs font-bold">PLAYER DISCONNECTED: DISPLAYING PREVIOUS DATA</div>}
            
            <div className="glass-panel p-2 rounded-xl mb-6 overflow-hidden">
                <div className="bg-white rounded-lg overflow-hidden flex items-center justify-center h-[350px] w-[350px]">
                    {prevData?.type === "DRAWING" ? (
                        <CanvasDraw disabled hideGrid saveData={prevData.value} canvasWidth={350} canvasHeight={350} />
                    ) : (
                        <div className="p-10 text-3xl font-black text-black text-center">{displayValue}</div>
                    )}
                </div>
            </div>
            <div className="glass-panel p-6 rounded-xl w-full max-w-md">
                <input type="text" className="glass-input w-full text-xl font-bold p-4 text-center rounded-lg mb-4" placeholder="What is this?" value={promptText} onChange={(e) => setPromptText(e.target.value)} autoFocus />
                <button onClick={handleSubmit} className="glass-button-primary w-full py-3 rounded-lg">SUBMIT</button>
            </div>
        </div>
      );
  } else {
      return (
        <div className="min-h-screen flex flex-col items-center py-6">
            <TimerDisplay />
            <h2 className="text-sm font-bold text-gray-400 mb-4 tracking-[0.2em] uppercase">
                Draw for {bookOwnerName}
            </h2>
            {isSkipped && <div className="text-red-400 text-xs font-bold mb-2 tracking-widest">⚠ CONNECTION INTERRUPTED - PROMPT PASSED</div>}
            <div className="glass-panel px-8 py-4 rounded-full mb-6 border-green-500/30 bg-green-500/10 max-w-md text-center">
                <p className="text-xl font-bold text-green-300 uppercase tracking-wide">{displayValue}</p>
            </div>
            <div className="glass-panel p-2 rounded-xl mb-6">
                <div className="bg-white rounded-lg overflow-hidden">
                    <CanvasDraw ref={canvasRef} brushRadius={3} lazyRadius={0} canvasWidth={350} canvasHeight={350} />
                </div>
            </div>
            <div className="flex gap-4 w-full max-w-[350px]">
                <button onClick={() => canvasRef.current.clear()} className="glass-button-danger flex-1 py-4 rounded-xl font-bold">CLEAR</button>
                <button onClick={handleSubmit} className="glass-button-primary flex-1 py-4 rounded-xl font-bold">DONE</button>
            </div>
        </div>
      );
  }
}

export default Game;