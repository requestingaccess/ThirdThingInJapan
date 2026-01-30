import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { ref, get } from 'firebase/database';
import CanvasDraw from "react-canvas-draw";

function Gallery({ roomId, players }) {
  const [books, setBooks] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBooks = async () => {
      const snapshot = await get(ref(db, `rooms/${roomId}/books`));
      if (snapshot.exists()) {
        setBooks(snapshot.val());
      }
      setLoading(false);
    };
    fetchBooks();
  }, [roomId]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <div className="text-blue-400 font-bold tracking-[0.3em] animate-pulse">LOADING GALLERY...</div>
        </div>
    </div>
  );

  return (
    <div className="min-h-screen p-8 pb-32">
      <div className="max-w-5xl mx-auto">
        
        <div className="text-center mb-20 relative">
            <div className="absolute top-1/2 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
            <h1 className="relative inline-block px-8 bg-black/80 backdrop-blur-xl text-5xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-blue-500">
                GALLERY
            </h1>
            <p className="mt-4 text-xs font-mono text-gray-500 tracking-[0.5em] uppercase">
                Room: {roomId}
            </p>
        </div>
      
        <div className="space-y-24">
            {players.map((player) => {
            const playerBook = books[player.id];
            if (!playerBook) return null;

            const pages = Object.entries(playerBook)
                .sort((a, b) => a[0] - b[0])
                .map(([_, data]) => data);

            return (
                <div key={player.id} className="relative">
                    
                    <div className="flex items-center justify-center mb-12">
                        <div className="glass-panel px-8 py-3 rounded-full flex items-center gap-4 border-green-500/30">
                            <span className="text-xl font-bold tracking-widest uppercase text-green-100">
                                {player.name}
                            </span>
                        </div>
                    </div>

                    <div className="absolute left-1/2 top-16 bottom-0 w-px bg-gradient-to-b from-green-500/0 via-green-500/30 to-green-500/0 transform -translate-x-1/2"></div>

                    <div className="space-y-16 relative z-10">
                        {pages.map((page, index) => (
                        <div key={index} className="flex flex-col items-center">
                            
                            <div className="relative group transition-transform duration-500 hover:scale-[1.02]">
                                <div className="absolute -left-12 top-1/2 transform -translate-y-1/2 -rotate-90 text-xs font-mono text-gray-600 tracking-widest opacity-50">
                                    ROUND {index}
                                </div>

                                {page.type === "PROMPT" && (
                                    <div className="glass-panel p-8 rounded-2xl min-w-[320px] max-w-md text-center border-blue-500/20 shadow-[0_0_30px_-10px_rgba(59,130,246,0.1)]">
                                        <div className="text-2xl font-bold text-white leading-tight">
                                            "{page.value}"
                                        </div>
                                    </div>
                                )}

                                {page.type === "DRAWING" && (
                                    <div className="glass-panel p-2 rounded-2xl border-purple-500/20 shadow-[0_0_30px_-10px_rgba(168,85,247,0.1)]">
                                        <div className="bg-white rounded-xl overflow-hidden relative">
                                            <CanvasDraw
                                                disabled
                                                hideGrid
                                                saveData={page.value}
                                                canvasWidth={350}
                                                canvasHeight={350}
                                                immediateLoading={true}
                                            />
                                        </div>
                                    </div>
                                )}

                                {page.type === "SKIPPED" && (
                                    <div className="bg-red-900/10 backdrop-blur-sm border border-red-500/30 p-8 rounded-2xl min-w-[320px] flex flex-col items-center text-center">
                                        <div className="text-red-400 font-bold tracking-widest uppercase mb-1">Disconnected</div>
                                        <div className="text-red-100 font-mono text-sm bg-red-900/40 p-2 rounded mt-2">
                                            Passed: "{page.value.toString().substring(0, 20)}..."
                                        </div>
                                    </div>
                                )}

                                <div className="absolute -bottom-8 left-0 right-0 text-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <span className="text-[10px] bg-black/50 px-3 py-1 rounded-full border border-white/10 text-gray-400 font-mono">
                                        AUTHOR: {players.find(p => p.id === page.author)?.name || "UNKNOWN"}
                                    </span>
                                </div>
                            </div>
                        </div>
                        ))}
                    </div>
                </div>
            );
            })}
        </div>

        <div className="text-center mt-32">
            <button 
                onClick={() => window.location.href = '/'} 
                className="glass-button-primary px-12 py-6 rounded-full text-lg shadow-[0_0_50px_-10px_rgba(34,197,94,0.3)] hover:shadow-[0_0_80px_-10px_rgba(34,197,94,0.5)] transition-all duration-500"
            >
                PLAY AGAIN
            </button>
        </div>
      </div>
    </div>
  );
}

export default Gallery;