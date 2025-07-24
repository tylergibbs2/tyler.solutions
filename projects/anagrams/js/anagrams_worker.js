// Web Worker for Anagrams word search

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

function findWordsFromLetters(letters) {
    const MIN_WORD_LENGTH = 3;
    const found = new Set();
    
    // Count letter frequencies
    const letterCount = {};
    for (const letter of letters) {
        letterCount[letter] = (letterCount[letter] || 0) + 1;
    }
    
    function canMakeWord(word) {
        const wordLetterCount = {};
        for (const char of word) {
            wordLetterCount[char] = (wordLetterCount[char] || 0) + 1;
        }
        
        for (const [char, count] of Object.entries(wordLetterCount)) {
            if (!letterCount[char] || letterCount[char] < count) {
                return false;
            }
        }
        return true;
    }
    
    // Check all words in the dictionary
    for (const word of WORDS) {
        if (word.length >= MIN_WORD_LENGTH && canMakeWord(word) && isWord(TRIE_ROOT, word)) {
            found.add(word);
        }
    }
    
    // Sort by length (longest first), then alphabetically
    const foundWords = Array.from(found).sort((a, b) => {
        if (b.length !== a.length) return b.length - a.length;
        return a.localeCompare(b);
    });
    
    return foundWords;
}

self.onmessage = function(e) {
    const { type, data } = e.data;
    if (type === 'init') {
        // data: array of words
        WORDS = data;
        TRIE_ROOT = buildTrie(WORDS);
        self.postMessage({ type: 'init', success: true });
    } else if (type === 'search') {
        // data: array of letters
        if (!TRIE_ROOT) {
            self.postMessage({ type: 'search', words: [], error: 'Trie not initialized' });
            return;
        }
        const results = findWordsFromLetters(data);
        self.postMessage({ type: 'search', words: results });
    }
};
