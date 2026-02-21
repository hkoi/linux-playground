import { useState, useRef, useEffect, useCallback } from 'react';
import { useFileSystem } from '../context/FileSystemContext';
import { executeCommand } from '../lib/commandParser';
import { getCompletions } from '../lib/virtualFS';

function promptPath(cwd) {
  if (cwd === '/home/user') return '~';
  if (cwd.startsWith('/home/user/')) return '~/' + cwd.slice('/home/user/'.length);
  return cwd;
}

export default function Terminal() {
  const {
    fsState,
    currentDir,
    updateFS,
    updateDir,
    addCommandAndValidate,
  } = useFileSystem();

  const [history, setHistory] = useState([
    {
      type: 'output',
      text: 'Welcome to Linux Playground — Competitive Programming Edition',
    },
    { type: 'output', text: 'Type "help" for available commands. Complete the missions on the left panel.' },
    { type: 'output', text: '' },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [cursorPos, setCursorPos] = useState(0);
  const [cmdHistory, setCmdHistory] = useState([]);
  const [historyIdx, setHistoryIdx] = useState(-1);

  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  // Refs for latest mutable state (used inside callbacks without re-render deps)
  const fsRef = useRef(fsState);
  const cwdRef = useRef(currentDir);
  useEffect(() => { fsRef.current = fsState; }, [fsState]);
  useEffect(() => { cwdRef.current = currentDir; }, [currentDir]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  const focusInput = useCallback(() => inputRef.current?.focus(), []);

  // Sync visual cursor with the real caret inside the <input>
  const syncCursor = useCallback(() => {
    if (inputRef.current) {
      setCursorPos(inputRef.current.selectionStart ?? inputValue.length);
    }
  }, [inputValue.length]);

  // ── Submit ──────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(() => {
    const cmd = inputValue;
    setInputValue('');
    setCursorPos(0);
    setHistoryIdx(-1);

    // Push the input line into display
    setHistory((prev) => [...prev, { type: 'input', text: cmd, dir: cwdRef.current }]);

    if (cmd.trim()) {
      setCmdHistory((prev) => [...prev, cmd]);
    }

    const result = executeCommand(cmd, fsRef.current, cwdRef.current);

    if (result.shouldClear) {
      setHistory([]);
      return;
    }

    // Apply FS / dir changes
    updateFS(result.newFsState);
    updateDir(result.newCurrentDir);

    // Push output lines
    if (result.output.length > 0) {
      setHistory((prev) => [
        ...prev,
        ...result.output.map((text) => ({ type: 'output', text })),
      ]);
    }

    // Validate missions
    if (cmd.trim()) {
      addCommandAndValidate(cmd, result.newFsState, result.newCurrentDir);
    }
  }, [inputValue, updateFS, updateDir, addCommandAndValidate]);

  // ── Tab completion ──────────────────────────────────────────────────────
  const handleTab = useCallback(() => {
    if (!inputRef.current) return;
    
    const cursorPos = inputRef.current.selectionStart ?? inputValue.length;
    const textBeforeCursor = inputValue.slice(0, cursorPos);
    const textAfterCursor = inputValue.slice(cursorPos);
    
    // Find the last token before cursor (word boundary)
    const match = textBeforeCursor.match(/(\S+)$/);
    const partial = match ? match[1] : '';
    
    if (!partial) {
      // No partial to complete - maybe user wants to complete current directory
      const completions = getCompletions(fsRef.current, '.', cwdRef.current);
      if (completions.length > 0) {
        setHistory((prev) => [
          ...prev,
          { type: 'input', text: inputValue, dir: cwdRef.current },
          { type: 'output', text: completions.join('  ') },
        ]);
      }
      return;
    }
    
    const completions = getCompletions(fsRef.current, partial, cwdRef.current);

    // If partial ends with '/', always show list (standard Unix behavior)
    // This allows users to explore directory contents
    if (partial.endsWith('/')) {
      if (completions.length > 0) {
        setHistory((prev) => [
          ...prev,
          { type: 'input', text: inputValue, dir: cwdRef.current },
          { type: 'output', text: completions.join('  ') },
        ]);
      }
      return;
    }

    if (completions.length === 1) {
      // Replace only the partial part, preserve rest of input
      const beforePartial = textBeforeCursor.slice(0, textBeforeCursor.length - partial.length);
      const completed = beforePartial + completions[0] + textAfterCursor;
      setInputValue(completed);
      // Position cursor after the completed part
      const newCursorPos = beforePartial.length + completions[0].length;
      setCursorPos(newCursorPos);
      // Also set the actual input selection
      requestAnimationFrame(() => {
        if (inputRef.current) {
          inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
        }
      });
    } else if (completions.length > 1) {
      // Show completions as output
      setHistory((prev) => [
        ...prev,
        { type: 'input', text: inputValue, dir: cwdRef.current },
        { type: 'output', text: completions.join('  ') },
      ]);
    }
  }, [inputValue]);

  // ── Keyboard ────────────────────────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      } else if (e.key === 'Tab') {
        e.preventDefault();
        handleTab();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setCmdHistory((prev) => {
          if (prev.length === 0) return prev;
          const newIdx = historyIdx === -1 ? prev.length - 1 : Math.max(0, historyIdx - 1);
          setHistoryIdx(newIdx);
          setInputValue(prev[newIdx]);
          setCursorPos(prev[newIdx].length);
          return prev;
        });
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setCmdHistory((prev) => {
          if (historyIdx === -1) return prev;
          const newIdx = historyIdx + 1;
          if (newIdx >= prev.length) {
            setHistoryIdx(-1);
            setInputValue('');
            setCursorPos(0);
          } else {
            setHistoryIdx(newIdx);
            setInputValue(prev[newIdx]);
            setCursorPos(prev[newIdx].length);
          }
          return prev;
        });
      } else {
        // For Left, Right, Home, End, etc. — sync after the browser updates selectionStart
        requestAnimationFrame(syncCursor);
      }
    },
    [handleSubmit, handleTab, historyIdx, syncCursor],
  );

  const pp = promptPath(currentDir);

  return (
    <div
      className="h-full bg-slate-950 font-mono text-sm p-4 overflow-y-auto cursor-text flex flex-col"
      onClick={focusInput}
    >
      <div className="flex-1 min-h-0">
        {history.map((line, i) => (
          <div key={i} className="leading-relaxed whitespace-pre-wrap break-all">
            {line.type === 'input' ? (
              <span>
                <span className="text-green-400 font-bold">user@linux</span>
                <span className="text-slate-500">:</span>
                <span className="text-blue-400 font-bold">{promptPath(line.dir)}</span>
                <span className="text-slate-500">$ </span>
                <span className="text-slate-200">{line.text}</span>
              </span>
            ) : (
              <span
                className={
                  line.text &&
                  (line.text.includes('error') ||
                    line.text.includes('not found') ||
                    line.text.includes('cannot') ||
                    line.text.includes('fatal') ||
                    line.text.includes('omitting') ||
                    line.text.includes('Is a directory'))
                    ? 'text-red-400'
                    : line.text &&
                      (line.text.startsWith('[') && line.text.includes('Compiled'))
                    ? 'text-emerald-400'
                    : line.text && line.text.startsWith('[Executed')
                    ? 'text-cyan-400'
                    : 'text-slate-300'
                }
              >
                {line.text}
              </span>
            )}
          </div>
        ))}

        {/* Active prompt */}
        <div className="leading-relaxed flex items-center">
          <span className="text-green-400 font-bold">user@linux</span>
          <span className="text-slate-500">:</span>
          <span className="text-blue-400 font-bold">{pp}</span>
          <span className="text-slate-500">$ </span>
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                setCursorPos(e.target.selectionStart ?? e.target.value.length);
                setHistoryIdx(-1);
              }}
              onSelect={(e) => setCursorPos(e.target.selectionStart ?? cursorPos)}
              onKeyDown={handleKeyDown}
              className="bg-transparent text-slate-200 outline-none w-full caret-transparent font-mono text-sm"
              autoFocus
              spellCheck={false}
              autoComplete="off"
              autoCapitalize="off"
            />
            <span
              className="absolute top-0 text-green-400 animate-pulse pointer-events-none font-mono text-sm"
              style={{ left: `${cursorPos}ch` }}
            >
              ▌
            </span>
          </div>
        </div>
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
