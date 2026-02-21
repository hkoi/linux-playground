import {
  listDir,
  makeDir,
  createFile,
  removeNode,
  copyNode,
  moveNode,
  readFile,
  writeFile,
  resolvePath,
  resolveAbsolutePath,
  nodeExists,
} from './virtualFS';

/**
 * Parse a raw input string into tokens, respecting double-quote groups.
 * E.g.  echo "hello world" > f.txt  →  ['echo', 'hello world', '>', 'f.txt']
 */
function tokenize(input) {
  const tokens = [];
  let current = '';
  let inQuote = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === '"') {
      inQuote = !inQuote;
      continue;
    }
    if (!inQuote && (ch === ' ' || ch === '\t')) {
      if (current) { tokens.push(current); current = ''; }
      continue;
    }
    current += ch;
  }
  if (current) tokens.push(current);
  return tokens;
}

/** Separate flags (tokens starting with -) from positional args. */
function splitFlagsAndArgs(tokens) {
  const flags = [];
  const args = [];
  for (const t of tokens) {
    if (t.startsWith('-')) flags.push(t);
    else args.push(t);
  }
  return { flags, args };
}

/** Check if a set of flag tokens contains a given short flag (e.g. 'r' in ['-rf']). */
function hasFlag(flagTokens, flag) {
  for (const f of flagTokens) {
    if (f === `-${flag}`) return true;
    if (f.startsWith('-') && !f.startsWith('--') && f.includes(flag)) return true;
  }
  return false;
}

// ─── main entry ─────────────────────────────────────────────────────────────

/**
 * Returns { output: string[], newFsState, newCurrentDir, shouldClear }
 */
export function executeCommand(input, fsState, currentDir) {
  const trimmed = input.trim();
  if (!trimmed) return out([], fsState, currentDir);

  const tokens = tokenize(trimmed);
  const cmd = tokens[0];
  const rest = tokens.slice(1);

  // Handle ./executable pattern
  if (cmd.startsWith('./')) {
    return handleExec(cmd, rest, fsState, currentDir);
  }

  switch (cmd) {
    case 'pwd':   return handlePwd(fsState, currentDir);
    case 'ls':    return handleLs(rest, fsState, currentDir);
    case 'cd':    return handleCd(rest, fsState, currentDir);
    case 'mkdir': return handleMkdir(rest, fsState, currentDir);
    case 'touch': return handleTouch(rest, fsState, currentDir);
    case 'rm':    return handleRm(rest, fsState, currentDir);
    case 'cp':    return handleCp(rest, fsState, currentDir);
    case 'mv':    return handleMv(rest, fsState, currentDir);
    case 'cat':   return handleCat(rest, fsState, currentDir);
    case 'echo':  return handleEcho(rest, fsState, currentDir);
    case 'diff':  return handleDiff(rest, fsState, currentDir);
    case 'g++':   return handleGpp(rest, fsState, currentDir);
    case 'clear': return out([], fsState, currentDir, true);
    case 'help':  return handleHelp(fsState, currentDir);
    default:
      return out([`bash: ${cmd}: command not found`], fsState, currentDir);
  }
}

function out(output, fs, cwd, shouldClear = false) {
  return {
    output: Array.isArray(output) ? output : [output],
    newFsState: fs,
    newCurrentDir: cwd,
    shouldClear,
  };
}

// ─── pwd ────────────────────────────────────────────────────────────────────

function handlePwd(fs, cwd) {
  return out([cwd], fs, cwd);
}

// ─── ls ─────────────────────────────────────────────────────────────────────

