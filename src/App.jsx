import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Lobby from './pages/Lobby';
import Game from './pages/Game'; // Ensure Game is imported if you use it in routing directly or via Lobby

function App() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-black text-white selection:bg-green-500 selection:text-black">
      
      {/* --- BACKGROUND BLOBS --- */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        {/* Green Blob */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-green-500/20 rounded-full mix-blend-screen filter blur-[100px] animate-blob"></div>
        {/* Blue Blob */}
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-blue-600/20 rounded-full mix-blend-screen filter blur-[100px] animate-blob animation-delay-2000"></div>
        {/* Purple/Dark Blob for depth */}
        <div className="absolute -bottom-32 left-1/3 w-96 h-96 bg-purple-600/10 rounded-full mix-blend-screen filter blur-[100px] animate-blob animation-delay-4000"></div>
        
        {/* Grid Overlay for texture (Optional, adds tech feel) */}
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
      </div>

      {/* --- CONTENT --- */}
      <div className="relative z-10">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/room/:roomId" element={<Lobby />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;