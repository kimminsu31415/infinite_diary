import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

function App() {
  return (
    <div className="min-h-screen bg-neutral-900 text-neutral-100 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">무한 일기장</h1>
        <p className="mt-2 opacity-80">React + Vite + Tailwind 초기화 완료</p>
      </div>
    </div>
  );
}

const root = createRoot(document.getElementById('root'));
root.render(<App />);
