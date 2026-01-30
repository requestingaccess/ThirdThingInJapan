import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { ref, onValue, set, update } from 'firebase/database';
import CanvasDraw from "react-canvas-draw";
import Gallery from './Gallery';

function Game({ roomId, players, currentUser }) {
  const [round, setRound] = useState(0);
  const [promptText, setPromptText] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [prevData, setPrevData] = useState(null); // The data we need to see (Drawing or Text)
  const canvasRef = useRef(null);

  const isHost = players[0]?.id === currentUser.uid;

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
      }
    });
    return () => unsubscribe();
  }, [roomId]);

  // 2. Fetch the "Previous Page" data (The Rotation Logic)
  useEffect(() => {
    if (round === 0) return; // Round 0 has no previous data

    // LOGIC: Who owns the book I am currently holding?
    // My Index in the player list
    const myIndex = players.findIndex(p => p.id === currentUser.uid);
    // The shift math: If round is 1, I hold the book of (myIndex + 1)
    const ownerIndex = (myIndex + round) % players.length;
    const ownerId = players[ownerIndex].id;

    // We need to look at the PREVIOUS page of that book to know what to do
    const prevRound = round - 1;
    const bookRef = ref(db, `rooms/${roomId}/books/${ownerId}/${prevRound}`);
    
    // Fetch once (no need for real-time listener on old pages)
    onValue(bookRef, (snapshot) => {
      const data = snapshot.val();
      if (data) setPrevData(data);
    }, { onlyOnce: true });

  }, [round, players, currentUser, roomId]);

  // 3. Submit Logic
  const handleSubmit = async () => {
    if (!currentUser) return;

    // Same math: Whose book am I writing in?
    const myIndex = players.findIndex(p => p.id === currentUser.uid);
    const ownerIndex = (myIndex + round) % players.length;
    const ownerId = players[ownerIndex].id;

    const entryRef = ref(db, `rooms/${roomId}/books/${ownerId}/${round}`);

    // If Even Round (0, 2, 4) -> We are writing text (Prompt or Guess)
    if (round % 2 === 0) {
       if (!promptText.trim()) return alert("Write something!");
       await set(entryRef, {
           type: "PROMPT",
           value: promptText,
           author: currentUser.uid
       });
    } 
    // If Odd Round (1, 3, 5) -> We are drawing
    else {
        const drawingData = canvasRef.current.getSaveData();
        await set(entryRef, {
            type: "DRAWING",
            value: drawingData,
            author: currentUser.uid
        });
    }

    setSubmitted(true);
  };

  // 4. Host Logic: Check if everyone is done, then advance round
  useEffect(() => {
    if (!isHost) return;

    // Check if current round is fully filled
    // We scan all books at the current round index
    const checkRef = ref(db, `rooms/${roomId}/books`);
    const unsub = onValue(checkRef, (snapshot) => {
        const books = snapshot.val();
        if (!books) return;

        let allDone = true;
        players.forEach(p => {
            if (!books[p.id] || !books[p.id][round]) allDone = false;
        });

        if (allDone) {
            // Wait a moment for effect, then increment round
            setTimeout(() => {
                update(ref(db), { [`rooms/${roomId}/round`]: round + 1 });
            }, 1000);
        }
    });

    return () => unsub();
  }, [round, roomId, isHost, players]);


  // --- VIEW: WAITING ---
  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">
        <div className="text-center animate-pulse">
          <h2 className="text-3xl font-bold text-green-400">SUBMITTED!</h2>
          <p className="text-gray-400 mt-2">Waiting for others...</p>
        </div>
      </div>
    );
  }

  // --- VIEW: GAME OVER (GALLERY) ---
  if (round >= players.length) {
    return <Gallery roomId={roomId} players={players} />;
  }

  // --- VIEW: ROUND 0 (WRITE PROMPT) ---
  if (round === 0) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4">
        <h2 className="text-2xl text-yellow-400 font-bold mb-6">ROUND 0: START A STORY</h2>
        <div className="bg-white p-6 rounded-xl w-full max-w-md">
          <input 
            type="text"
            className="w-full text-2xl font-bold p-4 border-b-4 border-purple-500 outline-none text-center"
            placeholder="e.g. A flying toaster"
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
          />
          <button onClick={handleSubmit} className="w-full mt-6 bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 rounded-lg text-xl">
            DONE
          </button>
        </div>
      </div>
    );
  }

  // --- VIEW: EVEN ROUNDS (GUESS THE DRAWING) ---
  // If round is 2, 4, 6... we see a drawing and write text.
  if (round % 2 === 0) {
      return (
        <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4">
            <h2 className="text-xl text-gray-400 mb-2">GUESS THIS DRAWING</h2>
            
            {/* Display Previous Drawing */}
            <div className="bg-white border-4 border-gray-700 rounded-lg mb-6 overflow-hidden">
                {prevData && prevData.type === "DRAWING" ? (
                    <CanvasDraw 
                        disabled
                        hideGrid
                        saveData={prevData.value}
                        canvasWidth={350}
                        canvasHeight={350}
                    />
                ) : <div className="w-[350px] h-[350px] flex items-center justify-center text-black">Loading...</div>}
            </div>

            <div className="bg-white p-4 rounded-xl w-full max-w-md">
                <input 
                    type="text"
                    className="w-full text-xl font-bold p-3 border-b-4 border-blue-500 outline-none text-center"
                    placeholder="What is this?"
                    value={promptText}
                    onChange={(e) => setPromptText(e.target.value)}
                />
                <button onClick={handleSubmit} className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg">
                    SUBMIT GUESS
                </button>
            </div>
        </div>
      );
  }

  // --- VIEW: ODD ROUNDS (DRAW THE TEXT) ---
  // If round is 1, 3, 5... we see text and draw it.
  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center py-4">
      <h2 className="text-xl text-gray-400 mb-2">DRAW THIS</h2>
      <div className="bg-gray-800 p-4 rounded-lg mb-4 max-w-md w-full text-center border border-gray-600">
          <p className="text-2xl font-black text-yellow-400 uppercase">
              {prevData?.value || "..."}
          </p>
      </div>

      <div className="border-4 border-gray-700 rounded-lg overflow-hidden bg-white">
        <CanvasDraw 
            ref={canvasRef}
            brushRadius={4}
            lazyRadius={0}
            canvasWidth={350}
            canvasHeight={350}
        />
      </div>
      
      <div className="mt-4 flex gap-4 w-full max-w-[350px]">
        <button onClick={() => canvasRef.current.clear()} className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded">
            CLEAR
        </button>
        <button onClick={handleSubmit} className="flex-1 py-3 bg-green-500 hover:bg-green-600 text-white font-bold rounded">
            DONE
        </button>
      </div>
    </div>
  );
}

export default Game;