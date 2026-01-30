import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { db, auth } from '../firebase';
import { ref, onValue, set, update, remove } from 'firebase/database';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import Game from './Game';
import { usePresence } from '../hooks/usePresence';

const DEFAULT_SETTINGS = {
  timerMode: "MANUAL",
  baseTime: 60,
  startMode: "WRITE",
  ghostMode: true
};

function Lobby() {
  const { roomId } = useParams();
  
  const [players, setPlayers] = useState([]);
  const [gameStatus, setGameStatus] = useState("LOBBY");
  const [currentUser, setCurrentUser] = useState(null);
  const [needsToJoin, setNeedsToJoin] = useState(true);
  const [name, setName] = useState("");
  const [showSettings, setShowSettings] = useState(true);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [copied, setCopied] = useState(false); // For Copy Feedback

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
      const status = snapshot.val();
      if (status) setGameStatus(status);
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

  const isHost = players.length > 0 && auth.currentUser && players[0].id === auth.currentUser.uid;

  const updateSetting = (key, value) => {
      if (!isHost) return;
      update(ref(db, `rooms/${roomId}/settings`), { [key]: value });
  };

  const handleKick = (playerId) => {
    if (!confirm("Kick this player?")) return;
    remove(ref(db, `rooms/${roomId}/players/${playerId}`));
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
    
    if (settings.timerMode === "DYNAMIC") {
        updates[`rooms/${roomId}/timer`] = settings.baseTime || 60;
    }

    await update(ref(db), updates);
  };

  const copyLink = () => {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
  };


  if (needsToJoin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="glass-panel p-8 rounded-2xl max-w-md w-full text-center">
          <h2 className="text-sm font-bold text-gray-400 mb-2 uppercase tracking-widest">Join Room</h2>
          <h3 className="text-3xl font-mono text-green-400 mb-8">{roomId}</h3>
          <input 
            type="text" 
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="glass-input w-full p-4 mb-4 text-center text-lg font-bold rounded-xl"
            placeholder="ENTER NICKNAME"
          />
          <button onClick={handleJoin} className="glass-button-primary w-full py-4 rounded-xl font-bold">
            JOIN GAME
          </button>
        </div>
      </div>
    );
  }

  if (gameStatus === "PLAYING") {
    return <Game roomId={roomId} players={players} currentUser={currentUser} settings={settings} />;
  }

  return (
    <div className="min-h-screen p-8 flex flex-col items-center">
      <div className="max-w-5xl w-full">
        
        {/* --- HEADER (Copy Link Added) --- */}
        <div className="text-center mb-12">
          <div className="inline-block glass-panel px-6 py-2 rounded-full mb-4">
            <span className="text-xs font-bold text-gray-500 tracking-[0.3em]">LOBBY</span>
          </div>
          
          <div 
             className="relative inline-block group cursor-pointer"
             onClick={copyLink}
          >
              <h1 className="text-7xl font-black text-white tracking-tighter drop-shadow-2xl transition-all group-hover:text-green-400">
                  {roomId}
              </h1>
              
              {/* Sliding Copy Button */}
              <div className="absolute top-0 -right-12 h-full flex items-center opacity-0 transform -translate-x-4 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0">
                  <div className="bg-white/10 p-2 rounded-lg backdrop-blur-md border border-white/20">
                      {copied ? (
                          <span className="text-green-400 font-bold text-xs">COPIED</span>
                      ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                      )}
                  </div>
              </div>
              <div className="text-xs text-gray-500 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  Click code to copy link
              </div>
          </div>
        </div>

        {/* Players Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
          {players.map((player) => (
            <div key={player.id} className={`glass-panel p-6 rounded-2xl flex flex-col items-center transition-all relative group ${player.presence?.state === 'offline' ? 'opacity-50 border-red-500/30' : 'hover:bg-white/5'}`}>
              
              {isHost && player.id !== currentUser.uid && (
                <button 
                    onClick={(e) => { e.stopPropagation(); handleKick(player.id); }}
                    className="absolute top-2 right-2 w-6 h-6 bg-red-500/20 hover:bg-red-500 text-red-500 hover:text-white rounded-full flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100"
                    title="Kick Player"
                >
                    ×
                </button>
              )}

              <div className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl font-black mb-4 shadow-inner ${player.presence?.state === 'offline' ? 'bg-red-500/20 text-red-400' : 'bg-gradient-to-br from-blue-500/20 to-purple-500/20 text-blue-300'}`}>
                {player.avatar}
              </div>
              <h3 className="font-bold text-lg tracking-wide">{player.name}</h3>
              
              {player.presence?.state === 'offline' && <span className="text-xs text-red-500 font-bold mt-2 px-2 py-1 bg-red-500/10 rounded">DISCONNECTED</span>}
              {player.id === auth.currentUser?.uid && <span className="text-xs text-green-400 mt-2 font-mono">[YOU]</span>}
              {players[0].id === player.id && <span className="text-xs text-yellow-500 mt-2 font-mono">[HOST]</span>}
            </div>
          ))}
        </div>

        {/* --- GAME SETTINGS --- */}
        <div className="glass-panel rounded-2xl mb-12 max-w-3xl mx-auto text-left relative overflow-hidden transition-all duration-300">
            <div 
                onClick={() => setShowSettings(!showSettings)}
                className="p-6 flex justify-between items-center cursor-pointer hover:bg-white/5"
            >
                <h3 className="text-lg font-bold text-white">
                    Game Settings {isHost ? "" : "(View Only)"}
                </h3>
                <span className={`text-gray-400 transition-transform duration-300 ${showSettings ? 'rotate-180' : ''}`}>▼</span>
            </div>

            <div className={`px-6 pb-6 transition-all duration-300 overflow-hidden ${showSettings ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-4 border-t border-white/10">
                    
                    <div>
                    <label className="block text-xs text-gray-400 font-bold mb-3 uppercase">Timer Mode</label>
                    <div className="flex flex-col gap-2">
                        {["MANUAL", "DYNAMIC"].map(mode => (
                             <button key={mode} disabled={!isHost} onClick={() => updateSetting("timerMode", mode)}
                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all border ${settings.timerMode === mode ? "bg-green-500/20 border-green-500 text-green-300" : "bg-white/5 border-white/5 text-gray-400 hover:bg-white/10"}`}>
                                {mode === "MANUAL" ? "Manual (No Limit)" : "Dynamic Speed"}
                            </button>
                        ))}
                        {settings.timerMode === "DYNAMIC" && (
                            <div className="mt-2">
                                <label className="text-[10px] text-gray-500 uppercase font-bold">Base Seconds</label>
                                <input type="number" disabled={!isHost} value={settings.baseTime || 60}
                                    onChange={(e) => updateSetting("baseTime", parseInt(e.target.value) || 60)}
                                    className="glass-input w-full p-2 text-center font-bold text-sm rounded mt-1" />
                            </div>
                        )}
                    </div>
                    </div>

                    <div>
                    <label className="block text-xs text-gray-400 font-bold mb-3 uppercase">First Round</label>
                    <div className="flex flex-col gap-2">
                        <button disabled={!isHost} onClick={() => updateSetting("startMode", "WRITE")}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all border ${settings.startMode === "WRITE" ? "bg-blue-500/20 border-blue-500 text-blue-300" : "bg-white/5 border-white/5 text-gray-400 hover:bg-white/10"}`}>
                            Write a Prompt
                        </button>
                        <button disabled={!isHost} onClick={() => updateSetting("startMode", "DRAW")}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all border ${settings.startMode === "DRAW" ? "bg-purple-500/20 border-purple-500 text-purple-300" : "bg-white/5 border-white/5 text-gray-400 hover:bg-white/10"}`}>
                            Draw Anything
                        </button>
                    </div>
                    </div>

                    <div>
                    <label className="block text-xs text-gray-400 font-bold mb-3 uppercase">Anonymity</label>
                    <button disabled={!isHost} onClick={() => updateSetting("ghostMode", !settings.ghostMode)}
                        className={`w-full py-3 rounded-lg text-sm font-bold transition-all border flex items-center justify-center gap-2 ${settings.ghostMode ? "bg-gray-700/50 border-gray-500 text-gray-200" : "bg-white/5 border-white/5 text-gray-500 hover:bg-white/10"}`}>
                        {settings.ghostMode ? "Names Hidden" : "Names Visible"}
                    </button>
                    </div>

                </div>
            </div>
        </div>

        {/* --- SATISFYING START BUTTON --- */}
        <div className="text-center pb-20">
          {isHost ? (
            <button 
              onClick={handleStartGame}
              className="btn-satisfying px-20 py-8 text-2xl shadow-2xl"
            >
              START GAME
            </button>
          ) : (
            <div className="flex flex-col items-center gap-2 opacity-50 animate-pulse">
               <div className="w-2 h-2 bg-green-500 rounded-full"></div>
               <span className="text-xs tracking-widest uppercase">Waiting for Host...</span>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

export default Lobby;