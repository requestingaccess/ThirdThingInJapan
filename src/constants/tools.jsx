import React from 'react';
import { 
  MousePointer2, 
  Pencil, 
  Eraser, 
  Trash2, 
  ImagePlus, 
  Divide, 
  Square, 
  Circle, 
  Feather,
  Shapes,
  Minus,    // <--- For Single Line
  Activity  // <--- For Multi-Line
} from 'lucide-react';

export const TOOLS = [
  { 
    id: 'MOVE', 
    label: 'Move', 
    icon: <MousePointer2 className="w-full h-full" strokeWidth={1.5} /> 
  },
  { 
    id: 'PEN', 
    label: 'Pen', 
    icon: <Pencil className="w-full h-full" strokeWidth={1.5} /> 
  },
  { 
    id: 'CALLIGRAPHY', 
    label: 'Calligraphy', 
    icon: <Feather className="w-full h-full" strokeWidth={1.5} /> 
  },
  // --- NEW LINE TOOLS ---
  {
    id: 'LINE_GROUP',
    label: 'Lines',
    icon: <Minus className="w-full h-full -rotate-45" strokeWidth={1.5} />,
    options: [
      {
        id: 'LINE_SINGLE',
        label: 'Single Line',
        icon: <Minus className="w-full h-full -rotate-45" strokeWidth={1.5} />
      },
      {
        id: 'LINE_MULTI',
        label: 'Multi Line',
        icon: <Activity className="w-full h-full" strokeWidth={1.5} />
      }
    ]
  },
  { 
    id: 'SHAPE_GROUP', 
    label: 'Shapes', 
    icon: <Shapes className="w-full h-full" strokeWidth={1.5} />,
    options: [
      { 
        id: 'RECT_HOLLOW', 
        label: 'Rectangle', 
        icon: <Square className="w-full h-full" strokeWidth={1.5} /> 
      },
      { 
        id: 'RECT_FILLED', 
        label: 'Filled Rect', 
        icon: <Square className="w-full h-full fill-current" strokeWidth={1.5} /> 
      },
      { 
        id: 'ELLIPSE_HOLLOW', 
        label: 'Ellipse', 
        icon: <Circle className="w-full h-full" strokeWidth={1.5} /> 
      },
      { 
        id: 'ELLIPSE_FILLED', 
        label: 'Filled Circle', 
        icon: <Circle className="w-full h-full fill-current" strokeWidth={1.5} /> 
      }
    ]
  },
  { 
    id: 'ERASER_GROUP', 
    label: 'Eraser', 
    icon: <Eraser className="w-full h-full" strokeWidth={1.5} />,
    options: [
      { 
        id: 'WHITE_ERASER', 
        label: 'Standard', 
        icon: <div className="w-full h-full rounded-full border-2 border-current" /> 
      },
      { 
        id: 'STROKE_ERASER', 
        label: 'Stroke', 
        icon: <Trash2 className="w-full h-full" strokeWidth={1.5} /> 
      }
    ]
  },
  { 
    id: 'SYMMETRY', 
    label: 'Symmetry', 
    icon: <Divide className="w-full h-full" strokeWidth={1.5} /> 
  },
  { 
    id: 'TRACE', 
    label: 'Trace', 
    icon: <ImagePlus className="w-full h-full" strokeWidth={1.5} /> 
  },
];

export const getToolById = (id) => {
  for (const tool of TOOLS) {
    if (tool.id === id) return tool;
    if (tool.options) {
      const sub = tool.options.find(opt => opt.id === id);
      if (sub) return sub;
    }
  }
  return null;
};