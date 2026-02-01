import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const ORBIT_SPEED = 0.05; // Degrees per frame
const RX = 400; // Horizontal Radius (Widened for drama)
const RY = 110; // Vertical Radius (Squashed to overlap text)

export default function PlayerOrbit({ players }) {
  const [rotation, setRotation] = useState(0);

  // 1. FILTER: Hide "ghost" players until they have a name
  const visiblePlayers = players.filter(p => p.name && p.name.trim() !== "");

  // --- THE ORBIT LOOP ---
  useEffect(() => {
    let animationFrameId;
    
    const animate = () => {
      setRotation(prev => (prev + ORBIT_SPEED) % 360);
      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  const getPosition = (index, total) => {
    const angleOffset = (360 / total) * index;
    const finalAngle = angleOffset + rotation;
    const rad = (finalAngle * Math.PI) / 180;

    const y = RY * Math.sin(rad);

    // Z-INDEX LOGIC:
    // Room Code is z-40.
    // If y > 0 (Bottom of screen/Front): z-50
    // If y < 0 (Top of screen/Back): z-30
    const zIndex = y > 0 ? 50 : 30;

    return {
      x: RX * Math.cos(rad),
      y: y,
      scale: 0.8 + (Math.sin(rad) + 1) * 0.15, // Size depth
      zIndex: zIndex
    };
  };

  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-visible">
      
      {/* THE ANCHOR (0x0 Center) */}
      <div className="relative w-0 h-0">
          <AnimatePresence>
            {visiblePlayers.map((p, i) => {
              const pos = getPosition(i, visiblePlayers.length);

              return (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ 
                    x: pos.x, 
                    y: pos.y, 
                    scale: pos.scale,
                    opacity: 1,
                    zIndex: pos.zIndex // Applied dynamically
                  }}
                  exit={{ opacity: 0, scale: 0 }}
                  transition={{ duration: 0.5, ease: "backOut" }}
                  className="absolute top-0 left-0"
                >
                  {/* UNIFIED CONTAINER */}
                  <div className="flex flex-col items-center transform -translate-x-1/2 -translate-y-[32px]">
                      
                      {/* AVATAR */}
                      <div className={`
                        w-16 h-16 rounded-full shadow-2xl flex items-center justify-center 
                        text-2xl font-black border-2 border-white/20 
                        bg-gradient-to-br from-cyan-500 to-blue-600 text-white
                        relative
                      `}>
                          {p.avatar}
                          {p.presence?.state === 'offline' && (
                            <div className="absolute inset-0 bg-black/60 rounded-full" />
                          )}
                      </div>

                      {/* NAME TAG */}
                      <div className={`
                        mt-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 
                        text-xs font-bold text-white shadow-lg whitespace-nowrap
                        ${p.presence?.state === 'offline' ? 'opacity-50 line-through' : ''}
                      `}>
                        {p.name}
                      </div>

                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
      </div>
    </div>
  );
}