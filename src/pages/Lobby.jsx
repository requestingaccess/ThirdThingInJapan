import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { db, auth } from '../firebase';
import { ref, onValue, set, update, remove } from 'firebase/database';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import Game from './Game';
import Gallery from './Gallery';
import { usePresence } from '../hooks/usePresence';
import { Settings, ChevronUp, Copy, Check } from 'lucide-react';
import PlayerOrbit from '../components/PlayerOrbit';
import StartButton from '../components/StartButton';
import SettingsDeck from '../components/SettingsDeck';

const DEFAULT_SETTINGS = {
  timerMode: "MANUAL",
  baseTime: 60,
  startMode: "WRITE",
  ghostMode: true
};

function Lobby() {
  const { roomId } = useParams();
  
  // --- LOGIC & STATE ---
  const [players, setPlayers] = useState([]);
  const [gameStatus, setGameStatus] = useState("LOBBY");
  const [currentUser, setCurrentUser] = useState(null);
  const [needsToJoin, setNeedsToJoin] = useState(true);
  const [name, setName] = useState("");
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [view, setView] = useState('MAIN'); // 'MAIN' or 'SETTINGS'
  const [copied, setCopied] = useState(false);

  usePresence(roomId, auth.currentUser?.uid);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) setCurrentUser(user);
      else signInAnonymously(auth);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const playersRef = ref(db, `rooms/${roomId}/players`);
    const unsubPlayers = onValue(playersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const playerList = Object.values(data);
        playerList.sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));
        setPlayers(playerList);
        if (auth.currentUser) {
          const isHere = playerList.some(p => p.id === auth.currentUser.uid);
          setNeedsToJoin(!isHere);
        }
      } else {
        setPlayers([]);
        setNeedsToJoin(true);
      }
    });

    const statusRef = ref(db, `rooms/${roomId}/status`);
    const unsubStatus = onValue(statusRef, (snapshot) => {
      setGameStatus(snapshot.val() || "LOBBY");
    });

    const settingsRef = ref(db, `rooms/${roomId}/settings`);
    const unsubSettings = onValue(settingsRef, (snapshot) => {
      if (snapshot.exists()) {
        setSettings(prev => ({ ...DEFAULT_SETTINGS, ...snapshot.val() }));
      }
    });

    return () => { unsubPlayers(); unsubStatus(); unsubSettings(); };
  }, [roomId, currentUser]);

  const handleJoin = async () => {
    if (!name.trim()) return alert("Name required!");
    let uid = auth.currentUser?.uid;
    if (!uid) {
      const cred = await signInAnonymously(auth);
      uid = cred.user.uid;
    }
    const playerRef = ref(db, `rooms/${roomId}/players/${uid}`);
    await set(playerRef, {
      name: name,
      id: uid,
      avatar: name.charAt(0).toUpperCase(),
      joinedAt: Date.now()
    });
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Use 'currentUser' state variable instead of auth.currentUser for stability
  const isHost = players.length > 0 && currentUser && players[0].id === currentUser.uid;

  const updateSetting = (key, value) => {
      if (!isHost) return;
      update(ref(db, `rooms/${roomId}/settings`), { [key]: value });
  };

  const handleStartGame = async () => {
    if (players.length < 2) return alert("Need at least 2 players!");
    const shuffled = [...players].sort(() => Math.random() - 0.5);
    const order = shuffled.map(p => p.id);
    const initialBooks = {};
    players.forEach(p => { initialBooks[p.id] = true; });

    const updates = {};
    updates[`rooms/${roomId}/status`] = "PLAYING";
    updates[`rooms/${roomId}/round`] = 0;
    updates[`rooms/${roomId}/playerOrder`] = order;
    updates[`rooms/${roomId}/books`] = initialBooks;
    
    players.forEach(p => {
        updates[`rooms/${roomId}/players/${p.id}/submitted`] = null;
    });

    if (settings.timerMode === "DYNAMIC") {
        updates[`rooms/${roomId}/timerEnd`] = Date.now() + ((settings.baseTime || 60) * 1000);
    } else {
        updates[`rooms/${roomId}/timerEnd`] = null;
    }

    await update(ref(db), updates);
  };

  const handleResetGame = async () => {
    if (!isHost) return;
    const updates = {};
    updates[`rooms/${roomId}/status`] = "LOBBY";
    updates[`rooms/${roomId}/round`] = 0;
    updates[`rooms/${roomId}/timerEnd`] = null;
    updates[`rooms/${roomId}/books`] = null;
    players.forEach(p => {
        updates[`rooms/${roomId}/players/${p.id}/submitted`] = null;
    });
    await update(ref(db), updates);
  };


  // --- VIEW ROUTING ---
  if (needsToJoin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-zinc-950 text-white">
        <div className="glass-panel p-8 rounded-2xl max-w-md w-full text-center border border-white/10 bg-zinc-900/50">
          <h2 className="text-sm font-bold text-gray-400 mb-2 uppercase tracking-widest">Join Room</h2>
          <h3 className="text-3xl font-mono text-green-400 mb-8 tracking-widest">{roomId}</h3>
          <input 
            type="text" 
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full p-4 mb-4 text-center text-lg font-bold rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-green-500 transition-colors"
            placeholder="ENTER NICKNAME"
          />
          <button onClick={handleJoin} className="w-full py-4 rounded-xl font-bold bg-green-600 hover:bg-green-500 transition-colors text-black tracking-widest">
            JOIN GAME
          </button>
        </div>
      </div>
    );
  }

  if (gameStatus === "GALLERY") {
    return <Gallery roomId={roomId} players={players} currentUser={currentUser} onExit={handleResetGame} />;
  }

  if (gameStatus === "PLAYING") {
    return <Game roomId={roomId} players={players} currentUser={currentUser} settings={settings} />;
  }

  // --- THE ELEVATOR LOBBY ---
  return (
    <div className="h-screen w-screen overflow-hidden bg-[#0a0a0a] text-white relative font-sans selection:bg-cyan-500/30">
      
      {/* Background Blobs (Static for now, stays behind everything) */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
         <div className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] bg-violet-600/10 rounded-full blur-[120px]" />
         <div className="absolute bottom-[-20%] right-[-10%] w-[50vw] h-[50vw] bg-blue-600/10 rounded-full blur-[120px]" />
      </div>

      {/* THE SLIDING CONTAINER */}
      <div 
        className="w-full h-[200vh] transition-transform duration-700 ease-in-out will-change-transform flex flex-col"
        style={{ transform: view === 'SETTINGS' ? 'translateY(-50%)' : 'translateY(0)' }}
      >
        
        {/* === FLOOR 1: MAIN LOBBY === */}
        <section className="h-[100vh] w-full relative flex flex-col items-center justify-center p-8 shrink-0">
            
            {/* CENTER STAGE */}
            <div className="flex-1 w-full flex items-center justify-center relative">
                
                {/* 1. The Title Card */}
                {/* We assign z-40 explicitly to the text layer */}
                <div 
                    onClick={handleCopy}
                    className="relative group cursor-pointer flex flex-col items-center z-40"
                >
                    <div className="relative">
                        {/* THE CODE */}
                        <h1 className="text-[12rem] leading-none font-black tracking-tighter text-white drop-shadow-2xl select-none transition-transform duration-300 group-hover:scale-105 group-active:scale-95">
                            {roomId}
                        </h1>

                        {/* THE COPY BUTTON */}
                        {/* z-10 puts it behind the text (z-auto children stack naturally, but we can be explicit if needed) */}
                        <div className="absolute left-full top-1/2 -translate-y-1/2 ml-8 flex items-center gap-3 opacity-0 -translate-x-12 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-500 ease-out z-10 pointer-events-none group-hover:pointer-events-auto">
                            <div className={`
                                w-16 h-16 rounded-full flex items-center justify-center border backdrop-blur-md shadow-2xl
                                ${copied 
                                    ? 'bg-green-500 border-green-400 text-black' 
                                    : 'bg-zinc-800/80 border-white/20 text-white group-hover:bg-white group-hover:text-black'}
                                transition-colors duration-300
                            `}>
                                {copied ? <Check strokeWidth={4} /> : <Copy strokeWidth={2.5} />}
                            </div>
                            <div className="bg-white/10 px-4 py-2 rounded-lg backdrop-blur-md border border-white/10 text-xs font-bold uppercase tracking-widest whitespace-nowrap text-white">
                                {copied ? "Copied!" : "Copy Link"}
                            </div>
                        </div>
                    </div>

                    {/* THE LABEL */}
                    <p className="text-zinc-500 uppercase tracking-[0.8em] text-xs font-bold mt-6 animate-pulse">
                        Lobby Code
                    </p>
                </div>

                {/* 2. The Orbit Engine */}
                {/* z-index is handled internally by the component for each dot */}
                <PlayerOrbit players={players} />

            </div>

            {/* BOTTOM BAR: SETTINGS BUTTON & START */}
            <div className="h-32 w-full flex items-center justify-between max-w-6xl z-30 pointer-events-none">
                
                {/* SETTINGS (Left) - Enable pointer events */}
                <button 
                  onClick={() => setView('SETTINGS')}
                  className="group flex flex-col items-center gap-2 text-zinc-500 hover:text-white transition-colors pointer-events-auto"
                >
                    <Settings className="w-8 h-8 transition-transform group-hover:rotate-90 duration-500" strokeWidth={1.5} />
                    <span className="text-[10px] uppercase tracking-widest font-bold opacity-0 group-hover:opacity-100 transition-opacity transform translate-y-2 group-hover:translate-y-0">Settings</span>
                </button>

                {/* START BUTTON (Right) - Enable pointer events */}
                <div className="pointer-events-auto">
                    <StartButton 
                        playerCount={players.length} 
                        onStart={handleStartGame} 
                        isHost={isHost} 
                    />
                </div>
            </div>
        </section>


        {/* === FLOOR 2: SETTINGS === */}
        <section className="h-[100vh] w-full relative flex flex-col items-center p-8 shrink-0 bg-black/40 backdrop-blur-xl">
             
             {/* HEADER: RETURN BUTTON */}
             <div className="w-full max-w-4xl pt-8 pb-12 flex justify-start">
                <button 
                  onClick={() => setView('MAIN')}
                  className="flex items-center gap-3 text-zinc-500 hover:text-white transition-colors group"
                >
                    <div className="p-2 rounded-full border border-white/10 group-hover:bg-white group-hover:text-black transition-all">
                        <ChevronUp className="w-6 h-6" />
                    </div>
                    <span className="text-sm font-bold uppercase tracking-widest">Back to Lobby</span>
                </button>
             </div>

             {/* SETTINGS CONTENT */}
             <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-12">
                
                {/* SETTING 1: TIMER */}
                <div className="space-y-6">
                    <h3 className="text-2xl font-bold tracking-tight">Time Control</h3>
                    <div className="flex flex-col gap-3">
                        <button 
                            disabled={!isHost}
                            onClick={() => updateSetting("timerMode", "MANUAL")}
                            className={`p-6 rounded-2xl border text-left transition-all ${settings.timerMode === 'MANUAL' ? 'bg-white text-black border-white' : 'bg-zinc-900/50 border-white/5 hover:border-white/20'}`}
                        >
                            <div className="font-bold text-lg mb-1">Manual Mode</div>
                            <div className={`text-sm ${settings.timerMode === 'MANUAL' ? 'text-zinc-600' : 'text-zinc-500'}`}>Host ends rounds manually. Relaxed pace.</div>
                        </button>

                        <button 
                            disabled={!isHost}
                            onClick={() => updateSetting("timerMode", "DYNAMIC")}
                            className={`p-6 rounded-2xl border text-left transition-all ${settings.timerMode === 'DYNAMIC' ? 'bg-green-500 text-black border-green-500' : 'bg-zinc-900/50 border-white/5 hover:border-white/20'}`}
                        >
                            <div className="font-bold text-lg mb-1">Dynamic Mode</div>
                            <div className={`text-sm ${settings.timerMode === 'DYNAMIC' ? 'text-green-900' : 'text-zinc-500'}`}>Timer decreases every round. High pressure.</div>
                        </button>
                    </div>
                </div>

                {/* SETTING 2: ANONYMITY */}
                <div className="space-y-6">
                    <h3 className="text-2xl font-bold tracking-tight">Visibility</h3>
                    <button 
                        disabled={!isHost}
                        onClick={() => updateSetting("ghostMode", !settings.ghostMode)}
                        className={`w-full p-6 rounded-2xl border text-left transition-all flex items-center justify-between ${settings.ghostMode ? 'bg-violet-500 text-white border-violet-500' : 'bg-zinc-900/50 border-white/5 hover:border-white/20'}`}
                    >
                        <div>
                            <div className="font-bold text-lg mb-1">Ghost Mode</div>
                            <div className="text-sm opacity-80">
                                {settings.ghostMode ? "Names are hidden during voting." : "Names are always visible."}
                            </div>
                        </div>
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${settings.ghostMode ? 'border-white bg-white/20' : 'border-zinc-600'}`}>
                            {settings.ghostMode && <div className="w-3 h-3 bg-white rounded-full" />}
                        </div>
                    </button>
                </div>

             </div>
        </section>

      </div>
    </div>
  );
}

export default Lobby;