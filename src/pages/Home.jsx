import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { signInAnonymously } from 'firebase/auth';
import { ref, set } from 'firebase/database';
import { generateRoomCode } from '../utils';

function Home() {
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const navigate = useNavigate();

  // Helper: Logs the user in and saves their name to the room
  const enterRoom = async (code) => {
    if (!name.trim()) return alert("Please enter a nickname!");
    
    try {
      // 1. Log in anonymously
      const userCredential = await signInAnonymously(auth);
      const userId = userCredential.user.uid;

      // 2. Add player to the database WITH TIMESTAMP
      const playerRef = ref(db, `rooms/${code}/players/${userId}`);
      await set(playerRef, {
        name: name,
        id: userId,
        avatar: name.charAt(0).toUpperCase(),
        joinedAt: Date.now() // <--- CRITICAL FIX: Ensures Host is always "oldest"
      });

      // 3. Go to the lobby
      navigate(`/room/${code}`);
    } catch (error) {
      console.error(error);
      alert("Error joining room: " + error.message);
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
    <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4">
      <div className="bg-white p-8 rounded-xl max-w-md w-full shadow-2xl">
        <h1 className="text-3xl font-black text-center mb-8 text-gray-800">
          ARTIC<span className="text-purple-600">PHONE</span>
        </h1>

        {/* Name Input */}
        <div className="mb-6">
          <label className="block text-sm font-bold text-gray-700 mb-2">YOUR NAME</label>
          <input 
            type="text" 
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 outline-none font-bold text-lg"
            placeholder="e.g. Dr. Zoidberg"
          />
        </div>

        {/* Buttons */}
        <div className="space-y-4">
          <button 
            onClick={handleCreate}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition transform hover:scale-105"
          >
            CREATE NEW ROOM
          </button>
          
          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-gray-300"></div>
            <span className="flex-shrink mx-4 text-gray-400">OR</span>
            <div className="flex-grow border-t border-gray-300"></div>
          </div>

          <div className="flex gap-2">
            <input 
              type="text" 
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value)}
              className="flex-1 p-3 border-2 border-gray-300 rounded-lg focus:border-purple-500 outline-none font-mono text-center uppercase font-bold"
              placeholder="CODE"
              maxLength={4}
            />
            <button 
              onClick={handleJoin}
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-6 rounded-lg"
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