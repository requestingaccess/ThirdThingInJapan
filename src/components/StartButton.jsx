import React from 'react';
import { Users, Play } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function StartButton({ playerCount, onStart, isHost }) {
  const canStart = playerCount >= 2;
  const progress = Math.min(playerCount / 2, 1) * 100;

  // 1. HOST VIEW (Interactive)
  if (isHost) {
    return (
      <div className="relative group w-64 h-16 pointer-events-auto">
        
        {/* Glow */}
        {canStart && (
           <div className="absolute -inset-1 bg-gradient-to-r from-green-500 to-cyan-500 rounded-full blur opacity-20 group-hover:opacity-60 transition-opacity duration-200" />
        )}

        <button
          onClick={onStart}
          disabled={!canStart}
          className="relative w-full h-full block outline-none focus:outline-none"
        >
          {/* Shell */}
          <div className={`
            absolute inset-0 border-2 rounded-full overflow-hidden transition-all duration-200
            ${canStart 
               ? 'border-cyan-500/50 bg-black shadow-[0_0_15px_rgba(6,182,212,0.1)]' 
               : 'border-white/10 bg-zinc-900/50 cursor-not-allowed'}
          `}>
             <div 
                className="absolute top-0 left-0 h-full bg-white/10 transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }} 
             />
             {canStart && (
                <div className="absolute inset-0 bg-gradient-to-r from-green-400 to-cyan-500 translate-y-full group-hover:translate-y-0 transition-transform duration-150 ease-out origin-bottom" />
             )}
          </div>

          {/* Text */}
          <div className="absolute inset-0 flex items-center justify-center z-10 mix-blend-difference">
             <AnimatePresence mode="wait">
                {canStart ? (
                  <motion.div 
                    key="start"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -20, opacity: 0 }}
                    className="flex items-center gap-3"
                  >
                     <span className="text-3xl font-black italic tracking-tighter text-white group-hover:text-white transition-colors">
                        START
                     </span>
                     <Play className="fill-white w-5 h-5 text-white" />
                  </motion.div>
                ) : (
                  <motion.div 
                    key="waiting"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center leading-none gap-1"
                  >
                     <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-500">
                        Waiting
                     </span>
                     <div className="flex items-center gap-2 text-zinc-400 font-mono text-xs">
                        <Users size={12} />
                        <span>{playerCount}/2</span>
                     </div>
                  </motion.div>
                )}
             </AnimatePresence>
          </div>
        </button>
      </div>
    );
  }

  // 2. GUEST VIEW (Passive Indicator)
  return (
    <div className="flex flex-col items-center gap-3 opacity-30 select-none pointer-events-none">
        <div className="h-1 w-24 bg-white/20 rounded-full overflow-hidden">
            <div 
                className="h-full bg-white transition-all duration-500"
                style={{ width: `${progress}%` }}
            />
        </div>
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 text-center">
            {canStart ? "Waiting for Host to Start" : "Waiting for Players"}
        </span>
    </div>
  );
}