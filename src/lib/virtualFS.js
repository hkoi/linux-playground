/**
 * Virtual File System
 *
 * Tree of nodes:  { name, type:'dir'|'file', children:{}, content:'', isBinary:false }
 * All public helpers return NEW state objects (immutable pattern via deep-clone).
 */

// ─── helpers ────────────────────────────────────────────────────────────────

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function splitPath(p) {
  return p.split('/').filter(Boolean);
}

// ─── default state ──────────────────────────────────────────────────────────

export function createDefaultFS() {
  return {
    name: '/',
    type: 'dir',
    children: {
      home: {
        name: 'home',
        type: 'dir',
        children: {
          user: {
            name: 'user',
            type: 'dir',
            children: {},
          },
        },
      },
    },
  };
}

// ─── path resolution ────────────────────────────────────────────────────────

/** Normalise an absolute-or-relative path into a clean absolute path string. */
export function resolveAbsolutePath(pathStr, cwd = '/') {
  const raw = pathStr.startsWith('/') ? pathStr : `${cwd}/${pathStr}`;
  const parts = splitPath(raw);
  const resolved = [];
  for (const p of parts) {
    if (p === '.') continue;
    if (p === '..') { resolved.pop(); }
    else { resolved.push(p); }
  }
  return '/' + resolved.join('/');
}

/** Walk the tree to the node at `pathStr`. Returns null when absent. */
export function resolvePath(root, pathStr, cwd = '/') {
  const abs = resolveAbsolutePath(pathStr, cwd);
  const parts = splitPath(abs);
  let node = root;
  for (const seg of parts) {
    if (!node || node.type !== 'dir' || !node.children[seg]) return null;
    node = node.children[seg];
  }
  return node;
}

/** Return [parentNode, childName] for the last segment. */
function resolveParent(root, pathStr, cwd) {
  const abs = resolveAbsolutePath(pathStr, cwd);
  const parts = splitPath(abs);
  if (parts.length === 0) return [null, null];
  const childName = parts.pop();
  const parentNode = resolvePath(root, '/' + parts.join('/'));
  return [parentNode, childName];
}

// ─── queries ────────────────────────────────────────────────────────────────

export function nodeExists(root, pathStr, cwd = '/') {
  return resolvePath(root, pathStr, cwd) !== null;
}

/** List children names. Returns { entries, error }. */
export function listDir(root, pathStr, cwd = '/') {
  const node = resolvePath(root, pathStr, cwd);
  if (!node) return { error: `ls: cannot access '${pathStr}': No such file or directory` };
  if (node.type !== 'dir') {
    return { entries: [node.name], isSingleFile: true };
  }
  return { entries: Object.keys(node.children).sort() };
}

export function readFile(root, pathStr, cwd = '/') {
  const node = resolvePath(root, pathStr, cwd);
  if (!node) return { error: `cat: ${pathStr}: No such file or directory` };
  if (node.type === 'dir') return { error: `cat: ${pathStr}: Is a directory` };
  return { content: node.content || '' };
}

// ─── mutations (all return { root, error? }) ────────────────────────────────

export function makeDir(root, pathStr, cwd = '/', recursive = false) {
  const newRoot = deepClone(root);
  const abs = resolveAbsolutePath(pathStr, cwd);
  const parts = splitPath(abs);
  if (parts.length === 0) return { root: newRoot, error: "mkdir: cannot create directory '/': File exists" };

  if (recursive) {
    let node = newRoot;
    for (const seg of parts) {
      if (!node.children[seg]) {
        node.children[seg] = { name: seg, type: 'dir', children: {} };
      } else if (node.children[seg].type !== 'dir') {
        return { root: newRoot, error: `mkdir: cannot create directory '${pathStr}': Not a directory` };
      }
      node = node.children[seg];
    }
    return { root: newRoot };
  }

  const dirName = parts.pop();
  const parent = resolvePath(newRoot, '/' + parts.join('/'));
  if (!parent) return { root: newRoot, error: `mkdir: cannot create directory '${pathStr}': No such file or directory` };
  if (parent.type !== 'dir') return { root: newRoot, error: `mkdir: cannot create directory '${pathStr}': Not a directory` };
  if (parent.children[dirName]) return { root: newRoot, error: `mkdir: cannot create directory '${pathStr}': File exists` };
  parent.children[dirName] = { name: dirName, type: 'dir', children: {} };
  return { root: newRoot };
}

export function createFile(root, pathStr, cwd = '/', content = '', opts = {}) {
  const newRoot = deepClone(root);
  const abs = resolveAbsolutePath(pathStr, cwd);
  const parts = splitPath(abs);
  if (parts.length === 0) return { root: newRoot, error: "touch: cannot touch '/'" };

  const fileName = parts.pop();
  const parent = resolvePath(newRoot, '/' + parts.join('/'));
  if (!parent) return { root: newRoot, error: `touch: cannot touch '${pathStr}': No such file or directory` };
  if (parent.type !== 'dir') return { root: newRoot, error: `touch: cannot touch '${pathStr}': Not a directory` };

  if (!parent.children[fileName]) {
    parent.children[fileName] = { name: fileName, type: 'file', content, children: {}, ...opts };
  } else if (content !== undefined && content !== '') {
    parent.children[fileName].content = content;
    if (opts.isBinary !== undefined) parent.children[fileName].isBinary = opts.isBinary;
  }
  return { root: newRoot };
}

