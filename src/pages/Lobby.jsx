import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { db, auth } from '../firebase';
import { ref, onValue, set, update } from 'firebase/database';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import Game from './Game'; // <--- We will create this file next!

function Lobby() {
  const { roomId } = useParams();
  const [players, setPlayers] = useState([]);
  const [gameStatus, setGameStatus] = useState("LOBBY");
  const [currentUser, setCurrentUser] = useState(null);
  const [needsToJoin, setNeedsToJoin] = useState(true);
  const [name, setName] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
      } else {
        signInAnonymously(auth);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const playersRef = ref(db, `rooms/${roomId}/players`);
    const unsubscribePlayers = onValue(playersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const playerList = Object.values(data);
        
        // --- BUG FIX: SORT BY JOIN TIME ---
        // If joinedAt is missing (Host), treat it as 0.
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
    const unsubscribeStatus = onValue(statusRef, (snapshot) => {
      const status = snapshot.val();
      if (status) setGameStatus(status);
    });

    return () => {
      unsubscribePlayers();
      unsubscribeStatus();
    };
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
      joinedAt: Date.now() // --- FIX: Add Timestamp ---
    });
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

    try {
      await update(ref(db), updates);
    } catch (e) {
      console.error("Start failed", e);
      alert("Failed to start game");
    }
  };

  const isHost = players.length > 0 && auth.currentUser && players[0].id === auth.currentUser.uid;

  if (needsToJoin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4">
        <div className="bg-white p-8 rounded-xl max-w-md w-full text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">You've been invited!</h2>
          <h3 className="text-xl text-purple-600 font-mono mb-6">Room: {roomId}</h3>
          <input 
            type="text" 
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full p-3 border-2 border-gray-300 rounded-lg mb-4 text-lg font-bold"
            placeholder="Enter your nickname..."
          />
          <button onClick={handleJoin} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-lg">
            JOIN GAME
          </button>
        </div>
      </div>
    );
  }

  // --- PHASE 4 INTEGRATION ---
  if (gameStatus === "PLAYING") {
    // We pass the Room ID and the Player List to the Game component
    return <Game roomId={roomId} players={players} currentUser={currentUser} />;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto text-center">
        <h2 className="text-xl text-gray-400 mb-2">ROOM CODE</h2>
        <h1 className="text-6xl font-black text-yellow-400 tracking-widest mb-12">{roomId}</h1>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          {players.map((player) => (
            <div key={player.id} className="bg-gray-800 p-6 rounded-xl border-2 border-gray-700">
              <div className="w-16 h-16 bg-blue-500 rounded-full mx-auto mb-4 flex items-center justify-center text-2xl font-bold">
                {player.avatar}
              </div>
              <h3 className="font-bold text-lg truncate">{player.name}</h3>
              {player.id === auth.currentUser?.uid && <span className="text-xs text-green-400">(You)</span>}
              {players[0].id === player.id && <span className="block text-xs text-yellow-500 mt-1">HOST</span>}
            </div>
          ))}
        </div>

        {isHost ? (
            <button 
                onClick={handleStartGame}
                className="bg-green-500 hover:bg-green-600 text-white text-2xl font-black py-4 px-12 rounded-full shadow-lg transform transition hover:scale-105 active:scale-95"
            >
                START GAME
            </button>
        ) : (
            <div className="text-gray-400 animate-pulse">
                Waiting for host to start...
            </div>
        )}
      </div>
    </div>
  );
}

export default Lobby;