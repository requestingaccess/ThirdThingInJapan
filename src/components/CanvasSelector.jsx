import React from 'react';

export default function CanvasSelector({ onSelect }) {
  const options = [
    { label: 'Portrait', aspect: 0.75, width: 'w-12', height: 'h-16' },
    { label: 'Square', aspect: 1, width: 'w-14', height: 'h-14' },
    { label: 'Landscape', aspect: 1.33, width: 'w-16', height: 'h-12' }
  ];

  return (
    <div className="flex gap-8 animate-fade-in items-end">
      {options.map((opt) => (
        <button
          key={opt.label}
          onClick={() => onSelect(opt.aspect)}
          className="group flex flex-col items-center gap-3 transition-transform hover:-translate-y-2"
        >
          {/* Minimal White Square Preview */}
          <div className={`${opt.width} ${opt.height} bg-white shadow-lg rounded-sm transition-all group-hover:shadow-[0_0_15px_rgba(255,255,255,0.3)]`} />
          
          <span className="text-[10px] font-bold text-zinc-500 group-hover:text-white uppercase tracking-widest">
            {opt.label}
          </span>
        </button>
      ))}
    </div>
  );
}