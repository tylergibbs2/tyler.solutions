var BOX_HORIZONTAL_CHAR = "—";
var BOX_VERTICAL_CHAR = "|";
var BOX_CORNER_CHAR = "+"
var isTyping = false;
var isFirstLoad = true;


var seenIndices = [];
let subtitles = [
    "Software Engineer",
    "Pioneer of writing subtitles",
    "Creator of Coyote/Mouse Simulation",
    "Ex-user of jQuery",
    "is feeling great!",
    "Backend Engineer",
    "Frontend Engineer",
    "Definitely doesn't make floating-point errors",
    "Pythonista",
    "React > Angular",
    "undefined",
    "Stardew Valley modder",
    "Simple is better!",
    "Fintech Enthusiast",
    "Software Sorcerer"
];

function updateCursorPosition() {
    const last = document.querySelector('#last');
    if (!last)
        return;
    const lastRect = last.getBoundingClientRect();

    const cursor = document.querySelector('#cursor');
    cursor.style.left = `${lastRect.x}px`;
    cursor.style.top = `${lastRect.y}px`;
}


function typeEffect(element, text, callback) {
    if (isTyping) return;

    isTyping = true;
    let i = 0;
    element.innerHTML = '';

    function type() {
        if (i < text.length) {
            let currentText = text.substring(0, i + 1);
            let lastChar = currentText.charAt(currentText.length - 1);
            let newText = currentText.slice(0, -1) + `<span id="last">${lastChar}</span>`;
            element.innerHTML = newText;
            i++;
            drawAsciiBox();
            updateCursorPosition();
            setTimeout(type, Math.floor(Math.random() * 40) + 25);
        } else {
            if (text.length > 0) {
                let lastChar = text.charAt(text.length - 1);
                let fullTextWithSpan = text.slice(0, -1) + `<span id="last">${lastChar}</span>`;
                element.innerHTML = fullTextWithSpan;
            } else {
                element.innerHTML = '';
            }

            if (callback) {
                callback();
            }
        }
    }

    type();
}


function randomizeSubtitle() {
    let subtitle = document.getElementById("description");

    if (seenIndices.length === subtitles.length)
        seenIndices.length = 0;

    let randomIdx;
    if (isFirstLoad) {
        randomIdx = 0;
        isFirstLoad = false;
    } else {
        randomIdx = Math.floor(Math.random() * subtitles.length);
    }

    while (seenIndices.includes(randomIdx))
        randomIdx = Math.floor(Math.random() * subtitles.length);
    seenIndices.push(randomIdx);

    const newSubtitle = subtitles[randomIdx];
    typeEffect(subtitle, newSubtitle, () => isTyping = false);
}

function getCharacterDimensions(char) {
    const span = document.createElement('span');
    span.className = 'char-measure';
    span.textContent = char;
    document.body.appendChild(span);

    const width = span.offsetWidth;
    const height = span.offsetHeight;

    document.body.removeChild(span);

    return { width, height };
}

function drawAsciiBox() {
    const mainDiv = document.getElementById('main');
    const asciiBox = document.getElementById('ascii-box');
    const mainDivRect = mainDiv.getBoundingClientRect();

    const width = Math.round(mainDivRect.width);
    const height = Math.round(mainDivRect.height);

    let topCharCount = width / getCharacterDimensions(BOX_HORIZONTAL_CHAR).width;
    let sideCharCount = height / getCharacterDimensions(BOX_VERTICAL_CHAR).height - 3;

    const topBottomBorder = `${BOX_CORNER_CHAR}${BOX_HORIZONTAL_CHAR.repeat(topCharCount)}${BOX_CORNER_CHAR}\n`;
    let middleRows = '';
    for (let i = 0; i < sideCharCount; i++) {
        middleRows += `${BOX_VERTICAL_CHAR}${' '.repeat(topCharCount)}${BOX_VERTICAL_CHAR}\n`;
    }

    const box = topBottomBorder + middleRows + topBottomBorder;
    asciiBox.textContent = box;

    asciiBox.style.top = mainDivRect.top + 'px';
    asciiBox.style.left = mainDivRect.left + 'px';
    asciiBox.style.marginRight = '3px';
}

window.addEventListener('resize', () => {
    drawAsciiBox();
    updateCursorPosition();
});
window.onload = function () {
    document.getElementById("description").onclick = randomizeSubtitle;
    drawAsciiBox();
    randomizeSubtitle();
}

document.addEventListener('keydown', function(event) {
    if (event.key === 'Enter') {
        randomizeSubtitle();
    }
});