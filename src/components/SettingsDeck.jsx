import React from 'react';
import { Clock, Zap, Pen, Palette, Ghost, Eye, Minus, Plus } from 'lucide-react';

export default function SettingsDeck({ settings, updateSetting, isHost }) {

  // Helper component for the "Segmented Pill" Toggle
  const TogglePill = ({ label, options, value, onChange, colorClass }) => (
    <div className="space-y-3">
      <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-2">
        {label}
      </div>
      <div className="bg-zinc-900/50 border border-white/10 p-1 rounded-full flex relative">
        {/* The Toggle Items */}
        {options.map((opt) => {
            const isActive = value === opt.value;
            return (
                <button
                    key={opt.value}
                    disabled={!isHost}
                    onClick={() => onChange(opt.value)}
                    className={`
                        flex-1 relative z-10 py-3 rounded-full text-sm font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-colors duration-200
                        ${isActive ? 'text-black' : 'text-zinc-500 hover:text-zinc-300'}
                        ${!isHost && 'cursor-default'}
                    `}
                >
                    {opt.icon}
                    {opt.label}
                </button>
            );
        })}

        {/* The Sliding Background ("The Pill") */}
        <div 
            className={`
                absolute top-1 bottom-1 rounded-full transition-all duration-300 shadow-lg
                ${colorClass}
            `}
            style={{
                width: `calc(50% - 4px)`,
                left: value === options[0].value ? '4px' : '50%' 
            }}
        />
      </div>
    </div>
  );

  return (
    <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-12 p-4">
        
        {/* 1. TIME CONTROLS */}
        <div className="space-y-8">
            <TogglePill 
                label="Timer Mode"
                value={settings.timerMode}
                onChange={(val) => updateSetting("timerMode", val)}
                colorClass="bg-green-400"
                options={[
                    { value: "MANUAL", label: "Manual", icon: <Clock size={16} /> },
                    { value: "DYNAMIC", label: "Dynamic", icon: <Zap size={16} /> }
                ]}
            />

            {/* Sub-setting: Base Seconds (Only visible if Dynamic) */}
            <div className={`transition-all duration-300 overflow-hidden ${settings.timerMode === 'DYNAMIC' ? 'max-h-32 opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="bg-zinc-900/30 border border-white/5 rounded-2xl p-4 flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Base Seconds</span>
                    
                    <div className="flex items-center gap-4">
                        <button 
                            disabled={!isHost}
                            onClick={() => updateSetting("baseTime", Math.max(10, (settings.baseTime || 60) - 5))}
                            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                        >
                            <Minus size={14} />
                        </button>
                        
                        <span className="text-xl font-black font-mono w-12 text-center text-green-400">
                            {settings.baseTime || 60}
                        </span>

                        <button 
                            disabled={!isHost}
                            onClick={() => updateSetting("baseTime", Math.min(120, (settings.baseTime || 60) + 5))}
                            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                        >
                            <Plus size={14} />
                        </button>
                    </div>
                </div>
            </div>
        </div>

        {/* 2. GAMEPLAY CONTROLS */}
        <div className="space-y-8">
            <TogglePill 
                label="First Round"
                value={settings.startMode}
                onChange={(val) => updateSetting("startMode", val)}
                colorClass="bg-cyan-400"
                options={[
                    { value: "WRITE", label: "Write", icon: <Pen size={16} /> },
                    { value: "DRAW", label: "Draw", icon: <Palette size={16} /> }
                ]}
            />

            <TogglePill 
                label="Anonymity"
                value={settings.ghostMode ? "GHOST" : "VISIBLE"}
                onChange={(val) => updateSetting("ghostMode", val === "GHOST")}
                colorClass="bg-violet-400"
                options={[
                    { value: "GHOST", label: "Ghost Mode", icon: <Ghost size={16} /> },
                    { value: "VISIBLE", label: "Visible", icon: <Eye size={16} /> }
                ]}
            />
        </div>

    </div>
  );
}