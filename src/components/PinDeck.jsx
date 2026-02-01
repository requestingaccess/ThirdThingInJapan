import React, { useState, useRef } from 'react';
import { getToolById } from '../constants/tools';
import { Pin, X } from 'lucide-react'; // <--- Import icons

const PinDeck = ({ pinnedIds, activeToolId, onSelect, onUnpin }) => {
  return (
    <div className="flex items-end justify-center gap-3 h-16 pointer-events-auto">
      
      {/* Pin Icon Label */}
      <div className="h-12 flex items-center justify-center opacity-40 mr-1" title="Pinned Tools">
        <Pin className="w-5 h-5 text-white" strokeWidth={1.5} />
      </div>

      {pinnedIds.length === 0 ? (
        // Empty Placeholder
        <div className="w-12 h-12 rounded-xl border-2 border-dashed border-zinc-700 bg-zinc-900/30 flex items-center justify-center transition-colors hover:border-zinc-600">
            {/* Optional: Add a subtle Plus icon here or leave blank */}
        </div>
      ) : (
        pinnedIds.map((id) => (
          <PinSlot 
            key={id} 
            id={id} 
            isActive={id === activeToolId} 
            onSelect={() => onSelect(id)}
            onUnpin={() => onUnpin(id)}
          />
        ))
      )}
    </div>
  );
};

const PinSlot = ({ id, isActive, onSelect, onUnpin }) => {
  const [showUnpin, setShowUnpin] = useState(false);
  const timerRef = useRef(null);
  const tool = getToolById(id);

  if (!tool) return null;

  const handleMouseEnter = () => {
    timerRef.current = setTimeout(() => {
      setShowUnpin(true);
    }, 800); 
  };

  const handleMouseLeave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setShowUnpin(false);
  };

  return (
    <div 
      className="relative group"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Unpin Button */}
      {showUnpin && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onUnpin();
          }}
          // Using Lucide X icon here
          className="absolute -top-3 -right-3 w-6 h-6 flex items-center justify-center text-red-500 hover:text-red-400 hover:scale-110 z-50 animate-fade-in drop-shadow-md"
          title="Unpin"
        >
          <X className="w-4 h-4" strokeWidth={3} /> 
        </button>
      )}

      {/* The Tool Icon */}
      <button
        onClick={onSelect}
        className={`
          w-12 h-12 rounded-xl flex items-center justify-center border-2 transition-all duration-200 shadow-lg
          ${isActive 
            ? 'bg-cyan-500 text-white border-cyan-400 -translate-y-2 scale-110 shadow-cyan-500/30' 
            : 'bg-zinc-900/80 text-zinc-400 border-zinc-700 hover:border-zinc-500 hover:bg-zinc-800'}
        `}
      >
        <div className="w-6 h-6 text-current">{tool.icon}</div>
      </button>
    </div>
  );
};

export default PinDeck;