var WORDS = [];
var TRIE_ROOT = null;

var BOARD = "OATRIHPSHTNRENEI";
var DEFAULT_BOARD = "OATRIHPSHTNRENEI";

// Frontend elements
var boardGrid = null;
var statusElement = null;
// var wordCountElement = null;

// var resetBoardBtn = null;
// var clearBoardBtn = null;
// var findWordsBtn = null;

// Current editing state
var currentEditingCell = null;

// Word navigation state
var foundWordsWithPaths = [];
var currentWordIndex = 0;
var prevWordBtn = null;
var nextWordBtn = null;
var currentWordElement = null;

// Add flags to prevent duplicate or premature calls
var isWordListLoaded = false;
var isLoadingWordList = false;
var isGameStarted = false;
var isFindingWords = false;

// Web Worker for word search
var wordhuntWorker = null;
var workerReady = false;
var workerQueue = [];

function initWorker() {
    if (wordhuntWorker) return;
    wordhuntWorker = new Worker('js/wordhunt_worker.js');
    wordhuntWorker.onmessage = function(e) {
        const { type, success, words, error } = e.data;
        if (type === 'init') {
            workerReady = true;
            // Process any queued board searches
            while (workerQueue.length > 0) {
                const board = workerQueue.shift();
                sendBoardToWorker(board);
            }
        } else if (type === 'search') {
            isFindingWords = false;
            if (error) {
                updateStatus('Worker error: ' + error);
                foundWordsWithPaths = [];
                displayWordAtIndex(0);
                return;
            }
            foundWordsWithPaths = words;
            currentWordIndex = 0;
            displayWordAtIndex(currentWordIndex);
            updateStatus(`Found ${foundWordsWithPaths.length} words`);
        }
    };
}

function sendBoardToWorker(boardString) {
    if (!workerReady) {
        workerQueue.push(boardString);
        return;
    }
    isFindingWords = true;
    wordhuntWorker.postMessage({ type: 'search', data: boardString });
}

// Trie functions
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

function updateBoardString() {
    const cells = boardGrid.querySelectorAll('.board-cell');
    BOARD = '';
    cells.forEach(cell => {
        BOARD += cell.textContent || 'A';
    });
    console.log('Board updated:', BOARD);
}

function createBoardGrid() {
    const grid = document.getElementById('board-grid');
    if (!grid) {
        console.error('Board grid element not found!');
        return;
    }

    console.log('Creating board grid...');
    grid.innerHTML = '';

    for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
            const cell = document.createElement('div');
            cell.className = 'board-cell';
            cell.textContent = BOARD[i * 4 + j];
            cell.dataset.row = i;
            cell.dataset.col = j;

            // Add click event for editing
            cell.addEventListener('click', () => startEditingCell(cell));

            grid.appendChild(cell);
        }
    }

    console.log(`Created ${grid.children.length} cells`);
}

var cellInput = null;
var isTouchDevice = false;

function isProbablyTouchDevice() {
    return (
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        navigator.msMaxTouchPoints > 0
    );
}

function startEditingCell(cell) {
    // Clear previous editing state
    if (currentEditingCell) {
        currentEditingCell.classList.remove('editing');
    }

    currentEditingCell = cell;
    cell.classList.add('editing');

    if (isTouchDevice && cellInput) {
        // Move the input near the cell (optional, for accessibility)
        const rect = cell.getBoundingClientRect();
        cellInput.style.top = rect.top + window.scrollY + 'px';
        cellInput.style.left = rect.left + window.scrollX + 'px';
        cellInput.value = '';
        cellInput.focus();
    } else {
        // Focus on the cell for keyboard input (desktop)
        cell.focus();
    }

    console.log('Editing cell:', cell.dataset.row, cell.dataset.col);
}

function handleCellInput(e) {
    if (!currentEditingCell) return;
    const val = e.target.value.toUpperCase();
    if (val.length === 1 && /[A-Z]/.test(val)) {
        currentEditingCell.textContent = val;
        currentEditingCell.classList.remove('editing');
        currentEditingCell = null;
        updateBoardString();
        clearWordList();
        findWordsInBoard();
        cellInput.value = '';
    }
}

function handleKeyPress(event) {
    if (!currentEditingCell) return;
    if (isTouchDevice) return; // Don't handle on-screen keyboard events
    const key = event.key.toUpperCase();
    // Only allow single letters A-Z
    if (key.length === 1 && /[A-Z]/.test(key)) {
        currentEditingCell.textContent = key;
        currentEditingCell.classList.remove('editing');
        currentEditingCell = null;
        updateBoardString();
        clearWordList();
        findWordsInBoard();
        event.preventDefault();
    } else if (event.key === 'Escape') {
        // Cancel editing
        currentEditingCell.classList.remove('editing');
        currentEditingCell = null;
        event.preventDefault();
    }
}

function clearBoard() {
    const cells = boardGrid.querySelectorAll('.board-cell');
    cells.forEach(cell => {
        cell.textContent = 'A';
    });
    updateBoardString();
    clearWordList();
    updateStatus('Board cleared');
    findWordsInBoard();
}

function resetBoard() {
    BOARD = DEFAULT_BOARD;
    const cells = boardGrid.querySelectorAll('.board-cell');
    cells.forEach((cell, index) => {
        cell.textContent = BOARD[index];
    });
    clearWordList();
    updateStatus('Board reset to default');
    findWordsInBoard();
}

