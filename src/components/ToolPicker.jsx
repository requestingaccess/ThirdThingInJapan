import React, { useState, useEffect, useRef } from 'react';
import { TOOLS } from '../constants/tools';

export default function ToolPicker({ currentTool, onSelect, onPin, pinnedIds = [] }) {
  const [activeIndex, setActiveIndex] = useState(1);
  const containerRef = useRef(null);

  // Sync internal state with active tool
  useEffect(() => {
    const idx = TOOLS.findIndex(t => 
      t.id === currentTool || (t.options && t.options.find(o => o.id === currentTool))
    );
    if (idx !== -1) setActiveIndex(idx);
  }, [currentTool]);

  const handleWheel = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.deltaY > 0) setActiveIndex(prev => Math.min(prev + 1, TOOLS.length - 1));
    else setActiveIndex(prev => Math.max(prev - 1, 0));
  };

  useEffect(() => {
    const tool = TOOLS[activeIndex];
    // Auto-select the main option if a sub-option isn't already active
    if (tool.options) {
      const isAlreadyActive = tool.options.some(opt => opt.id === currentTool);
      if (!isAlreadyActive) onSelect(tool.options[0].id);
    } else {
      onSelect(tool.id);
    }
  }, [activeIndex]);

  const canPin = (id) => !pinnedIds.includes(id) && pinnedIds.length < 5;

  return (
    <div className="flex flex-row-reverse items-center h-[500px]"> 
      {/* SCROLL BAR */}
      <div className="h-48 w-1 bg-white/10 rounded-full ml-4 relative overflow-hidden">
        <div 
          className="absolute w-full bg-cyan-500 transition-all duration-300 rounded-full"
          style={{ 
            height: `${Math.max(10, 100 / TOOLS.length)}%`, 
            top: `${(activeIndex / (TOOLS.length - 1)) * (100 - (Math.max(10, 100 / TOOLS.length)))}%` 
          }}
        />
      </div>

      {/* CAROUSEL */}
      <div 
        ref={containerRef}
        onWheel={handleWheel}
        className="relative w-20 h-full flex items-center justify-center select-none"
      >
        {TOOLS.map((tool, index) => {
          const distance = index - activeIndex;
          const absDist = Math.abs(distance);
          const isActive = distance === 0;
          
          // --- VISIBILITY FIX ---
          // We allow distance 3 to render (opacity 0) so it can fade in.
          // Cutoff is now anything > 3.
          if (absDist > 3) return null;

          let translateY = distance * 85; 
          
          // Scale: Gradual shrink
          let scale = isActive ? 1.1 : Math.max(0.6, 1.0 - (absDist * 0.1));
          
          // Opacity Fix: Ensure it reaches exactly 0 at distance 3
          // Dist 0 = 1.0
          // Dist 1 = 0.67
          // Dist 2 = 0.33
          // Dist 3 = 0.0 (Invisible but present for transition)
          let opacity = isActive ? 1 : Math.max(0, 1 - (absDist * 0.33));
          
          let zIndex = 10 - absDist;

          return (
            <div
              key={tool.id}
              onClick={() => setActiveIndex(index)}
              className="absolute transition-all duration-300 ease-out flex items-center justify-center group/main"
              style={{
                transform: `translateY(${translateY}px) scale(${scale})`,
                opacity,
                zIndex,
                // Only allow interactions with the main 3 items to prevent accidental clicks on fading items
                pointerEvents: absDist >= 2 ? 'none' : 'auto' 
              }}
            >
              {/* MAIN ICON */}
              <div className={`
                  w-16 h-16 rounded-2xl flex items-center justify-center border-2 transition-colors duration-300 relative
                  ${isActive 
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-100 shadow-[0_0_15px_rgba(6,182,212,0.4)]' 
                    : 'bg-zinc-800/80 border-zinc-700 text-zinc-500 hover:border-zinc-500'}
                `}>
                <div className="w-8 h-8">{tool.icon}</div>

                {/* PIN BUTTON */}
                {isActive && !tool.options && canPin(tool.id) && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onPin(tool.id); }}
                    className="absolute -top-2 -left-2 w-6 h-6 bg-zinc-700 hover:bg-cyan-600 rounded-full text-white text-[10px] flex items-center justify-center shadow opacity-0 group-hover/main:opacity-100 transition-opacity"
                    title="Pin Tool"
                  >
                    +
                  </button>
                )}
              </div>

              {/* POP-OUT OPTIONS (Active Item Only) */}
              {isActive && tool.options && (
                <div className="absolute right-[110%] flex flex-row-reverse gap-2 pointer-events-none">
                  {tool.options.map((opt, i) => (
                    <div key={opt.id} className="relative group/sub pointer-events-auto">
                      <button
                        onClick={(e) => { e.stopPropagation(); onSelect(opt.id); }}
                        className={`
                          flex items-center justify-center w-12 h-12 rounded-xl border-2 transition-all duration-300
                          ${currentTool === opt.id 
                            ? 'bg-cyan-500 text-white border-cyan-400 scale-105 shadow-md' 
                            : 'bg-zinc-900 text-zinc-400 border-zinc-700 hover:bg-zinc-800'}
                        `}
                        style={{
                          animation: `popOut 0.3s ease-out ${i * 0.05}s forwards`,
                          opacity: 0,
                          transform: 'translateX(20px)' 
                        }}
                      >
                        <div className="scale-75 w-6 h-6">{opt.icon}</div>
                      </button>

                      {/* PIN BUTTON (Sub-options) */}
                      {canPin(opt.id) && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onPin(opt.id); }}
                          className="absolute -top-2 -left-2 w-5 h-5 bg-zinc-700 hover:bg-cyan-600 rounded-full text-white text-[10px] flex items-center justify-center shadow opacity-0 group-hover/sub:opacity-100 transition-opacity z-50"
                          title="Pin Tool"
                        >
                          +
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}