function handleLs(tokens, fs, cwd) {
  const { flags, args } = splitFlagsAndArgs(tokens);
  const showAll = hasFlag(flags, 'a');
  const longFmt = hasFlag(flags, 'l');
  const target = args[0] || '.';

  const res = listDir(fs, target, cwd);
  if (res.error) return out([res.error], fs, cwd);

  if (res.isSingleFile) {
    if (longFmt) {
      return out([`-rw-r--r-- 1 user user    0 Jan  1 00:00 ${res.entries[0]}`], fs, cwd);
    }
    return out([res.entries[0]], fs, cwd);
  }

  let entries = res.entries;
  if (!showAll) {
    entries = entries.filter((n) => !n.startsWith('.'));
  }

  if (longFmt) {
    const lines = [];
    if (showAll) {
      lines.push('drwxr-xr-x 2 user user 4096 Jan  1 00:00 .');
      lines.push('drwxr-xr-x 2 user user 4096 Jan  1 00:00 ..');
    }
    const dirNode = resolvePath(fs, target, cwd);
    for (const name of entries) {
      const child = dirNode.children[name];
      const isDir = child && child.type === 'dir';
      const size = child && child.content ? child.content.length : 0;
      const prefix = isDir ? 'drwxr-xr-x' : '-rw-r--r--';
      const sizeStr = String(isDir ? 4096 : size).padStart(5);
      lines.push(`${prefix} 1 user user ${sizeStr} Jan  1 00:00 ${name}`);
    }
    return out(lines, fs, cwd);
  }

  if (showAll) {
    entries = ['.', '..', ...entries];
  }

  if (entries.length === 0) return out([], fs, cwd);

  const dirNode = resolvePath(fs, target, cwd);
  const formatted = entries.map((name) => {
    if (name === '.' || name === '..') return name;
    const child = dirNode.children[name];
    return child && child.type === 'dir' ? name + '/' : name;
  });

  return out([formatted.join('  ')], fs, cwd);
}

// ─── cd ─────────────────────────────────────────────────────────────────────

function handleCd(tokens, fs, cwd) {
  let target = tokens[0] || '/home/user';
  
  // Expand ~ to /home/user
  if (target === '~' || target.startsWith('~/')) {
    target = target.replace(/^~/, '/home/user');
  }
  
  const abs = resolveAbsolutePath(target, cwd);
  const node = resolvePath(fs, target, cwd);
  if (!node) return out([`bash: cd: ${tokens[0] || '~'}: No such file or directory`], fs, cwd);
  if (node.type !== 'dir') return out([`bash: cd: ${tokens[0] || '~'}: Not a directory`], fs, cwd);
  return out([], fs, abs);
}

// ─── mkdir ──────────────────────────────────────────────────────────────────

function handleMkdir(tokens, fs, cwd) {
  if (tokens.length === 0) return out(['mkdir: missing operand'], fs, cwd);
  const { flags, args } = splitFlagsAndArgs(tokens);
  const recursive = hasFlag(flags, 'p');
  if (args.length === 0) return out(['mkdir: missing operand'], fs, cwd);

  let currentFS = fs;
  const errors = [];
  for (const a of args) {
    const { root, error } = makeDir(currentFS, a, cwd, recursive);
    currentFS = root;
    if (error) errors.push(error);
  }
  return out(errors, currentFS, cwd);
}

// ─── touch ──────────────────────────────────────────────────────────────────

function handleTouch(tokens, fs, cwd) {
  if (tokens.length === 0) return out(['touch: missing file operand'], fs, cwd);
  let currentFS = fs;
  const errors = [];
  for (const a of tokens) {
    const { root, error } = createFile(currentFS, a, cwd);
    currentFS = root;
    if (error) errors.push(error);
  }
  return out(errors, currentFS, cwd);
}

// ─── rm ─────────────────────────────────────────────────────────────────────

function handleRm(tokens, fs, cwd) {
  if (tokens.length === 0) return out(['rm: missing operand'], fs, cwd);
  const { flags, args } = splitFlagsAndArgs(tokens);
  // Only -r (or compound flags containing 'r' like -rf, -fr) enables recursive
  const recursive = flags.some((f) => f.includes('r'));
  if (args.length === 0) return out(['rm: missing operand'], fs, cwd);

  let currentFS = fs;
  const errors = [];
  for (const a of args) {
    const { root, error } = removeNode(currentFS, a, cwd, recursive);
    currentFS = root;
    if (error) errors.push(error);
  }
  return out(errors, currentFS, cwd);
}

// ─── cp ─────────────────────────────────────────────────────────────────────

