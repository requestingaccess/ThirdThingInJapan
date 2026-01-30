import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { ref, get } from 'firebase/database';
import CanvasDraw from "react-canvas-draw";

function Gallery({ roomId, players }) {
  const [books, setBooks] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch all books at once
    const fetchBooks = async () => {
      const snapshot = await get(ref(db, `rooms/${roomId}/books`));
      if (snapshot.exists()) {
        setBooks(snapshot.val());
      }
      setLoading(false);
    };
    fetchBooks();
  }, [roomId]);

  if (loading) return <div className="text-white text-center mt-20">Loading Gallery...</div>;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <h1 className="text-4xl font-black text-yellow-400 text-center mb-12">THE GALLERY</h1>
      
      <div className="max-w-4xl mx-auto space-y-24">
        {players.map((player) => {
          const playerBook = books[player.id];
          if (!playerBook) return null;

          // Convert object to array and sort by round index
          const pages = Object.entries(playerBook)
            .sort((a, b) => a[0] - b[0])
            .map(([_, data]) => data);

          return (
            <div key={player.id} className="bg-gray-800 rounded-xl overflow-hidden border-4 border-gray-700">
              {/* Header: Whose book is this? */}
              <div className="bg-purple-600 p-4">
                <h2 className="text-2xl font-bold text-center uppercase tracking-wider">
                  {player.name}'s Album
                </h2>
              </div>

              {/* The Chain of Events */}
              <div className="p-8 space-y-8">
                {pages.map((page, index) => (
                  <div key={index} className="flex flex-col items-center">
                    
                    {/* Visual Connector Line */}
                    {index > 0 && <div className="h-8 w-1 bg-gray-600 mb-8"></div>}

                    {/* Content Card */}
                    <div className="relative group">
                        
                        {/* If TEXT */}
                        {page.type === "PROMPT" && (
                            <div className="bg-white text-gray-900 p-6 rounded-lg text-2xl font-bold text-center border-4 border-blue-400 min-w-[300px]">
                                "{page.value}"
                            </div>
                        )}

                        {/* If DRAWING */}
                        {page.type === "DRAWING" && (
                            <div className="bg-white border-4 border-pink-500 rounded-lg overflow-hidden">
                                <CanvasDraw
                                    disabled
                                    hideGrid
                                    saveData={page.value}
                                    canvasWidth={350}
                                    canvasHeight={350}
                                    immediateLoading={true} // Draws instantly, no animation
                                />
                            </div>
                        )}

                        {/* Author Tag (Hover to see who did this step) */}
                        <div className="mt-2 text-center text-gray-400 text-sm">
                            by {players.find(p => p.id === page.author)?.name || "Unknown"}
                        </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-center mt-20 mb-10">
          <button 
            onClick={() => window.location.href = '/'} 
            className="bg-green-500 hover:bg-green-600 text-white font-bold py-4 px-12 rounded-full text-xl"
          >
              PLAY AGAIN
          </button>
      </div>
    </div>
  );
}

export default Gallery;