/** Overwrite or append content to a file; create it if absent. */
export function writeFile(root, pathStr, cwd = '/', content = '', append = false) {
  const newRoot = deepClone(root);
  const abs = resolveAbsolutePath(pathStr, cwd);
  const parts = splitPath(abs);
  if (parts.length === 0) return { root: newRoot, error: "cannot write to '/'" };

  const fileName = parts.pop();
  const parent = resolvePath(newRoot, '/' + parts.join('/'));
  if (!parent) return { root: newRoot, error: `bash: ${pathStr}: No such file or directory` };
  if (parent.type !== 'dir') return { root: newRoot, error: `bash: ${pathStr}: Not a directory` };

  if (!parent.children[fileName]) {
    parent.children[fileName] = { name: fileName, type: 'file', content, children: {} };
  } else if (parent.children[fileName].type === 'dir') {
    return { root: newRoot, error: `bash: ${pathStr}: Is a directory` };
  } else {
    parent.children[fileName].content = append
      ? (parent.children[fileName].content || '') + content
      : content;
  }
  return { root: newRoot };
}

export function removeNode(root, pathStr, cwd = '/', recursive = false) {
  const newRoot = deepClone(root);
  const abs = resolveAbsolutePath(pathStr, cwd);
  const parts = splitPath(abs);
  if (parts.length === 0) return { root: newRoot, error: "rm: cannot remove '/'" };

  const name = parts.pop();
  const parent = resolvePath(newRoot, '/' + parts.join('/'));
  if (!parent || !parent.children[name]) {
    return { root: newRoot, error: `rm: cannot remove '${pathStr}': No such file or directory` };
  }
  const target = parent.children[name];
  if (target.type === 'dir' && !recursive) {
    return { root: newRoot, error: `rm: cannot remove '${pathStr}': Is a directory` };
  }
  delete parent.children[name];
  return { root: newRoot };
}

export function copyNode(root, srcPath, destPath, cwd = '/', recursive = false) {
  const newRoot = deepClone(root);
  const srcNode = resolvePath(newRoot, srcPath, cwd);
  if (!srcNode) return { root: newRoot, error: `cp: cannot stat '${srcPath}': No such file or directory` };
  if (srcNode.type === 'dir' && !recursive) {
    return { root: newRoot, error: `cp: -r not specified; omitting directory '${srcPath}'` };
  }

  const absDest = resolveAbsolutePath(destPath, cwd);
  const destParts = splitPath(absDest);
  const destName = destParts.pop();
  const destParent = resolvePath(newRoot, '/' + destParts.join('/'));

  if (!destParent || destParent.type !== 'dir') {
    return { root: newRoot, error: `cp: cannot copy to '${destPath}': No such file or directory` };
  }

  if (destParent.children[destName] && destParent.children[destName].type === 'dir') {
    destParent.children[destName].children[srcNode.name] = deepClone(srcNode);
  } else {
    const clone = deepClone(srcNode);
    clone.name = destName;
    destParent.children[destName] = clone;
  }
  return { root: newRoot };
}

export function moveNode(root, srcPath, destPath, cwd = '/') {
  const newRoot = deepClone(root);
  const absSrc = resolveAbsolutePath(srcPath, cwd);
  const srcParts = splitPath(absSrc);
  const srcName = srcParts.pop();
  const srcParent = resolvePath(newRoot, '/' + srcParts.join('/'));

  if (!srcParent || !srcParent.children[srcName]) {
    return { root: newRoot, error: `mv: cannot stat '${srcPath}': No such file or directory` };
  }
  const srcNode = srcParent.children[srcName];

  const absDest = resolveAbsolutePath(destPath, cwd);
  const destParts = splitPath(absDest);
  const destName = destParts.pop();
  const destParent = resolvePath(newRoot, '/' + destParts.join('/'));

  if (!destParent || destParent.type !== 'dir') {
    return { root: newRoot, error: `mv: cannot move to '${destPath}': No such file or directory` };
  }

  if (destParent.children[destName] && destParent.children[destName].type === 'dir') {
    destParent.children[destName].children[srcName] = srcNode;
  } else {
    const moved = { ...srcNode, name: destName };
    if (srcNode.type === 'dir') moved.children = srcNode.children;
    destParent.children[destName] = moved;
  }

  delete srcParent.children[srcName];
  return { root: newRoot };
}

/** Get completions for a partial name in a directory. */
export function getCompletions(root, partialPath, cwd = '/') {
  // Handle empty or '.' - list current directory
  if (!partialPath || partialPath === '.') {
    const currentDir = resolvePath(root, cwd);
    if (!currentDir || currentDir.type !== 'dir') return [];
    return Object.keys(currentDir.children).sort().map((n) =>
      currentDir.children[n].type === 'dir' ? n + '/' : n
    );
  }

  // If partialPath ends with '/' the user wants children of that dir
  if (partialPath.endsWith('/')) {
    const dir = resolvePath(root, partialPath, cwd);
    if (!dir || dir.type !== 'dir') return [];
    return Object.keys(dir.children).sort().map((n) =>
      dir.children[n].type === 'dir' ? n + '/' : n
    );
  }

  const abs = resolveAbsolutePath(partialPath, cwd);
  const parts = splitPath(abs);
  const partial = parts.pop() || '';
  const parentPath = parts.length ? '/' + parts.join('/') : '/';
  const parentNode = resolvePath(root, parentPath);
  if (!parentNode || parentNode.type !== 'dir') return [];

  const prefix = partialPath.includes('/')
    ? partialPath.slice(0, partialPath.lastIndexOf('/') + 1)
    : '';

  return Object.keys(parentNode.children)
    .filter((n) => n.startsWith(partial))
    .sort()
    .map((n) => {
      const suffix = parentNode.children[n].type === 'dir' ? '/' : '';
      return prefix + n + suffix;
    });
}