function handleCp(tokens, fs, cwd) {
  if (tokens.length < 2) return out(['cp: missing operand'], fs, cwd);
  const { flags, args } = splitFlagsAndArgs(tokens);
  const recursive = hasFlag(flags, 'r');
  if (args.length < 2) return out(['cp: missing destination operand'], fs, cwd);
  const src = args[0];
  const dest = args[1];
  const { root, error } = copyNode(fs, src, dest, cwd, recursive);
  if (error) return out([error], root, cwd);
  return out([], root, cwd);
}

// ─── mv ─────────────────────────────────────────────────────────────────────

function handleMv(tokens, fs, cwd) {
  if (tokens.length < 2) return out(['mv: missing operand'], fs, cwd);
  const src = tokens[0];
  const dest = tokens[1];
  const { root, error } = moveNode(fs, src, dest, cwd);
  if (error) return out([error], root, cwd);
  return out([], root, cwd);
}

// ─── cat ────────────────────────────────────────────────────────────────────

function handleCat(tokens, fs, cwd) {
  if (tokens.length === 0) return out(['cat: missing operand'], fs, cwd);
  const { content, error } = readFile(fs, tokens[0], cwd);
  if (error) return out([error], fs, cwd);
  if (!content) return out([], fs, cwd);
  return out(content.split('\n'), fs, cwd);
}

// ─── echo ───────────────────────────────────────────────────────────────────

function handleEcho(tokens, fs, cwd) {
  // find redirection operators
  let redirectIdx = -1;
  let append = false;
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i] === '>>') { redirectIdx = i; append = true; break; }
    if (tokens[i] === '>') { redirectIdx = i; append = false; break; }
  }

  if (redirectIdx === -1) {
    // just print
    return out([tokens.join(' ')], fs, cwd);
  }

  const textParts = tokens.slice(0, redirectIdx);
  const filePath = tokens[redirectIdx + 1];
  if (!filePath) return out(['bash: syntax error near unexpected token `newline\''], fs, cwd);

  const text = textParts.join(' ');
  const content = append ? text + '\n' : text;
  const { root, error } = writeFile(fs, filePath, cwd, content, append);
  if (error) return out([error], root, cwd);
  return out([], root, cwd);
}

// ─── diff ───────────────────────────────────────────────────────────────────

function handleDiff(tokens, fs, cwd) {
  if (tokens.length < 2) return out(['diff: missing operand'], fs, cwd);
  const a = readFile(fs, tokens[0], cwd);
  if (a.error) return out([`diff: ${tokens[0]}: No such file or directory`], fs, cwd);
  const b = readFile(fs, tokens[1], cwd);
  if (b.error) return out([`diff: ${tokens[1]}: No such file or directory`], fs, cwd);

  if (a.content === b.content) return out([], fs, cwd);

  const lines = [];
  lines.push(`--- ${tokens[0]}`);
  lines.push(`+++ ${tokens[1]}`);
  const aLines = (a.content || '').split('\n');
  const bLines = (b.content || '').split('\n');
  const max = Math.max(aLines.length, bLines.length);
  for (let i = 0; i < max; i++) {
    if (aLines[i] !== bLines[i]) {
      if (aLines[i] !== undefined) lines.push(`- ${aLines[i]}`);
      if (bLines[i] !== undefined) lines.push(`+ ${bLines[i]}`);
    }
  }
  return out(lines, fs, cwd);
}

// ─── g++ ────────────────────────────────────────────────────────────────────

