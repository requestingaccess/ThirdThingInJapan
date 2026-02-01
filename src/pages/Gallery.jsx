import React, { useEffect, useState } from 'react';
import { onValue, ref } from "firebase/database";
import { db } from "../firebase";
import { Home, LogOut } from 'lucide-react'; // Added LogOut icon
import { useNavigate } from 'react-router-dom'; // Import navigation
import GalleryCanvas from '../components/GalleryCanvas';

export default function Gallery({ roomId, players, onExit, currentUser }) {
  const [books, setBooks] = useState({});
  const navigate = useNavigate();

  // Determine if I am the host
  const isHost = players.length > 0 && currentUser?.uid === players[0].id;

  useEffect(() => {
    const booksRef = ref(db, `rooms/${roomId}/books`);
    onValue(booksRef, (snapshot) => {
      const data = snapshot.val();
      if (data) setBooks(data);
    });
  }, [roomId]);

  return (
    <div className="h-screen w-screen bg-zinc-950 text-white flex flex-col overflow-y-auto overflow-x-hidden selection:bg-cyan-500/30">
      
      {/* BACKGROUND */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
         <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] bg-violet-600/10 rounded-full blur-[100px]" />
         <div className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] bg-cyan-600/10 rounded-full blur-[100px]" />
      </div>

      <header className="shrink-0 h-24 flex items-center justify-between px-12 z-10">
        <div>
          <h1 className="text-4xl font-black tracking-tighter">GALLERY</h1>
          <p className="text-zinc-500 font-mono text-sm">ROOM: {roomId}</p>
        </div>
        
        <div className="flex gap-3">
          {/* HOST ONLY: Back to Lobby (Resets Game) */}
          {isHost ? (
            <button 
              onClick={onExit}
              className="px-6 py-2 rounded-full bg-green-500/20 border border-green-500/50 hover:bg-green-500/30 hover:shadow-[0_0_15px_rgba(34,197,94,0.3)] flex items-center gap-2 transition-all text-green-300 font-bold"
            >
              <Home size={18} />
              <span>BACK TO LOBBY</span>
            </button>
          ) : (
            <div className="px-6 py-2 rounded-full border border-white/5 bg-white/5 text-zinc-500 flex items-center gap-2 cursor-default">
               <span className="animate-pulse">●</span>
               <span>WAITING FOR HOST</span>
            </div>
          )}

          {/* EVERYONE: Leave Room (Navigate to Home) */}
          <button 
            onClick={() => navigate('/')}
            className="px-4 py-2 rounded-full border border-white/10 hover:bg-white/10 hover:border-red-500/30 hover:text-red-400 flex items-center gap-2 transition-colors text-zinc-400"
            title="Leave Room"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <main className="flex-1 p-12 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 z-10 pb-24">
        {Object.entries(books).map(([ownerId, pages]) => {
          const owner = players.find(p => p.id === ownerId);
          const ownerName = owner?.name || "Unknown";
          
          const sortedPages = Array.isArray(pages) ? pages : Object.values(pages);

          return (
            <div key={ownerId} className="bg-zinc-900/50 border border-white/5 rounded-3xl overflow-hidden flex flex-col shadow-2xl">
              <div className="p-6 border-b border-white/5 bg-black/20">
                <h2 className="font-bold text-xl text-cyan-400">Book of {ownerName}</h2>
              </div>
              
              <div className="flex-1 flex flex-col divide-y divide-white/5">
                {sortedPages.map((page, idx) => (
                  <div key={idx} className="p-6 flex flex-col gap-3">
                    <div className="flex justify-between items-center text-xs font-mono text-zinc-500 uppercase tracking-widest">
                      <span>Round {idx + 1}</span>
                      <span>
                        {players.find(p => p.id === page.author)?.name || '...'} 
                        &nbsp;•&nbsp; 
                        {page.type}
                      </span>
                    </div>

                    {page.type === "PROMPT" ? (
                      // TEXT CARD
                      <div className="bg-black/40 border border-white/10 rounded-xl p-6 min-h-[120px] flex items-center justify-center text-center">
                        <p className="text-xl md:text-2xl font-bold text-white/90 leading-relaxed">
                          "{page.value}"
                        </p>
                      </div>
                    ) : (
                      // DRAWING CARD
                      <div className="bg-zinc-900/50 rounded-xl overflow-hidden border border-white/10 aspect-video relative flex items-center justify-center">
                         <GalleryCanvas jsonData={page.value} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </main>
    </div>
  );
}