import { useState } from 'react';
import { FileSystemProvider } from './context/FileSystemContext';
import Terminal from './components/Terminal';
import MissionPanel from './components/MissionPanel';

export default function App() {
  const [mobileTab, setMobileTab] = useState('terminal');

  return (
    <FileSystemProvider>
      {/* Desktop */}
      <div className="hidden md:grid grid-cols-[380px_1fr] h-screen bg-slate-950">
        <MissionPanel />
        <Terminal />
      </div>

      {/* Mobile */}
      <div className="md:hidden flex flex-col h-screen bg-slate-950">
        <div className={`flex-1 min-h-0 ${mobileTab === 'missions' ? '' : 'hidden'}`}>
          <MissionPanel />
        </div>
        <div className={`flex-1 min-h-0 ${mobileTab === 'terminal' ? '' : 'hidden'}`}>
          <Terminal />
        </div>
        <div className="flex-shrink-0 flex border-t border-slate-700 bg-slate-900">
          <button
            onClick={() => setMobileTab('missions')}
            className={`flex-1 py-3 text-xs font-bold tracking-wide transition-colors ${
              mobileTab === 'missions'
                ? 'text-cyan-400 bg-slate-800'
                : 'text-slate-500'
            }`}
          >
            MISSIONS
          </button>
          <button
            onClick={() => setMobileTab('terminal')}
            className={`flex-1 py-3 text-xs font-bold tracking-wide transition-colors ${
              mobileTab === 'terminal'
                ? 'text-cyan-400 bg-slate-800'
                : 'text-slate-500'
            }`}
          >
            TERMINAL
          </button>
        </div>
      </div>
    </FileSystemProvider>
  );
}
