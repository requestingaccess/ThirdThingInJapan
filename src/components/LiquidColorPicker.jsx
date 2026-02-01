import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { motion, useSpring, AnimatePresence } from 'framer-motion';
import { 
  polarToCartesian, 
  cartesianToPolar, 
  normalizeAngle, 
  hslaToString, 
  TWO_PI, 
  PI,
  noise,
  mapRange,
  clamp,
} from '../utils/geometry';

// --- CONFIGURATION ---
const IDLE_RADIUS = 30;     
const EXPANDED_RADIUS = 140; 
const POINTS_COUNT = 120;
const SINUSOID_FREQ = 8;     
const SINUSOID_AMP = 4;      
const BLOB_NOISE_AMP = 6;

const TRIGGER_ENTER_DIST = IDLE_RADIUS + 20; 
const TRIGGER_LEAVE_DIST = EXPANDED_RADIUS + 40;

const LiquidColorPicker = ({ 
  initialColor = { h: 0, s: 100, l: 50, a: 1 },
  onChange 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [mode, setMode] = useState('COLOR'); 
  
  const [color, setColor] = useState(initialColor);
  const [transparency, setTransparency] = useState(initialColor.a);
  const transparencyRef = useRef(initialColor.a);

  const [knobAngle, setKnobAngle] = useState(-PI / 2);
  const [isDraggingKnob, setIsDraggingKnob] = useState(false);
  const [isDraggingColor, setIsDraggingColor] = useState(false);

  const [pathFullD, setPathFullD] = useState('');
  const [pathDottedD, setPathDottedD] = useState('');
  const [pathSolidD, setPathSolidD] = useState('');
  const [knobPos, setKnobPos] = useState({ x: 0, y: 0 });
  
  const timeRef = useRef(0);
  const reqRef = useRef();
  
  const expansionProgress = useSpring(0, { stiffness: 60, damping: 15 });
  const containerRef = useRef(null);
  const svgRef = useRef(null);

  // --- HOVER LOGIC (Global Listener) ---
  // We use global listener so we can set pointer-events: none on the container
  useEffect(() => {
    const handleGlobalMouseMove = (e) => {
      if (isDraggingColor || isDraggingKnob) return; 
      if (!svgRef.current) return;

      const rect = svgRef.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const d = Math.sqrt(Math.pow(e.clientX - cx, 2) + Math.pow(e.clientY - cy, 2));

      if (isExpanded) {
        if (d > TRIGGER_LEAVE_DIST) {
          setIsExpanded(false);
          expansionProgress.set(0);
        }
      } else {
        if (d < TRIGGER_ENTER_DIST) {
          setIsExpanded(true);
          expansionProgress.set(1);
        }
      }
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    return () => window.removeEventListener('mousemove', handleGlobalMouseMove);
  }, [isExpanded, isDraggingColor, isDraggingKnob, expansionProgress]);

  useEffect(() => {
    const handleUp = () => {
      setIsDraggingKnob(false);
      setIsDraggingColor(false);
    };
    window.addEventListener('pointerup', handleUp);
    return () => window.removeEventListener('pointerup', handleUp);
  }, []);

  const toggleMode = (e) => {
    e.stopPropagation();
    const newMode = mode === 'COLOR' ? 'GRAYSCALE' : 'COLOR';
    setMode(newMode);
    if (newMode === 'GRAYSCALE') setColor(prev => ({ ...prev, s: 0, l: 50 })); 
    else setColor(prev => ({ ...prev, s: 100, l: 50 })); 
  };

  const updateColorFromPointer = useCallback((e) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    
    const { r, theta } = cartesianToPolar(cx, cy, e.clientX, e.clientY);
    const maxR = EXPANDED_RADIUS - SINUSOID_AMP;
    let t = clamp(r / maxR, 0, 1);

    if (mode === 'COLOR') {
       let hue = (theta * 180) / PI; 
       if (hue < 0) hue += 360;
       const newL = 100 - (50 * t);
       setColor(prev => ({ ...prev, h: hue, s: 100, l: newL }));
    } else {
       if (t < 0.1) t = 0;
       else if (t > 0.9) t = 1;
       const newL = 100 - (100 * t);
       setColor(prev => ({ ...prev, s: 0, l: newL }));
    }
  }, [mode]);

  const updateKnobFromPointer = useCallback((e) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    
    const { theta } = cartesianToPolar(cx, cy, e.clientX, e.clientY);
    let normalized = normalizeAngle(theta - (-PI / 2));
    let newAlpha = 1 - (normalized / TWO_PI);
    
    const prevAlpha = transparencyRef.current;
    const diff = newAlpha - prevAlpha;

    if (Math.abs(diff) > 0.5) {
      if (prevAlpha > 0.5) newAlpha = 1;
      else newAlpha = 0;
    }

    transparencyRef.current = newAlpha;
    setTransparency(newAlpha);
    setColor(prev => ({ ...prev, a: newAlpha }));

    const finalTheta = (1 - newAlpha) * TWO_PI - PI / 2;
    setKnobAngle(finalTheta);
  }, []);

  const handlePointerMove = (e) => {
    if (isDraggingColor) updateColorFromPointer(e);
    else if (isDraggingKnob) updateKnobFromPointer(e);
  };

  const handleColorAreaPointerDown = (e) => {
    if (!isExpanded) return;
    setIsDraggingColor(true);
    updateColorFromPointer(e);
  };

  const handleKnobPointerDown = (e) => {
    if (!isExpanded) return;
    e.stopPropagation();
    setIsDraggingKnob(true);
  };

  // --- ANIMATION ---
  useEffect(() => {
    const animate = (time) => {
      timeRef.current = time * 0.001;
      const progress = expansionProgress.get();
      
      const currentRadius = mapRange(progress, 0, 1, IDLE_RADIUS, EXPANDED_RADIUS);
      const currentSineAmp = mapRange(progress, 0, 1, 0, SINUSOID_AMP);
      const currentNoiseAmp = mapRange(progress, 0, 1, BLOB_NOISE_AMP, 2);
      
      const center = { x: 200, y: 200 }; 
      const startAngleOffset = -PI / 2;
      const points = [];

      let kR = currentRadius;
      kR += Math.sin(knobAngle * SINUSOID_FREQ + timeRef.current) * currentSineAmp;
      kR += noise(knobAngle, timeRef.current * 2) * currentNoiseAmp;
      const exactKnobPos = polarToCartesian(center.x, center.y, kR, knobAngle);
      setKnobPos(exactKnobPos);

      const dottedPts = [];
      const solidPts = [];

      for (let i = 0; i <= POINTS_COUNT; i++) {
        const angle = (i / POINTS_COUNT) * TWO_PI + startAngleOffset;
        let r = currentRadius;
        r += Math.sin(angle * SINUSOID_FREQ + timeRef.current) * currentSineAmp;
        r += noise(angle, timeRef.current * 2) * currentNoiseAmp;
        
        const p = polarToCartesian(center.x, center.y, r, angle);
        points.push(p);

        if (angle < knobAngle) dottedPts.push(p);
        else solidPts.push(p);
      }

      let d = `M ${points[0].x} ${points[0].y}`;
      for (let i = 1; i < points.length; i++) d += ` L ${points[i].x} ${points[i].y}`;
      d += ' Z';
      setPathFullD(d);

      let dD = "";
      if (dottedPts.length > 0) {
        dD = `M ${dottedPts[0].x} ${dottedPts[0].y}`;
        for (let i = 1; i < dottedPts.length; i++) dD += ` L ${dottedPts[i].x} ${dottedPts[i].y}`;
        dD += ` L ${exactKnobPos.x} ${exactKnobPos.y}`;
      }

      let dS = `M ${exactKnobPos.x} ${exactKnobPos.y}`;
      if (solidPts.length > 0) {
        for (let i = 0; i < solidPts.length; i++) dS += ` L ${solidPts[i].x} ${solidPts[i].y}`;
      }
      if (dottedPts.length === 0) dS += ' Z';

      setPathDottedD(dD);
      setPathSolidD(dS);

      reqRef.current = requestAnimationFrame(animate);
    };

    reqRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(reqRef.current);
  }, [expansionProgress, knobAngle]);

  useEffect(() => {
    if (onChange) onChange(color);
  }, [color, onChange]);

  const rainbowGradient = `conic-gradient(from 90deg, hsl(0,100%,50%), hsl(60,100%,50%), hsl(120,100%,50%), hsl(180,100%,50%), hsl(240,100%,50%), hsl(300,100%,50%), hsl(360,100%,50%))`;
  const tintGradient = `radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 100%)`;
  const grayscaleGradient = `radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(0,0,0,1) 100%)`;

  const selectionDotPos = useMemo(() => {
    let t = 0;
    if (mode === 'COLOR') t = (100 - color.l) / 50;
    else t = (100 - color.l) / 100;
    t = clamp(t, 0, 1);
    const r = t * (EXPANDED_RADIUS - SINUSOID_AMP); 
    const theta = (color.h * PI) / 180;
    return polarToCartesian(200, 200, r, theta);
  }, [color.h, color.l, mode]);

  return (
    <div 
      ref={containerRef}
      className="relative w-[400px] h-[400px] flex items-center justify-center select-none"
      onPointerMove={handlePointerMove}
      style={{ transform: 'scale(1)', pointerEvents: 'none' }} // CLICK-THROUGH ENABLED
    >
      <div className="pointer-events-none w-full h-full"> 
        <svg 
          ref={svgRef}
          width="400" 
          height="400" 
          viewBox="0 0 400 400"
          className="touch-none"
        >
          <defs>
            <clipPath id="blobMask"><path d={pathFullD} /></clipPath>
          </defs>

          {/* 1. Base Blob - INTERACTIVE */}
          <path 
            d={pathFullD} 
            fill={hslaToString(color)} 
            className="transition-colors duration-200 pointer-events-auto" 
          />

          {/* 2. Gradients - INTERACTIVE ONLY WHEN EXPANDED */}
          <g clipPath="url(#blobMask)" style={{ opacity: isExpanded ? 1 : 0, transition: 'opacity 0.5s ease' }}>
            <foreignObject x="0" y="0" width="400" height="400" style={{pointerEvents: isExpanded ? 'auto' : 'none'}}>
               {mode === 'COLOR' ? (
                 <>
                  <div className="w-full h-full absolute" style={{ background: rainbowGradient, opacity: transparency }} />
                  <div className="w-full h-full absolute" style={{ background: tintGradient, opacity: transparency }} />
                 </>
               ) : (
                 <div className="w-full h-full absolute" style={{ background: grayscaleGradient, opacity: transparency }} />
               )}
            </foreignObject>
            
            {/* Hit Area */}
            <rect 
                x="0" y="0" width="400" height="400" 
                fill="transparent" 
                onPointerDown={handleColorAreaPointerDown} 
                className="cursor-crosshair" 
                style={{pointerEvents: isExpanded ? 'auto' : 'none'}}
            />

            <circle cx={selectionDotPos.x} cy={selectionDotPos.y} r="8" fill="transparent" stroke={mode === 'COLOR' ? "white" : "cyan"} strokeWidth="2" className="pointer-events-none shadow-sm" />
          </g>

          {/* 3. Borders */}
          <path d={pathDottedD} fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeDasharray="4 6" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none" />
          <path d={pathSolidD} fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none" />
          
          {/* 4. Knob - INTERACTIVE */}
          <AnimatePresence>
            {isExpanded && (
              <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <circle cx={knobPos.x} cy={knobPos.y} r="12" fill="white" stroke="rgba(0,0,0,0.2)" strokeWidth="1" className="cursor-grab active:cursor-grabbing shadow-lg pointer-events-auto" onPointerDown={handleKnobPointerDown} />
                <circle cx={knobPos.x} cy={knobPos.y} r="6" fill={`rgba(0,0,0, ${1 - transparency})`} className="pointer-events-none" />

                {/* CENTER TOGGLE */}
                <g 
                  onClick={toggleMode} 
                  className="cursor-pointer hover:opacity-80 transition-opacity pointer-events-auto"
                >
                   <circle cx="200" cy="200" r="14" fill="rgba(0,0,0,0.5)" stroke="white" strokeWidth="2" />
                   {mode === 'COLOR' ? (
                     <>
                       <circle cx="195" cy="200" r="2" fill="#ff0055" />
                       <circle cx="200" cy="200" r="2" fill="#00ff55" />
                       <circle cx="205" cy="200" r="2" fill="#0055ff" />
                     </>
                   ) : (
                     <circle cx="200" cy="200" r="4" fill="white" />
                   )}
                </g>
              </motion.g>
            )}
          </AnimatePresence>
        </svg>
      </div>
    </div>
  );
};

export default LiquidColorPicker;