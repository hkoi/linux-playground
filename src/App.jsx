import { FileSystemProvider } from './context/FileSystemContext';
import Terminal from './components/Terminal';
import MissionPanel from './components/MissionPanel';

export default function App() {
  return (
    <FileSystemProvider>
      <div className="grid grid-cols-[380px_1fr] h-screen bg-slate-950">
        <MissionPanel />
        <Terminal />
      </div>
    </FileSystemProvider>
  );
}
