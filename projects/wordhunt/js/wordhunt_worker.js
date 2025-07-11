// Web Worker for Wordhunt word search

let WORDS = [];
let TRIE_ROOT = null;

function createTrieNode() {
    return {
        children: new Map(),
        isWord: false
    };
}

function insertWord(root, word) {
    let node = root;
    for (const char of word) {
        if (!node.children.has(char)) {
            node.children.set(char, createTrieNode());
        }
        node = node.children.get(char);
    }
    node.isWord = true;
}

function isPrefix(root, prefix) {
    let node = root;
    for (const char of prefix) {
        if (!node.children.has(char)) {
            return false;
        }
        node = node.children.get(char);
    }
    return true;
}

function isWord(root, word) {
    let node = root;
    for (const char of word) {
        if (!node.children.has(char)) {
            return false;
        }
        node = node.children.get(char);
    }
    return node.isWord;
}

function buildTrie(words) {
    const root = createTrieNode();
    for (const word of words) {
        insertWord(root, word);
    }
    return root;
}

function findWordsInBoard(boardString) {
    const BOARD_SIZE = 4;
    const MIN_WORD_LENGTH = 3;
    // Convert BOARD string to 2D array
    const board = [];
    for (let i = 0; i < BOARD_SIZE; i++) {
        board[i] = [];
        for (let j = 0; j < BOARD_SIZE; j++) {
            board[i][j] = boardString[i * BOARD_SIZE + j];
        }
    }
    const found = new Map(); // word -> path
    const directions = [
        [-1, -1], [-1, 0], [-1, 1],
        [0, -1],           [0, 1],
        [1, -1],  [1, 0],  [1, 1]
    ];
    function isValidPosition(row, col) {
        return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
    }
    function recurse(row, col, word, visited, path, depth) {
        if (depth > 16) return; // Prevent stack overflow
        if (!isValidPosition(row, col) || visited[row][col]) return;
        const currentWord = word + board[row][col];
        if (!isPrefix(TRIE_ROOT, currentWord)) return;
        visited[row][col] = true;
        path.push([row, col]);
        if (currentWord.length >= MIN_WORD_LENGTH && isWord(TRIE_ROOT, currentWord)) {
            if (!found.has(currentWord)) {
                found.set(currentWord, path.slice());
            }
        }
        for (const [dr, dc] of directions) {
            recurse(row + dr, col + dc, currentWord, visited, path, depth + 1);
        }
        visited[row][col] = false;
        path.pop();
    }
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            const visited = Array(BOARD_SIZE).fill().map(() => Array(BOARD_SIZE).fill(false));
            recurse(row, col, "", visited, [], 1);
        }
    }
    // Prepare the found words and paths for navigation
    const foundWordsWithPaths = Array.from(found.entries()).map(([word, path]) => ({ word, path }));
    foundWordsWithPaths.sort((a, b) => {
        if (b.word.length !== a.word.length) return b.word.length - a.word.length;
        return a.word.localeCompare(b.word);
    });
    return foundWordsWithPaths;
}

self.onmessage = function(e) {
    const { type, data } = e.data;
    if (type === 'init') {
        // data: array of words
        WORDS = data;
        TRIE_ROOT = buildTrie(WORDS);
        self.postMessage({ type: 'init', success: true });
    } else if (type === 'search') {
        // data: board string
        if (!TRIE_ROOT) {
            self.postMessage({ type: 'search', words: [], error: 'Trie not initialized' });
            return;
        }
        const results = findWordsInBoard(data);
        self.postMessage({ type: 'search', words: results });
    }
};