function displayWordAtIndex(index) {
    // Remove previous highlights
    document.querySelectorAll('.board-cell').forEach(cell => cell.classList.remove('selected'));

    if (!foundWordsWithPaths.length) {
        currentWordElement.textContent = 'No words found';
        updateStatus('No words found');
        return;
    }
    if (index < 0 || index >= foundWordsWithPaths.length) return;

    const { word, path } = foundWordsWithPaths[index];
    currentWordElement.textContent = word;
    updateStatus(`Showing word ${index + 1} of ${foundWordsWithPaths.length}`);

    // Highlight the path
    path.forEach(([row, col]) => {
        const cell = boardGrid.querySelector(`.board-cell[data-row="${row}"][data-col="${col}"]`);
        if (cell) cell.classList.add('selected');
    });
}

function showPrevWord() {
    if (!foundWordsWithPaths.length) return;
    currentWordIndex = (currentWordIndex - 1 + foundWordsWithPaths.length) % foundWordsWithPaths.length;
    displayWordAtIndex(currentWordIndex);
}

function showNextWord() {
    if (!foundWordsWithPaths.length) return;
    currentWordIndex = (currentWordIndex + 1) % foundWordsWithPaths.length;
    displayWordAtIndex(currentWordIndex);
}

function findWordsInBoard() {
    if (!isWordListLoaded || isFindingWords) return;
    // Send the board to the worker for searching
    sendBoardToWorker(BOARD);
}

function clearWordList() {
    foundWordsWithPaths = [];
    currentWordIndex = 0;
    if (currentWordElement) currentWordElement.textContent = '';
    // updateWordCount(0); // removed
    // Remove highlights
    document.querySelectorAll('.board-cell').forEach(cell => cell.classList.remove('selected'));
}

function updateStatus(message) {
    if (statusElement) {
        statusElement.textContent = message;
        console.log('Status updated:', message);
    } else {
        console.error('Status element not found!');
    }
}

function prettyPrintBoard(boardString) {
    console.log("Board Layout:");
    console.log("┌───┬───┬───┬───┐");
    for (let i = 0; i < 4; i++) {
        let row = "│";
        for (let j = 0; j < 4; j++) {
            const letter = boardString[i * 4 + j];
            row += ` ${letter} │`;
        }
        console.log(row);
        if (i < 3) {
            console.log("├───┼───┼───┼───┤");
        }
    }
    console.log("└───┴───┴───┴───┘");
}

async function loadWordList() {
    if (isWordListLoaded || isLoadingWordList) return;
    isLoadingWordList = true;
    try {
        updateStatus('Loading word list...');
        const response = await fetch('/words.txt');
        if (!response.ok) throw new Error(`Failed to load word list: ${response.status} ${response.statusText}`);
        const text = await response.text();
        const lines = text.split(/\r?\n/);
        const filteredWords = lines.map(line => line.trim()).filter(word => word.length > 0);
        WORDS = filteredWords;
        // Initialize the worker and send the word list
        initWorker();
        wordhuntWorker.postMessage({ type: 'init', data: filteredWords });
        // No longer build Trie in main thread
        if (filteredWords.length === 0) updateStatus('No words loaded. Check your word list.');
    } catch (error) {
        console.error('Error loading word list:', error);
        updateStatus('Error loading word list');
        WORDS = [];
    } finally {
        isWordListLoaded = true;
        isLoadingWordList = false;
    }
}

function initializeFrontend() {
    console.log('Initializing frontend...');

    // Initialize frontend elements
    boardGrid = document.getElementById('board-grid');
    statusElement = document.getElementById('status');
    // wordCountElement = document.getElementById('word-count');
    // resetBoardBtn = document.getElementById('reset-board');
    // clearBoardBtn = document.getElementById('clear-board');
    // findWordsBtn = document.getElementById('find-words');
    prevWordBtn = document.getElementById('prev-word');
    nextWordBtn = document.getElementById('next-word');
    currentWordElement = document.getElementById('current-word');
    cellInput = document.getElementById('cell-input');
    isTouchDevice = isProbablyTouchDevice();

    console.log('Board grid element:', boardGrid);
    console.log('Status element:', statusElement);
    // console.log('Word count element:', wordCountElement);

    if (!boardGrid || !statusElement || !prevWordBtn || !nextWordBtn || !currentWordElement) {
        console.error('Some frontend elements not found!');
        return false;
    }

    // Create the board grid
    createBoardGrid();

    // Add event listeners for controls
    // if (resetBoardBtn) resetBoardBtn.addEventListener('click', resetBoard);
    // if (clearBoardBtn) clearBoardBtn.addEventListener('click', clearBoard);
    // if (findWordsBtn) findWordsBtn.addEventListener('click', findWordsInBoard);
    if (prevWordBtn) prevWordBtn.addEventListener('click', showPrevWord);
    if (nextWordBtn) nextWordBtn.addEventListener('click', showNextWord);
    if (cellInput) {
        cellInput.addEventListener('input', handleCellInput);
    }

    // Add keyboard event listener
    document.addEventListener('keydown', handleKeyPress);

    return true;
}

function tryInitialize() {
    if (initializeFrontend()) {
        return true;
    }

    // If initialization failed, try again after a short delay
    console.log('Retrying initialization...');
    setTimeout(() => {
        if (initializeFrontend()) {
            // Start the game logic
            startGame();
        } else {
            console.error('Failed to initialize after retry');
        }
    }, 100);

    return false;
}

async function startGame() {
    if (isGameStarted) return;
    isGameStarted = true;
    console.log('Starting game...');
    // Load word list and find words
    await loadWordList();
    // Only reset if words loaded successfully
    if (WORDS.length > 0) {
        resetBoard();
    }
}

window.addEventListener('load', async () => {
    console.log('Page loaded, initializing...');

    // Initialize frontend
    if (!tryInitialize()) {
        // If first attempt failed, the retry mechanism will handle it
        return;
    }

    // Start the game
    startGame();
});
