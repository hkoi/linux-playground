import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { createDefaultFS } from '../lib/virtualFS';
import missions from '../lib/missions';

const FileSystemContext = createContext(null);
const DEFAULT_DIR = '/home/user';
const STORAGE_KEY = 'linux-playground-state';
const STORAGE_VERSION = 1;
const SAVE_INTERVAL_MS = 5000;

function initSubstepStatus() {
  const init = {};
  for (const level of missions) {
    for (const s of level.substeps) init[s.id] = false;
  }
  return init;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.version !== STORAGE_VERSION) return null;
    if (!parsed.fsState || !parsed.substepStatus) return null;
    return parsed;
  } catch {
    return null;
  }
}

// Loaded once at module init
const _initial = loadState();

export function FileSystemProvider({ children }) {
  const [fsState, setFsState] = useState(() => _initial?.fsState ?? createDefaultFS());
  const [currentDir, setCurrentDir] = useState(() => _initial?.currentDir ?? DEFAULT_DIR);
  const [commandHistory, setCommandHistory] = useState(() => _initial?.commandHistory ?? []);
  const [substepStatus, setSubstepStatus] = useState(() => {
    const base = _initial?.substepStatus ?? initSubstepStatus();
    if (!_initial) return base;
    const next = { ...base };
    let changed = false;
    const fs = _initial.fsState;
    const cwd = _initial.currentDir;
    const hist = _initial.commandHistory ?? [];
    for (const level of missions) {
      if (level.id > (_initial.unlockedLevel ?? 1) + 1) continue;
      const firstIncompleteIdx = level.substeps.findIndex((s) => !next[s.id]);
      if (firstIncompleteIdx === -1) continue;
      const step = level.substeps[firstIncompleteIdx];
      try {
        if (step.validate(fs, cwd, hist)) {
          next[step.id] = true;
          changed = true;
        }
      } catch { /* ignore */ }
    }
    return changed ? next : base;
  });
  const [unlockedLevel, setUnlockedLevel] = useState(() => _initial?.unlockedLevel ?? 1);
  const [activeLevel, setActiveLevel] = useState(() => _initial?.activeLevel ?? 1);
  const [justCompletedLevel, setJustCompletedLevel] = useState(null);

  // ── Refs: always hold latest values for use inside callbacks & timers ──
  const stateRef = useRef({
    fsState, currentDir, commandHistory, substepStatus, unlockedLevel, activeLevel,
  });
  useEffect(() => {
    stateRef.current = { fsState, currentDir, commandHistory, substepStatus, unlockedLevel, activeLevel };
  });

  const historyRef = useRef(commandHistory);
  const unlockedRef = useRef(unlockedLevel);
  useEffect(() => { historyRef.current = commandHistory; }, [commandHistory]);
  useEffect(() => { unlockedRef.current = unlockedLevel; }, [unlockedLevel]);

  // ── Save function (reads from ref, never stale) ──
  const persist = useCallback((source = 'unknown') => {
    try {
      const data = { version: STORAGE_VERSION, ...stateRef.current };
      const json = JSON.stringify(data);
      localStorage.setItem(STORAGE_KEY, json);
      const sizeKB = (json.length / 1024).toFixed(2);
      const completed = Object.values(stateRef.current.substepStatus).filter(Boolean).length;
      const total = Object.keys(stateRef.current.substepStatus).length;
      console.log(`💾 [SAVE] ${source.toUpperCase()} | ${sizeKB} KB | ${completed}/${total} substeps | ${new Date().toLocaleTimeString()}`);
    } catch (err) {
      console.error('❌ [SAVE] Failed:', err);
    }
  }, []);

  // ── Auto-save every 5 seconds ──
  useEffect(() => {
    // Test save immediately on mount
    persist('mount');
    // Then start interval
    const id = setInterval(() => persist('interval'), SAVE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [persist]);

  // ── Save on page unload (Ctrl+R, F5, close tab) ──
  useEffect(() => {
    const handleUnload = () => persist('beforeunload');
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [persist]);

  // ── Also save immediately after every command (not just on interval) ──
  const saveNow = persist;

  const updateFS = useCallback((newFS) => setFsState(newFS), []);
  const updateDir = useCallback((newDir) => setCurrentDir(newDir), []);

  const addCommandAndValidate = useCallback((cmd, newFS, newDir) => {
    const newHistory = [...historyRef.current, cmd];
    historyRef.current = newHistory;
    setCommandHistory(newHistory);

    setSubstepStatus((prev) => {
      const next = { ...prev };
      let changed = false;
      const limit = unlockedRef.current + 1;
      for (const level of missions) {
        if (level.id > limit) continue;
        const firstIncompleteIdx = level.substeps.findIndex((s) => !next[s.id]);
        if (firstIncompleteIdx === -1) continue;
        const step = level.substeps[firstIncompleteIdx];
        try {
          if (step.validate(newFS, newDir, newHistory)) {
            next[step.id] = true;
            changed = true;
          }
        } catch { /* ignore */ }
      }
      return changed ? next : prev;
    });

    setTimeout(() => {
      setSubstepStatus((current) => {
        const ul = unlockedRef.current;
        for (const level of missions) {
          if (level.id > ul) continue;
          const allDone = level.substeps.every((s) => current[s.id]);
          if (allDone && level.id === ul) {
            if (level.id < missions.length) {
              setUnlockedLevel(level.id + 1);
              unlockedRef.current = level.id + 1;
            }
            setJustCompletedLevel(level.id);
            setTimeout(() => {
              if (level.id < missions.length) setActiveLevel(level.id + 1);
              setJustCompletedLevel(null);
            }, 2200);
          }
        }
        return current;
      });
      // Save after validation completes
      setTimeout(() => saveNow('command'), 100);
    }, 60);
  }, [saveNow]);

  const resetSystem = useCallback(() => {
    setFsState(createDefaultFS());
    setCurrentDir(DEFAULT_DIR);
    setCommandHistory([]);
    historyRef.current = [];
    setSubstepStatus(initSubstepStatus());
    setUnlockedLevel(1);
    unlockedRef.current = 1;
    setActiveLevel(1);
    setJustCompletedLevel(null);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }, []);

  return (
    <FileSystemContext.Provider
      value={{
        fsState, currentDir, commandHistory, substepStatus,
        unlockedLevel, activeLevel, justCompletedLevel,
        updateFS, updateDir, addCommandAndValidate,
        resetSystem, setActiveLevel,
      }}
    >
      {children}
    </FileSystemContext.Provider>
  );
}

export function useFileSystem() {
  const ctx = useContext(FileSystemContext);
  if (!ctx) throw new Error('useFileSystem must be used within FileSystemProvider');
  return ctx;
}
