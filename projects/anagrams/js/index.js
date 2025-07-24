var WORDS = [];
var TRIE_ROOT = null;

var CURRENT_LETTERS = [];
var DEFAULT_LETTERS = ['P', 'A', 'I', 'N', 'T', 'S'];

// Frontend elements
var lettersGrid = null;
var statusElement = null;
var wordCountElement = null;
var wordListElement = null;
var bestWordElement = null;
var scoreElement = null;
var prevWordBtn = null;
var nextWordBtn = null;
var currentWordElement = null;
var cellInput = null;

// Game state
var foundWords = [];
var currentWordIndex = 0;
var isGameStarted = false;
var isWordListLoaded = false;
var isLoadingWordList = false;

// Current editing state
var currentEditingCell = null;

// Web Worker for word search
var anagramsWorker = null;
var workerReady = false;
var workerQueue = [];


function initWorker() {
    if (anagramsWorker) return;
    anagramsWorker = new Worker('js/anagrams_worker.js');
    anagramsWorker.onmessage = function(e) {
        const { type, success, words, error } = e.data;
        if (type === 'init') {
            workerReady = true;
            // Process any queued letter searches
            while (workerQueue.length > 0) {
                const letters = workerQueue.shift();
                sendLettersToWorker(letters);
            }
        } else if (type === 'search') {
            if (error) {
                updateStatus('Worker error: ' + error);
                foundWords = [];
                displayWordAtIndex(0);
                return;
            }
            foundWords = words;
            currentWordIndex = 0;
            displayWordAtIndex(currentWordIndex);
            updateWordCount();
            updateStatus(`Found ${foundWords.length} words`);
            // Update ASCII box after content changes
            if (typeof drawMainContentBorder === 'function') {
                drawMainContentBorder();
            }
        }
    };
}

function sendLettersToWorker(letters) {
    if (!workerReady) {
        workerQueue.push(letters);
        return;
    }
    anagramsWorker.postMessage({ type: 'search', data: letters });
}

function createLettersGrid() {
    const grid = document.getElementById('letters-grid');
    if (!grid) {
        console.error('Letters grid element not found!');
        return;
    }

    console.log('Creating letters grid...');
    grid.innerHTML = '';

    for (let i = 0; i < 6; i++) {
        const cell = document.createElement('div');
        cell.className = 'letter-cell';
        cell.textContent = CURRENT_LETTERS[i] || 'A';
        cell.dataset.index = i;

        // Add click event for editing
        cell.addEventListener('click', () => startEditingCell(cell));

        grid.appendChild(cell);
    }

    console.log(`Created ${grid.children.length} letter cells`);
}

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

    console.log('Editing cell:', cell.dataset.index);
}

function handleCellInput(e) {
    if (!currentEditingCell) return;
    const val = e.target.value.toUpperCase();
    if (val.length === 1 && /[A-Z]/.test(val)) {
        currentEditingCell.textContent = val;
        currentEditingCell.classList.remove('editing');
        currentEditingCell = null;
        updateLettersString();
        clearWordList();
        findWordsFromLetters();
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
        updateLettersString();
        clearWordList();
        findWordsFromLetters();
        event.preventDefault();
    } else if (event.key === 'Escape') {
        // Cancel editing
        currentEditingCell.classList.remove('editing');
        currentEditingCell = null;
        event.preventDefault();
    }
}

function updateLettersString() {
    const cells = lettersGrid.querySelectorAll('.letter-cell');
    CURRENT_LETTERS = [];
    cells.forEach(cell => {
        CURRENT_LETTERS.push(cell.textContent || 'A');
    });
    console.log('Letters updated:', CURRENT_LETTERS);
}

function displayWordAtIndex(index) {
    if (!foundWords.length) {
        if (currentWordElement) currentWordElement.textContent = 'No words found';
        updateStatus('No words found');
        return;
    }
    if (index < 0 || index >= foundWords.length) return;

    const word = foundWords[index];
    if (currentWordElement) currentWordElement.textContent = word;
    updateStatus(`Showing word ${index + 1} of ${foundWords.length}`);
}

function showPrevWord() {
    if (!foundWords.length) return;
    currentWordIndex = (currentWordIndex - 1 + foundWords.length) % foundWords.length;
    displayWordAtIndex(currentWordIndex);
}

function showNextWord() {
    if (!foundWords.length) return;
    currentWordIndex = (currentWordIndex + 1) % foundWords.length;
    displayWordAtIndex(currentWordIndex);
}

function updateWordCount() {
    if (wordCountElement) {
        wordCountElement.textContent = `Words: ${foundWords.length}`;
    }
}

function clearWordList() {
    foundWords = [];
    currentWordIndex = 0;
    updateWordCount();
    if (currentWordElement) currentWordElement.textContent = '';
    // Remove highlights
    document.querySelectorAll('.letter-cell').forEach(cell => cell.classList.remove('selected'));
}

function findWordsFromLetters() {
    if (!isWordListLoaded) return;
    // Send the letters to the worker for searching
    sendLettersToWorker(CURRENT_LETTERS);
}

function updateStatus(message) {
    if (statusElement) {
        statusElement.textContent = message;
        console.log('Status updated:', message);
    } else {
        console.error('Status element not found!');
    }
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
        anagramsWorker.postMessage({ type: 'init', data: filteredWords });
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
    lettersGrid = document.getElementById('letters-grid');
    statusElement = document.getElementById('status');
    wordCountElement = document.getElementById('word-count');
    wordListElement = document.getElementById('word-list');
    bestWordElement = document.getElementById('best-word');
    scoreElement = document.getElementById('score');
    prevWordBtn = document.getElementById('prev-word');
    nextWordBtn = document.getElementById('next-word');
    currentWordElement = document.getElementById('current-word');
    cellInput = document.getElementById('cell-input');
    isTouchDevice = isProbablyTouchDevice();

    console.log('Letters grid element:', lettersGrid);
    console.log('Status element:', statusElement);

    if (!lettersGrid || !statusElement || !prevWordBtn || !nextWordBtn || !currentWordElement) {
        console.error('Some frontend elements not found!');
        return false;
    }

    // Create the letters grid
    createLettersGrid();

    // Add event listeners
    prevWordBtn.addEventListener('click', showPrevWord);
    nextWordBtn.addEventListener('click', showNextWord);
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
    
    // Load word list
    await loadWordList();
    
    // Initialize with default letters
    if (CURRENT_LETTERS.length === 0) {
        CURRENT_LETTERS = [...DEFAULT_LETTERS];
    }
    
    createLettersGrid();
    findWordsFromLetters();
    updateStatus('Game ready! Click letters to edit them.');
    
    // Draw ASCII box around the content
    if (typeof drawMainContentBorder === 'function') {
        drawMainContentBorder();
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

// Update ASCII box on window resize
window.addEventListener('resize', () => {
    if (typeof drawMainContentBorder === 'function') {
        drawMainContentBorder();
    }
}); 