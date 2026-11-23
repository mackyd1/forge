"use strict";

const path = require("node:path");

// Capture the Parser class before init mutates the Emscripten module object.
const Parser = require("web-tree-sitter");

let initPromise = null;
const languageCache = new Map();

function coreWasmPath() {
  return path.join(process.cwd(), "node_modules", "web-tree-sitter", "tree-sitter.wasm");
}

function grammarWasmPath(fileName) {
  return path.join(process.cwd(), "node_modules", "tree-sitter-wasms", "out", fileName);
}

function ensureInit() {
  if (!initPromise) {
    initPromise = Parser.init({
      locateFile: (scriptName) =>
        scriptName.endsWith(".wasm") ? coreWasmPath() : scriptName,
    });
  }
  return initPromise;
}

const GRAMMAR_FILES = {
  typescript: "tree-sitter-typescript.wasm",
  tsx: "tree-sitter-tsx.wasm",
  javascript: "tree-sitter-javascript.wasm",
  python: "tree-sitter-python.wasm",
};

async function createParser() {
  await ensureInit();
  return new Parser();
}

async function loadLanguage(grammar) {
  await ensureInit();
  if (!languageCache.has(grammar)) {
    const file = GRAMMAR_FILES[grammar];
    if (!file) throw new Error(`Unsupported grammar: ${grammar}`);
    languageCache.set(grammar, Parser.Language.load(grammarWasmPath(file)));
  }
  return languageCache.get(grammar);
}

module.exports = {
  createParser,
  loadLanguage,
};
