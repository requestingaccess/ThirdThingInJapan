import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { signInAnonymously } from 'firebase/auth';
import { ref, update } from 'firebase/database'; // Changed to 'update'
import { generateRoomCode } from '../utils';

function Home() {
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const navigate = useNavigate();

  const enterRoom = async (code) => {
    if (!name.trim()) return alert("Please enter a nickname!");
    
    try {
      const userCredential = await signInAnonymously(auth);
      const userId = userCredential.user.uid;

      // Prepare updates for Player AND Default Settings
      const updates = {};
      
      // 1. Add Player
      updates[`rooms/${code}/players/${userId}`] = {
        name: name,
        id: userId,
        avatar: name.charAt(0).toUpperCase(),
        joinedAt: Date.now()
      };

      // 2. Set Default Settings (Only does anything if room is new, but safe to run)
      updates[`rooms/${code}/settings`] = {
        timerMode: "MANUAL",
        baseTime: 60,
        startMode: "WRITE",
        ghostMode: true
      };

      await update(ref(db), updates);
      navigate(`/room/${code}`);
    } catch (error) {
      console.error(error);
      alert("Error: " + error.message);
    }
  };

  const handleCreate = async () => {
    const newCode = generateRoomCode();
    await enterRoom(newCode);
  };

  const handleJoin = async () => {
    if (roomCode.length !== 4) return alert("Invalid room code!");
    await enterRoom(roomCode.toUpperCase());
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="glass-panel p-10 rounded-3xl max-w-md w-full relative overflow-hidden">
        
        {/* Decorative Top Line */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 to-blue-600 opacity-50"></div>

        <h1 className="text-4xl font-black text-center mb-10 tracking-tighter">
          THIRD<span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-blue-500">THING</span>
          <br /><span className="text-xl font-light tracking-[0.5em] text-gray-400">INJAPAN</span>
        </h1>

        <div className="space-y-6">
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-widest">Your Name</label>
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="glass-input w-full p-4 rounded-xl font-bold text-lg text-center"
              placeholder="ENTER NAME"
            />
          </div>

          <button 
            onClick={handleCreate}
            className="glass-button-primary w-full py-4 rounded-xl transition transform hover:scale-[1.02]"
          >
            CREATE NEW ROOM
          </button>
          
          <div className="flex items-center gap-4 opacity-50">
            <div className="h-px bg-white/20 flex-1"></div>
            <span className="text-xs uppercase tracking-widest">OR</span>
            <div className="h-px bg-white/20 flex-1"></div>
          </div>

          <div className="flex gap-3">
            <input 
              type="text" 
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value)}
              className="glass-input flex-1 p-4 rounded-xl font-mono text-center uppercase text-xl tracking-widest"
              placeholder="CODE"
              maxLength={4}
            />
            <button 
              onClick={handleJoin}
              className="glass-button px-8 rounded-xl"
            >
              JOIN
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Home;