function handleGpp(tokens, fs, cwd) {
  if (tokens.length === 0) return out(['g++: fatal error: no input files'], fs, cwd);

  const { flags, args } = splitFlagsAndArgs(tokens);

  // Separate known flags
  let outputName = 'a.out';
  let standard = '';
  let optimize = '';
  const warnings = [];
  const unknownFlags = [];

  for (let i = 0; i < flags.length; i++) {
    const f = flags[i];
    if (f === '-o') {
      // next arg is the output name — but it's in args since it doesn't start with -
      // Actually -o might be followed by a positional arg. Handle in second pass.
      continue;
    }
    if (f.startsWith('-std=')) {
      standard = f.replace('-std=', '');
    } else if (f.startsWith('-O')) {
      optimize = f;
    } else if (f === '-Wall') {
      warnings.push('Wall');
    } else if (f === '-Wextra') {
      warnings.push('Wextra');
    } else {
      unknownFlags.push(f);
    }
  }

  // Handle -o <name>: scan full token list for -o followed by next token
  const allTokens = tokens;
  for (let i = 0; i < allTokens.length; i++) {
    if (allTokens[i] === '-o' && allTokens[i + 1]) {
      outputName = allTokens[i + 1];
      break;
    }
  }

  // Collect source files (.cpp / .c files from args, excluding -o target)
  const oIdx = allTokens.indexOf('-o');
  const oTarget = oIdx >= 0 ? allTokens[oIdx + 1] : null;
  const sourceFiles = args.filter((a) => (a.endsWith('.cpp') || a.endsWith('.c')) && a !== oTarget);

  if (sourceFiles.length === 0) return out(['g++: fatal error: no input files'], fs, cwd);

  // Check each source exists
  for (const src of sourceFiles) {
    if (!nodeExists(fs, src, cwd)) {
      return out([`g++: error: ${src}: No such file or directory`, 'compilation terminated.'], fs, cwd);
    }
  }

  // Build summary tags
  const tags = [];
  if (standard) tags.push(`[${standard.toUpperCase().replace('C++', 'C++')}]`);
  if (optimize) tags.push(`[${optimize}]`);
  for (const w of warnings) tags.push(`[${w}]`);

  const summary = `${tags.length ? tags.join(' ') + ' ' : ''}Compiled ${sourceFiles.join(', ')} → ${outputName}`;

  // Create binary file
  const { root, error } = createFile(fs, outputName, cwd, `[binary:${sourceFiles.join(',')}]`, { isBinary: true });
  if (error) return out([error], root, cwd);

  const output = [];
  if (standard) output.push(`Compiling with ${standard.replace('c++', 'C++')} standard...`);
  if (optimize) output.push(`Optimization level: ${optimize}`);
  if (warnings.length) output.push(`Warnings enabled: ${warnings.join(', ')}`);
  output.push(summary);

  return out(output, root, cwd);
}

// ─── ./<exec> ───────────────────────────────────────────────────────────────

function handleExec(cmd, tokens, fs, cwd) {
  const name = cmd.slice(2); // strip ./
  if (!nodeExists(fs, name, cwd)) {
    return out([`bash: ${cmd}: No such file or directory`], fs, cwd);
  }
  const node = resolvePath(fs, name, cwd);
  if (node.type === 'dir') {
    return out([`bash: ${cmd}: Is a directory`], fs, cwd);
  }

  // Check for input redirection: < filename
  let inputFile = null;
  const ltIdx = tokens.indexOf('<');
  if (ltIdx >= 0 && tokens[ltIdx + 1]) {
    inputFile = tokens[ltIdx + 1];
    if (!nodeExists(fs, inputFile, cwd)) {
      return out([`bash: ${inputFile}: No such file or directory`], fs, cwd);
    }
  }

  if (inputFile) {
    return out([`[Executed ${cmd} with input from ${inputFile} — 0ms, 0 KB]`], fs, cwd);
  }
  return out([`[Executed ${cmd} — 0ms, 0 KB]`], fs, cwd);
}

// ─── help ───────────────────────────────────────────────────────────────────

function handleHelp(fs, cwd) {
  return out([
    'Available commands:',
    '  pwd                         Print working directory',
    '  ls [-a] [-l] [path]         List directory contents',
    '  cd [path]                   Change directory',
    '  mkdir [-p] <name ...>       Create directories',
    '  touch <file ...>            Create empty files',
    '  rm [-r] <path ...>          Remove files or directories',
    '  cp [-r] <src> <dest>        Copy files or directories',
    '  mv <src> <dest>             Move or rename',
    '  cat <file>                  Display file contents',
    '  echo <text> [> file]        Print text or write to file',
    '  diff <file1> <file2>        Compare two files',
    '  g++ [flags] <file.cpp>      Compile C++ source',
    '  ./<binary> [< input]        Execute a compiled binary',
    '  clear                       Clear terminal',
    '  help                        Show this message',
  ], fs, cwd);
}
