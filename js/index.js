var BOX_HORIZONTAL_CHAR = "—";
var BOX_VERTICAL_CHAR = "|";
var BOX_CORNER_CHAR = "+"
var isTyping = false;
var isFirstLoad = true;
var konamiCodePosition = 0;


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
    "Software Sorcerer",
    "The only winning move is not to play",
    "Would you like to play a game?"
];

const konamiCode = [
    'ArrowUp', 'ArrowUp',
    'ArrowDown', 'ArrowDown',
    'ArrowLeft', 'ArrowRight',
    'ArrowLeft', 'ArrowRight',
    'KeyB', 'KeyA'
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

async function displayTopLanguages() {
    let resp = await fetch("/language-stats.json");
    const languageStats = await resp.json();
    // const languageStats = JSON.parse(`[{"language": "C#", "percentage": 61.94081575948944, "color": {"color": "#178600", "url": "https://github.com/trending?l=Csharp"}}, {"language": "Python", "percentage": 20.74364767736641, "color": {"color": "#3572A5", "url": "https://github.com/trending?l=Python"}}, {"language": "TypeScript", "percentage": 9.171037242692433, "color": {"color": "#3178c6", "url": "https://github.com/trending?l=TypeScript"}}, {"language": "JavaScript", "percentage": 2.6794664415146925, "color": {"color": "#f1e05a", "url": "https://github.com/trending?l=JavaScript"}}, {"language": "HTML", "percentage": 2.2224567555284644, "color": {"color": "#e34c26", "url": "https://github.com/trending?l=HTML"}}, {"language": "Fluent", "percentage": 1.663353285416743, "color": {"color": "#ffcc33", "url": "https://github.com/trending?l=Fluent"}}, {"language": "Batchfile", "percentage": 0.6639972947301084, "color": {"color": "#C1F12E", "url": "https://github.com/trending?l=Batchfile"}}, {"language": "CSS", "percentage": 0.5151212956002748, "color": {"color": "#563d7c", "url": "https://github.com/trending?l=CSS"}}, {"language": "Shell", "percentage": 0.20629836800716808, "color": {"color": "#89e051", "url": "https://github.com/trending?l=Shell"}}, {"language": "SCSS", "percentage": 0.13155882561993973, "color": {"color": "#c6538c", "url": "https://github.com/trending?l=SCSS"}}, {"language": "Dockerfile", "percentage": 0.034634347019787674, "color": {"color": "#384d54", "url": "https://github.com/trending?l=Dockerfile"}}, {"language": "PLpgSQL", "percentage": 0.02761270701453221, "color": {"color": "#336790", "url": "https://github.com/trending?l=PLpgSQL"}}]`);

    const sortedLanguages = languageStats.sort((a, b) => b.percentage - a.percentage);

    const topLanguages = sortedLanguages.slice(0, 5);

    const languageBarContainer = document.getElementById('language-bar');

    const barWidth = 40;

    const typeBar = (barKey, numChars, color, index) => {
        const barSpan = document.createElement("span");
        barSpan.style.color = color;

        const div = document.createElement('div');
        div.className = 'language-bar';
        div.innerText = barKey;
        div.appendChild(barSpan);
        languageBarContainer.appendChild(div);

        let currentLength = 0;

        const type = () => {
            if (currentLength < numChars) {
                barSpan.innerText = '|' + '='.repeat(currentLength + 1);
                currentLength++;
                setTimeout(type, 30);
            }
        };

        setTimeout(type, 450 * index);
    };

    topLanguages.forEach((language, index) => {
        const langName = language.language;
        const percentage = language.percentage;

        const numChars = Math.max(Math.floor((percentage / 100) * barWidth), 1);
        const barKey = langName.slice(0, 10) + ' '.repeat(10 - langName.length);

        typeBar(barKey, numChars, language.color.color, index);
    });
}

function onKonamiCodeDetected() {
    let box = document.querySelector("#ascii-box");
    box.classList.add("rainbow");
  }

window.addEventListener('resize', () => {
    drawAsciiBox();
    updateCursorPosition();
});

window.addEventListener('scroll', () => {
    updateCursorPosition();
})

window.onload = function () {
    document.getElementById("description").onclick = randomizeSubtitle;
    drawAsciiBox();
    randomizeSubtitle();
    displayTopLanguages();
}

document.addEventListener('keydown', function(event) {
    const key = event.code;

    if (key === 'Enter') {
        randomizeSubtitle();
        return;
    }

    if (key === konamiCode[konamiCodePosition]) {
      konamiCodePosition++;

      if (konamiCodePosition === konamiCode.length) {
        onKonamiCodeDetected();
        konamiCodePosition = 0; // Reset the position for another detection
      }
    } else {
      konamiCodePosition = 0; // Reset if the sequence is broken
    }
});