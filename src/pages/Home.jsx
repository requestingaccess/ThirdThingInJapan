import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { signInAnonymously } from 'firebase/auth';
import { ref, update } from 'firebase/database';
import { generateRoomCode } from '../utils';
import { ArrowRight, Plus, Hash } from 'lucide-react';
import { motion } from 'framer-motion';

function Home() {
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const navigate = useNavigate();

  const enterRoom = async (code, isCreating = false) => {
    if (!name.trim()) return alert("Please enter a name.");
    
    try {
      const userCredential = await signInAnonymously(auth);
      const userId = userCredential.user.uid;
      const updates = {};

      // 1. Add Player
      updates[`rooms/${code}/players/${userId}`] = {
        name: name,
        id: userId,
        avatar: name.charAt(0).toUpperCase(),
        joinedAt: Date.now()
      };

      // 2. If Creating, RESET room state
      if (isCreating) {
        updates[`rooms/${code}/status`] = "LOBBY";
        updates[`rooms/${code}/round`] = 0;
        updates[`rooms/${code}/settings`] = {
            timerMode: "MANUAL",
            baseTime: 60,
            startMode: "WRITE",
            ghostMode: true
        };
        updates[`rooms/${code}/books`] = null;
        updates[`rooms/${code}/timerEnd`] = null;
      }

      await update(ref(db), updates);
      navigate(`/room/${code}`);
    } catch (error) {
      console.error(error);
      alert("Connection error: " + error.message);
    }
  };

  const handleCreate = async () => {
    const newCode = generateRoomCode();
    await enterRoom(newCode, true);
  };

  const handleJoin = async () => {
    if (roomCode.length !== 4) return;
    await enterRoom(roomCode.toUpperCase(), false);
  };

  return (
    <div className="min-h-screen w-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center relative overflow-hidden selection:bg-cyan-500/30 font-sans">
      
      {/* 1. BACKGROUND BLOBS (Subtle) */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
         <div className="absolute top-[-20%] left-[-10%] w-[60vw] h-[60vw] bg-violet-600/05 rounded-full blur-[120px]" />
         <div className="absolute bottom-[-20%] right-[-10%] w-[60vw] h-[60vw] bg-cyan-600/05 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-4xl px-6 flex flex-col items-center gap-16">
        
        {/* 2. NEW TITLE CARD (Architectural Lockup) */}
        <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="flex flex-col items-center"
        >
            <h1 className="text-5xl md:text-8xl font-bold tracking-tight text-white leading-none">
                ThirdThing
            </h1>
            <span className="text-xl md:text-3xl font-light text-zinc-500 tracking-[0.2em] mt-2 uppercase">
                In Japan
            </span>
        </motion.div>

        {/* 3. INPUT CARD */}
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="w-full max-w-md flex flex-col gap-4"
        >
            
            {/* NAME INPUT */}
            <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-zinc-900 border border-white/10 text-center text-white placeholder-zinc-600 font-bold text-lg py-4 rounded-2xl focus:outline-none focus:border-white/30 focus:bg-zinc-800 transition-all shadow-lg"
                placeholder="Enter Name"
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* CREATE BUTTON */}
                <button 
                    onClick={handleCreate}
                    className="group relative h-16 bg-white text-black rounded-2xl flex items-center justify-center gap-2 hover:bg-zinc-200 transition-colors shadow-lg shadow-white/5"
                >
                    <span className="font-bold tracking-wide">CREATE ROOM</span>
                    <Plus size={20} strokeWidth={3} />
                </button>

                {/* JOIN WIDGET */}
                <div className="relative h-16 bg-zinc-900 border border-white/10 rounded-2xl flex items-center p-1 focus-within:border-white/30 transition-colors">
                    <div className="pl-4 pr-2 text-zinc-600">
                        <Hash size={18} />
                    </div>
                    <input 
                        type="text" 
                        value={roomCode}
                        onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                        maxLength={4}
                        className="w-full bg-transparent text-white font-bold text-lg placeholder-zinc-700 outline-none uppercase tracking-widest"
                        placeholder="CODE"
                    />
                    <button 
                        onClick={handleJoin}
                        disabled={roomCode.length !== 4}
                        className="h-full aspect-square bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl flex items-center justify-center transition-all disabled:opacity-30 disabled:hover:bg-zinc-800"
                    >
                        <ArrowRight size={20} />
                    </button>
                </div>

            </div>

        </motion.div>

      </div>
    </div>
  );
}

export default Home;