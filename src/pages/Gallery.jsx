import React from 'react';

export default function Gallery() {
  return (
    <div className="min-h-screen flex items-center justify-center text-white">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Gallery Under Construction</h1>
        <p className="text-zinc-400">
          The Gallery is being updated to support the new Vector Engine (Phase 9).
        </p>
        <button 
            onClick={() => window.location.href = '/'} 
            className="mt-8 glass-button px-8 py-3 rounded-full"
        >
            Back to Home
        </button>
      </div>
    </div>
  );
}