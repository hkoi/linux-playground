import { useState, useEffect } from 'react';
import {
  Terminal as TerminalIcon,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Circle,
  Lightbulb,
  Lock,
  Trophy,
  Sparkles,
} from 'lucide-react';
import { useFileSystem } from '../context/FileSystemContext';
import missions from '../lib/missions';

export default function MissionPanel() {
  const {
    substepStatus,
    unlockedLevel,
    activeLevel,
    justCompletedLevel,
    resetSystem,
    setActiveLevel,
  } = useFileSystem();

  const [expandedHints, setExpandedHints] = useState({});
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [completeBanner, setCompleteBanner] = useState(null);

  // Completion banner animation
  useEffect(() => {
    if (justCompletedLevel) {
      setCompleteBanner(justCompletedLevel);
      const t = setTimeout(() => setCompleteBanner(null), 2500);
      return () => clearTimeout(t);
    }
  }, [justCompletedLevel]);

  // Count completed levels
  const completedLevels = missions.filter((level) =>
    level.substeps.every((s) => substepStatus[s.id]),
  ).length;

  const allComplete = completedLevels === missions.length;

  const toggleHint = (id) =>
    setExpandedHints((p) => ({ ...p, [id]: !p[id] }));

  const handleReset = () => {
    if (showResetConfirm) {
      resetSystem();
      setShowResetConfirm(false);
    } else {
      setShowResetConfirm(true);
      setTimeout(() => setShowResetConfirm(false), 3000);
    }
  };

  const toggleLevel = (levelId) => {
    if (levelId > unlockedLevel) return;
    setActiveLevel((prev) => (prev === levelId ? null : levelId));
  };

  return (
    <div className="h-full bg-slate-900 border-r border-slate-700 flex flex-col overflow-hidden select-none">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="p-4 border-b border-slate-700/80 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TerminalIcon className="w-5 h-5 text-cyan-400" />
            <h1 className="text-base font-bold text-white tracking-tight">
              Linux Playground
            </h1>
          </div>
          <button
            onClick={handleReset}
            className={`p-1.5 rounded-md transition-colors ${
              showResetConfirm
                ? 'bg-red-500/20 text-red-400'
                : 'text-slate-500 hover:text-white hover:bg-slate-800'
            }`}
            title="Reset System"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
        {showResetConfirm && (
          <p className="text-red-400 text-xs mt-1.5 animate-pulse">
            Click again to confirm reset
          </p>
        )}

        {/* Progress bar */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="font-medium">Progress</span>
            <span>
              {completedLevels}/{missions.length} Levels Complete
            </span>
          </div>
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${(completedLevels / missions.length) * 100}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* ── Completion Banner (overlay) ─────────────────────────── */}
      {completeBanner && (
        <div className="mx-3 mt-3 p-3 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border border-emerald-500/40 rounded-lg animate-pulse flex-shrink-0">
          <div className="flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4 text-yellow-400" />
            <span className="text-sm font-bold text-yellow-300">
              Level {completeBanner} Complete!
            </span>
            <Sparkles className="w-4 h-4 text-yellow-400" />
          </div>
        </div>
      )}

      {/* ── Mission List ────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {missions.map((level) => {
          const isLocked = level.id > unlockedLevel;
          const isActive = activeLevel === level.id;
          const completedSteps = level.substeps.filter(
            (s) => substepStatus[s.id],
          ).length;
          const levelDone = completedSteps === level.substeps.length;

          return (
            <div
              key={level.id}
              className={`rounded-lg border transition-all duration-300 ${
                isLocked
                  ? 'border-slate-800 bg-slate-800/30 opacity-50'
                  : levelDone
                  ? 'border-emerald-700/50 bg-emerald-900/10'
                  : isActive
                  ? 'border-cyan-600/50 bg-slate-800/80'
                  : 'border-slate-700/50 bg-slate-800/40'
              }`}
            >
              {/* Level header */}
              <button
                onClick={() => toggleLevel(level.id)}
                className="w-full p-3 flex items-center gap-3 text-left"
                disabled={isLocked}
              >
                {/* Icon */}
                <div className="flex-shrink-0">
                  {isLocked ? (
                    <Lock className="w-4 h-4 text-slate-600" />
                  ) : levelDone ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  ) : isActive ? (
                    <ChevronDown className="w-4 h-4 text-cyan-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-500" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                        levelDone
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : isActive
                          ? 'bg-cyan-500/20 text-cyan-400'
                          : 'bg-slate-700/50 text-slate-500'
                      }`}
                    >
                      L{level.id}
                    </span>
                    <h3
                      className={`text-sm font-semibold truncate ${
                        levelDone
                          ? 'text-emerald-400'
                          : isActive
                          ? 'text-white'
                          : isLocked
                          ? 'text-slate-600'
                          : 'text-slate-400'
                      }`}
                    >
                      {level.title}
                    </h3>
                  </div>
                </div>

                {/* Step counter */}
                {!isLocked && (
                  <span className="text-xs text-slate-500 flex-shrink-0 font-mono">
                    {completedSteps}/{level.substeps.length}
                  </span>
                )}
              </button>

              {/* Expanded content */}
              {isActive && !isLocked && (
                <div className="px-3 pb-3">
                  {/* Context */}
                  <p className="text-xs text-slate-400 italic mb-3 pl-7 leading-relaxed">
                    {level.context}
                  </p>

                  {/* Substeps */}
                  <div className="space-y-2">
                    {level.substeps.map((step, idx) => {
                      const done = substepStatus[step.id];
                      return (
                        <div key={step.id}>
                          <div className="flex items-start gap-2.5 pl-2">
                            <div className="flex-shrink-0 mt-0.5">
                              {done ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                              ) : (
                                <Circle className="w-4 h-4 text-slate-600" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p
                                className={`text-xs leading-relaxed ${
                                  done ? 'text-slate-500 line-through' : 'text-slate-300'
                                }`}
                              >
                                <span className="text-slate-500 font-mono mr-1">
                                  {idx + 1}.
                                </span>
                                {renderMarkdown(step.text)}
                              </p>

                              {/* Hint toggle (only for incomplete) */}
                              {!done && (
                                <button
                                  onClick={() => toggleHint(step.id)}
                                  className="flex items-center gap-1 mt-1 text-xs text-slate-600 hover:text-amber-400 transition-colors"
                                >
                                  <Lightbulb className="w-3 h-3" />
                                  {expandedHints[step.id] ? 'Hide hint' : 'Hint'}
                                </button>
                              )}
                              {expandedHints[step.id] && !done && (
                                <div className="mt-1.5 px-2 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded text-xs text-amber-300 font-mono leading-relaxed">
                                  {step.hint}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── All Complete ────────────────────────────────────────── */}
      {allComplete && (
        <div className="p-4 border-t border-slate-700 bg-gradient-to-r from-yellow-500/10 to-emerald-500/10 flex-shrink-0">
          <div className="flex items-center justify-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-400" />
            <span className="text-sm font-bold text-yellow-400">
              All Missions Complete!
            </span>
            <Trophy className="w-5 h-5 text-yellow-400" />
          </div>
          <p className="text-xs text-center text-slate-400 mt-1">
            You&apos;ve mastered the Linux terminal for competitive programming.
          </p>
        </div>
      )}
    </div>
  );
}

/** Tiny inline markdown: render backtick spans as <code>. */
function renderMarkdown(text) {
  const parts = text.split(/(`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={i}
          className="bg-slate-700/60 text-cyan-300 px-1 py-0.5 rounded text-[11px] font-mono"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    // Bold
    if (part.includes('**')) {
      const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
      return boldParts.map((bp, j) => {
        if (bp.startsWith('**') && bp.endsWith('**')) {
          return (
            <strong key={`${i}-${j}`} className="font-semibold text-white">
              {bp.slice(2, -2)}
            </strong>
          );
        }
        return bp;
      });
    }
    return part;
  });
}
