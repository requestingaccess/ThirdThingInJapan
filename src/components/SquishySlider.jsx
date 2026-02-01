import React, { useEffect, useRef } from 'react';

const SquishySlider = ({ value, onChange, min = 1, max = 50 }) => {
  const containerRef = useRef(null);
  const knobRef = useRef(null);
  const trackFillRef = useRef(null);
  
  // Physics State
  const state = useRef({
    currentY: 0,    // Visual position (pixels from bottom)
    targetY: 0,     // Actual input position (pixels from bottom)
  });

  // Convert the 1-50 value into pixel height for the target
  useEffect(() => {
    if (!containerRef.current) return;
    const height = containerRef.current.clientHeight;
    // Map value to 0.0 - 1.0
    const percent = (value - min) / (max - min);
    state.current.targetY = percent * height;
  }, [value, min, max]);

  // The Animation Loop
  useEffect(() => {
    let animationFrameId;

    const loop = () => {
      if (!knobRef.current || !trackFillRef.current) return;

      const s = state.current;

      // 1. Calculate Velocity (Distance between visual and target)
      // The visual knob "chases" the target. 
      // Larger difference = Faster movement = More Stretch.
      const diff = s.targetY - s.currentY;
      
      // 2. Move the visual knob (Lerp)
      // 0.15 is the "stiffness". Lower = looser/more lag.
      s.currentY += diff * 0.25;

      // 3. Calculate Stretch based on velocity
      // We use the absolute difference to determine speed.
      const velocity = Math.abs(diff);
      
      // Stretch Factor: Adjust this to make it more/less jelly-like
      // Logic: Moving fast = Tall & Thin.
      const stretchAmount = Math.min(velocity * 0.02, 0.6); // Cap deformation at 60%
      
      const scaleY = 1 + stretchAmount;       // Get taller
      const scaleX = 1 - (stretchAmount * 0.4); // Get thinner (volume conservation)

      // 4. Apply Transforms
      // We use translate3d for hardware acceleration
      // Note: We translate Y negatively because 0 is at the bottom in our logic, 
      // but CSS translate Y goes down.
      knobRef.current.style.transform = `translate(-50%, ${-s.currentY}px) scale(${scaleX}, ${scaleY})`;
      
      // Update the cyan fill bar
      if (containerRef.current) {
        const percent = (s.currentY / containerRef.current.clientHeight) * 100;
        trackFillRef.current.style.height = `${percent}%`;
      }

      animationFrameId = requestAnimationFrame(loop);
    };

    loop();
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  return (
    <div className="flex flex-col items-center gap-6 h-64 w-full relative z-10">
      
      {/* 1. SIZE PREVIEW (Top) - Lower Z-Index */}
      <div className="w-16 h-16 flex items-center justify-center relative shrink-0 z-0 pointer-events-none">
        <div className="absolute inset-0 border border-white/10 rounded-xl" />
        <div 
          className="rounded-full bg-white shadow-[0_0_15px_rgba(255,255,255,0.5)] transition-all duration-75"
          style={{ width: `${value}px`, height: `${value}px` }}
        />
        <span className="absolute -top-6 text-[10px] text-zinc-500 font-bold tracking-widest">
          SIZE
        </span>
      </div>

      {/* 2. THE SLIDER TRACK - Higher Z-Index */}
      <div className="relative flex-1 w-12 flex justify-center z-50" ref={containerRef}>
        
        {/* Track Line */}
        <div className="absolute top-0 bottom-0 w-1 bg-zinc-800 rounded-full" />
        
        {/* Fill Line (Cyan) */}
        <div 
          ref={trackFillRef}
          className="absolute bottom-0 w-1 bg-cyan-500 rounded-full"
          style={{ height: '0%' }}
        />

        {/* The Physics Knob (Visual Only) */}
        {/* Positioned at bottom: 0, left: 50%. Moved via JS transform. */}
        <div 
          ref={knobRef}
          className="absolute bottom-0 left-1/2 w-5 h-5 bg-cyan-400 rounded-full shadow-[0_0_20px_rgba(6,182,212,0.8)] pointer-events-none"
          style={{ transformOrigin: 'center center' }} 
        />

        {/* The Invisible Input (The Interaction Layer) */}
        {/* -inset-4 expands the hit area by 1rem (16px) in all directions */}
        <input 
          type="range" 
          min={min} 
          max={max} 
          value={value} 
          onInput={(e) => onChange(parseInt(e.target.value))}
          className="absolute -inset-4 opacity-0 cursor-pointer w-auto h-auto z-50"
          style={{ 
            writingMode: 'vertical-lr', 
            direction: 'rtl', 
            appearance: 'slider-vertical',
            margin: 0
          }} 
        />
      </div>
      
      {/* Value Display */}
      <span className="text-xs font-mono text-zinc-500">{value}px</span>
    </div>
  );
};

export default SquishySlider;