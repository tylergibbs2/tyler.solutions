var BOX_HORIZONTAL_CHAR = "—";
var BOX_VERTICAL_CHAR = "|";
var BOX_CORNER_CHAR = "+"


var seenIndices = [];
let subtitles = [
    "Pioneer of writing subtitles",
    "Creator of Coyote/Mouse Simulation",
    "Ex-user of jQuery",
    "<i>is feeling great!</i>",
    "Software Engineer",
    "Backend Engineer",
    "Frontend Engineer",
    "Definitely doesn't make floating-point errors",
    "Pythonista",
    "React > Angular",
    "<i>undefined</i>",
    "Stardew Valley modder",
    "Software Engineer @ Fintech",
    "Simple is better!"
];

function randomizeSubtitle() {
    let subtitle = document.getElementById("description");

    if (seenIndices.length === subtitles.length)
        seenIndices.length = 0;

    let randomIdx = Math.floor(Math.random() * subtitles.length);;
    while (seenIndices.includes(randomIdx))
        randomIdx = Math.floor(Math.random() * subtitles.length);
    seenIndices.push(randomIdx);

    subtitle.innerHTML = subtitles[randomIdx];
    drawAsciiBox()
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

window.addEventListener('resize', drawAsciiBox);
window.onload = function () {
    document.getElementById("description").onclick = randomizeSubtitle;
    drawAsciiBox();
    randomizeSubtitle();
}
