import { resolvePath, nodeExists } from './virtualFS';

/**
 * Each level: { id, title, context, substeps: [ { id, text, hint, validate(fs,cwd,history) } ] }
 *
 * `history` is the full array of raw command strings the user has typed.
 * Validators must be pure — they only inspect state, never mutate.
 */

const missions = [
  // ─── Level 1 — Project Scaffolding ──────────────────────────────────────
  {
    id: 1,
    title: 'Project Scaffolding',
    context:
      'Organize your workspace. A real competitive programmer keeps a clean directory tree. You must use the correct flags — no lazy shortcuts.',
    substeps: [
      {
        id: '1.1',
        text: 'Create the nested path `CP/Codeforces/Round900` using a **single** `mkdir -p` command.',
        hint: 'Type: mkdir -p CP/Codeforces/Round900',
        validate: (fs, _cwd, history) => {
          const exists = nodeExists(fs, '/home/user/CP/Codeforces/Round900');
          const hasCmd = history.some(
            (c) => c.startsWith('mkdir') && c.includes('-p') && c.includes('CP/Codeforces/Round900'),
          );
          return exists && hasCmd;
        },
      },
      {
        id: '1.2',
        text: 'Navigate into `Round900` using `cd` with the full relative path in one command.',
        hint: 'Type: cd CP/Codeforces/Round900',
        validate: (_fs, cwd, history) => {
          if (cwd !== '/home/user/CP/Codeforces/Round900') return false;
          const cdCmds = history.filter((c) => c.startsWith('cd '));
          if (cdCmds.length === 0) return false;
          const last = cdCmds[cdCmds.length - 1];
          return last.includes('CP/Codeforces/Round900');
        },
      },
      {
        id: '1.3',
        text: 'Create three subdirectories `A`, `B`, and `C` in a **single** `mkdir` command.',
        hint: 'Type: mkdir A B C',
        validate: (fs, _cwd, history) => {
          const base = '/home/user/CP/Codeforces/Round900';
          const aOk = nodeExists(fs, `${base}/A`);
          const bOk = nodeExists(fs, `${base}/B`);
          const cOk = nodeExists(fs, `${base}/C`);
          if (!aOk || !bOk || !cOk) return false;
          return history.some((c) => {
            if (!c.startsWith('mkdir')) return false;
            return c.includes('A') && c.includes('B') && c.includes('C');
          });
        },
      },
      {
        id: '1.4',
        text: 'Run `ls` to see the three directories.',
        hint: 'Type: ls',
        validate: (_fs, _cwd, history) => {
          if (history.length === 0) return false;
          const last = history[history.length - 1].trim();
          return last === 'ls' || last.startsWith('ls ') || last.startsWith('ls\t');
        },
      },
      {
        id: '1.5',
        text: 'Run `ls -la` to practice long-format + hidden-files flags together.',
        hint: 'Type: ls -la',
        validate: (_fs, _cwd, history) => {
          if (history.length === 0) return false;
          const last = history[history.length - 1].trim();
          if (!last.startsWith('ls')) return false;
          const hasL = last.includes('-l') || last.includes('-la') || last.includes('-al');
          const hasA = last.includes('-a') || last.includes('-la') || last.includes('-al');
          return hasL && hasA;
        },
      },
    ],
  },

  // ─── Level 2 — File Creation & Hidden Files ────────────────────────────
  {
    id: 2,
    title: 'File Creation & Hidden Files',
    context:
      'Create your source files and test inputs. Learn to work with paths and hidden files — contest tooling often relies on dotfiles.',
    substeps: [
      {
        id: '2.1',
        text: 'Navigate into `A` and create a source file `A.cpp` using `touch`.',
        hint: 'Type: cd A  then  touch A.cpp',
        validate: (fs, cwd) => {
          if (!cwd.endsWith('/A')) return false;
          return nodeExists(fs, cwd + '/A.cpp');
        },
      },
      {
        id: '2.2',
        text: 'Go back to `Round900` with `cd ..`, then create `A/tests` **without entering A** — use a path argument.',
        hint: 'Type: cd ..  then  mkdir A/tests',
        validate: (fs, cwd) => {
          if (!cwd.endsWith('/Round900')) return false;
          return nodeExists(fs, cwd + '/A/tests');
        },
      },
      {
        id: '2.3',
        text: 'Create two test files in one command: `touch A/tests/in1.txt A/tests/in2.txt`.',
        hint: 'Type: touch A/tests/in1.txt A/tests/in2.txt',
        validate: (fs) => {
          const base = '/home/user/CP/Codeforces/Round900/A/tests';
          return nodeExists(fs, `${base}/in1.txt`) && nodeExists(fs, `${base}/in2.txt`);
        },
      },
      {
        id: '2.4',
        text: 'Create `.flags` in Round900 and write compilation flags into it: `echo "-std=c++20 -O2 -Wall" > .flags`.',
        hint: 'Type: touch .flags  then  echo "-std=c++20 -O2 -Wall" > .flags',
        validate: (fs) => {
          const base = '/home/user/CP/Codeforces/Round900';
          const node = resolvePath(fs, `${base}/.flags`);
          return node && node.type === 'file' && node.content && node.content.includes('-std=c++20');
        },
      },
      {
        id: '2.5',
        text: 'Run `ls` (notice `.flags` is hidden), then run `ls -a` to reveal it.',
        hint: 'Type: ls  then  ls -a',
        validate: (_fs, _cwd, history) => {
          // need an ls (without -a) followed later by an ls with -a
          let sawPlainLs = false;
          for (const c of history) {
            const t = c.trim();
            if (t === 'ls' || (t.startsWith('ls') && !t.includes('-a'))) {
              sawPlainLs = true;
            }
            if (sawPlainLs && t.startsWith('ls') && t.includes('-a')) {
              return true;
            }
          }
          return false;
        },
      },
    ],
  },

  // ─── Level 3 — Rename, Copy & Reorganize ───────────────────────────────
  {
    id: 3,
    title: 'Rename, Copy & Reorganize',
    context:
      'Contest problems change, files need renaming, and backups save lives. Pay attention to flags — copying directories without `-r` will fail.',
    substeps: [
      {
        id: '3.1',
        text: 'Navigate into `A`. Rename `A.cpp` to `A_sol.cpp` using `mv`.',
        hint: 'Type: cd A  then  mv A.cpp A_sol.cpp',
        validate: (fs, cwd) => {
          if (!cwd.endsWith('/A')) return false;
          const dir = resolvePath(fs, cwd);
          if (!dir) return false;
          return dir.children['A_sol.cpp'] && !dir.children['A.cpp'];
        },
      },
      {
        id: '3.2',
        text: 'Copy `A_sol.cpp` into `tests` as `A_sol_backup.cpp`.',
        hint: 'Type: cp A_sol.cpp tests/A_sol_backup.cpp',
        validate: (fs) => {
          return nodeExists(fs, '/home/user/CP/Codeforces/Round900/A/tests/A_sol_backup.cpp');
        },
      },
      {
        id: '3.3',
        text: 'Go back to `Round900`. Copy the **entire** `A/tests` directory into `B` as `B/tests` using `cp -r`.',
        hint: 'Type: cd ..  then  cp -r A/tests B/tests',
        validate: (fs, _cwd, history) => {
          const exists = nodeExists(fs, '/home/user/CP/Codeforces/Round900/B/tests');
          const hasCmd = history.some((c) => c.startsWith('cp') && c.includes('-r'));
          return exists && hasCmd;
        },
      },
      {
        id: '3.4',
        text: 'Navigate into `B/tests` and verify files with `ls -l`.',
        hint: 'Type: cd B/tests  then  ls -l',
        validate: (_fs, cwd, history) => {
          if (!cwd.endsWith('/B/tests')) return false;
          if (history.length === 0) return false;
          const last = history[history.length - 1].trim();
          return last.startsWith('ls') && last.includes('-l');
        },
      },
      {
        id: '3.5',
        text: 'Navigate back to `Round900` using a chained relative path `cd ../..`.',
        hint: 'Type: cd ../..',
        validate: (_fs, cwd, history) => {
          if (!cwd.endsWith('/Round900')) return false;
          const cdCmds = history.filter((c) => c.startsWith('cd '));
          if (cdCmds.length === 0) return false;
          return cdCmds[cdCmds.length - 1].includes('../..');
        },
      },
    ],
  },

  // ─── Level 4 — Strict Compilation ──────────────────────────────────────
  {
    id: 4,
    title: 'Strict Compilation',
    context:
      'This is the core skill. In competitive programming, you must compile with the right standard, name your binary properly, and enable warnings. Every flag matters.',
    substeps: [
      {
        id: '4.1',
        text: 'Navigate into `A`. Write mock code into `A_sol.cpp`: `echo "#include <bits/stdc++.h>" > A_sol.cpp`.',
        hint: 'Type: cd A  then  echo "#include <bits/stdc++.h>" > A_sol.cpp',
        validate: (fs) => {
          const node = resolvePath(fs, '/home/user/CP/Codeforces/Round900/A/A_sol.cpp');
          return node && node.content && node.content.length > 0;
        },
      },
      {
        id: '4.2',
        text: 'Compile `A_sol.cpp` with `-std=c++20` and `-o A_sol` in one command.',
        hint: 'Type: g++ -std=c++20 -o A_sol A_sol.cpp',
        validate: (fs, _cwd, history) => {
          const binExists = nodeExists(fs, '/home/user/CP/Codeforces/Round900/A/A_sol');
          const hasCmd = history.some(
            (c) => c.startsWith('g++') && c.includes('-std=c++20') && c.includes('-o') && c.includes('A_sol'),
          );
          return binExists && hasCmd;
        },
      },
      {
        id: '4.3',
        text: 'Run the binary: `./A_sol`.',
        hint: 'Type: ./A_sol',
        validate: (_fs, _cwd, history) => {
          return history.some((c) => c.trim() === './A_sol' || c.trim().startsWith('./A_sol ') || c.trim().startsWith('./A_sol\t'));
        },
      },
      {
        id: '4.4',
        text: 'Recompile with ALL flags: `-std=c++20`, `-O2`, `-Wall`, `-Wextra`, `-o A_sol` in a single command.',
        hint: 'Type: g++ -std=c++20 -O2 -Wall -Wextra -o A_sol A_sol.cpp',
        validate: (_fs, _cwd, history) => {
          return history.some((c) => {
            if (!c.startsWith('g++')) return false;
            return (
              c.includes('-std=c++20') &&
              c.includes('-O2') &&
              c.includes('-Wall') &&
              c.includes('-Wextra') &&
              c.includes('-o') &&
              c.includes('A_sol')
            );
          });
        },
      },
      {
        id: '4.5',
        text: 'Run with input redirection: `./A_sol < tests/in1.txt`.',
        hint: 'Type: ./A_sol < tests/in1.txt',
        validate: (_fs, _cwd, history) => {
          return history.some(
            (c) => c.includes('./A_sol') && c.includes('<') && c.includes('tests/in1.txt'),
          );
        },
      },
      {
        id: '4.6',
        text: 'Read the `.flags` file from the parent directory: `cat ../.flags`.',
        hint: 'Type: cat ../.flags',
        validate: (_fs, _cwd, history) => {
          if (history.length === 0) return false;
          const last = history[history.length - 1].trim();
          return last.startsWith('cat') && (last.includes('../.flags') || last.includes('.flags'));
        },
      },
    ],
  },

  // ─── Level 5 — Testing Workflow & Cleanup ──────────────────────────────
  {
    id: 5,
    title: 'Testing Workflow & Cleanup',
    context:
      'Real competitive programmers test against sample inputs, compare outputs, and clean up after themselves. Know when you need `-r` and when you don\'t.',
    substeps: [
      {
        id: '5.1',
        text: 'Navigate to `Round900`. Write expected and actual output files: `echo "AC" > A/tests/expected.txt` and `echo "AC" > A/tests/actual.txt`.',
        hint: 'Type: cd Round900 path, then echo "AC" > A/tests/expected.txt  and  echo "AC" > A/tests/actual.txt',
        validate: (fs) => {
          const base = '/home/user/CP/Codeforces/Round900/A/tests';
          const exp = resolvePath(fs, `${base}/expected.txt`);
          const act = resolvePath(fs, `${base}/actual.txt`);
          return exp && exp.content && act && act.content;
        },
      },
      {
        id: '5.2',
        text: 'Run `diff A/tests/expected.txt A/tests/actual.txt` — no output means files match.',
        hint: 'Type: diff A/tests/expected.txt A/tests/actual.txt',
        validate: (_fs, _cwd, history) => {
          return history.some(
            (c) =>
              c.startsWith('diff') &&
              c.includes('expected.txt') &&
              c.includes('actual.txt'),
          );
        },
      },
      {
        id: '5.3',
        text: 'Remove the backup file `A/tests/A_sol_backup.cpp` using `rm` (no `-r` needed).',
        hint: 'Type: rm A/tests/A_sol_backup.cpp',
        validate: (fs) => {
          return !nodeExists(fs, '/home/user/CP/Codeforces/Round900/A/tests/A_sol_backup.cpp');
        },
      },
      {
        id: '5.4',
        text: 'Try `rm B/tests` (without `-r`) — observe the error. Then remove it correctly with `rm -r B/tests`.',
        hint: 'Type: rm B/tests  (see error)  then  rm -r B/tests',
        validate: (fs, _cwd, history) => {
          const gone = !nodeExists(fs, '/home/user/CP/Codeforces/Round900/B/tests');
          const failedAttempt = history.some(
            (c) => {
              const t = c.trim();
              return t === 'rm B/tests' || t === 'rm  B/tests';
            },
          );
          const succeeded = history.some(
            (c) => c.startsWith('rm') && c.includes('-r') && c.includes('B/tests'),
          );
          return gone && failedAttempt && succeeded;
        },
      },
      {
        id: '5.5',
        text: 'Remove the hidden `.flags` file using `rm .flags`.',
        hint: 'Type: rm .flags',
        validate: (fs) => {
          return !nodeExists(fs, '/home/user/CP/Codeforces/Round900/.flags');
        },
      },
    ],
  },

  // ─── Level 6 — Full Contest Simulation ─────────────────────────────────
  {
    id: 6,
    title: 'Full Contest Simulation',
    context:
      'Speed round. Set up problems B and C from scratch, compile with full flags, and execute. This simulates a real contest workflow — do it cleanly.',
    substeps: [
      {
        id: '6.1',
        text: 'Navigate to `B`. Create `B_sol.cpp` and write mock code into it.',
        hint: 'Type: cd ../B  then  touch B_sol.cpp  then  echo "#include <bits/stdc++.h>" > B_sol.cpp',
        validate: (fs) => {
          const node = resolvePath(fs, '/home/user/CP/Codeforces/Round900/B/B_sol.cpp');
          return node && node.content && node.content.length > 0;
        },
      },
      {
        id: '6.2',
        text: 'Compile with full flags: `g++ -std=c++20 -O2 -Wall -Wextra -o B_sol B_sol.cpp`. Then run `./B_sol`.',
        hint: 'Type: g++ -std=c++20 -O2 -Wall -Wextra -o B_sol B_sol.cpp  then  ./B_sol',
        validate: (fs, _cwd, history) => {
          const binExists = nodeExists(fs, '/home/user/CP/Codeforces/Round900/B/B_sol');
          const gpp = history.some(
            (c) =>
              c.startsWith('g++') &&
              c.includes('-std=c++20') &&
              c.includes('-O2') &&
              c.includes('-Wall') &&
              c.includes('-Wextra') &&
              c.includes('B_sol.cpp'),
          );
          const ran = history.some((c) => c.includes('./B_sol'));
          return binExists && gpp && ran;
        },
      },
      {
        id: '6.3',
        text: 'Navigate to `C`. Create `C_sol.cpp` and write mock code.',
        hint: 'Type: cd ../C  then  touch C_sol.cpp  then  echo "#include <bits/stdc++.h>" > C_sol.cpp',
        validate: (fs) => {
          const node = resolvePath(fs, '/home/user/CP/Codeforces/Round900/C/C_sol.cpp');
          return node && node.content && node.content.length > 0;
        },
      },
      {
        id: '6.4',
        text: 'Compile with full flags: `g++ -std=c++20 -O2 -Wall -Wextra -o C_sol C_sol.cpp`. Then run `./C_sol`.',
        hint: 'Type: g++ -std=c++20 -O2 -Wall -Wextra -o C_sol C_sol.cpp  then  ./C_sol',
        validate: (fs, _cwd, history) => {
          const binExists = nodeExists(fs, '/home/user/CP/Codeforces/Round900/C/C_sol');
          const gpp = history.some(
            (c) =>
              c.startsWith('g++') &&
              c.includes('-std=c++20') &&
              c.includes('-O2') &&
              c.includes('-Wall') &&
              c.includes('-Wextra') &&
              c.includes('C_sol.cpp'),
          );
          const ran = history.some((c) => c.includes('./C_sol'));
          return binExists && gpp && ran;
        },
      },
      {
        id: '6.5',
        text: 'Navigate back to `Round900`. Run `ls -la` to survey your workspace.',
        hint: 'Type: cd ..  (or appropriate path)  then  ls -la',
        validate: (_fs, cwd, history) => {
          if (!cwd.endsWith('/Round900')) return false;
          if (history.length === 0) return false;
          const last = history[history.length - 1].trim();
          if (!last.startsWith('ls')) return false;
          const hasL = last.includes('-l') || last.includes('-la') || last.includes('-al');
          const hasA = last.includes('-a') || last.includes('-la') || last.includes('-al');
          return hasL && hasA;
        },
      },
      {
        id: '6.6',
        text: 'Clean up all binaries: `rm A/A_sol B/B_sol C/C_sol` (multiple paths in one command).',
        hint: 'Type: rm A/A_sol B/B_sol C/C_sol',
        validate: (fs, _cwd, history) => {
          const base = '/home/user/CP/Codeforces/Round900';
          const gone =
            !nodeExists(fs, `${base}/A/A_sol`) &&
            !nodeExists(fs, `${base}/B/B_sol`) &&
            !nodeExists(fs, `${base}/C/C_sol`);
          const singleCmd = history.some(
            (c) =>
              c.startsWith('rm') &&
              c.includes('A/A_sol') &&
              c.includes('B/B_sol') &&
              c.includes('C/C_sol'),
          );
          return gone && singleCmd;
        },
      },
    ],
  },
];

export default missions;
