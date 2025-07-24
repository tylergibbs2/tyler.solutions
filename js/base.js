var BOX_HORIZONTAL_CHAR = "—";
var BOX_VERTICAL_CHAR = "|";
var BOX_CORNER_CHAR = "+"
var isTyping = false;
var isFirstLoad = true;
var konamiCodePosition = 0;
var languageStats = [];


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
    "Would you like to play a game?",
    "Can you make a ticket for that?",
    "https://xkcd.com/353",
    "The great thing about standards is that there's so many to choose from",
    "Hacker",
    "Robin Hood of the Laundromat",
    "Bugs are merely a form of artistic expression",
    "Everything is configurable, just modify the source",
    "Try Pydantic!",
    "Red pill or blue pill?",
    "Hello, Friend",
    "Are you a one or a zero?",
    "Good news, everyone!",
    "Shut up and take my money!",
    "Not hot dog",
    "The bear is sticky with honey",
    "AI-driven",
    "VS Code is my preferred editor",
    "https://xkcd.com/1425",
    "If I'm not back in five minutes, just wait longer",
    "'tis but a scratch!",
    "It's just a flesh wound",
    "I'll be back",
    "May the force be with you"
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


function typeEffect(element, text, callback, includeSpan = false) {
    let i = 0;
    element.innerHTML = '';

    function type() {
        if (i < text.length) {
            let currentText = text.substring(0, i + 1);
            let lastChar = currentText.charAt(currentText.length - 1);
            let newText = includeSpan ? currentText.slice(0, -1) + `<span id="last">${lastChar}</span>` : currentText;
            element.innerHTML = newText;
            i++;
            drawMainContentBorder();
            updateCursorPosition();
            setTimeout(type, Math.floor(Math.random() * 40) + 25);
        } else {
            if (text.length > 0) {
                let lastChar = text.charAt(text.length - 1);
                let fullTextWithSpan = includeSpan ? text.slice(0, -1) + `<span id="last">${lastChar}</span>` : text;
                if (fullTextWithSpan.startsWith("https://")) {
                    element.innerHTML = `<a href=${text} target="_blank">${fullTextWithSpan}</a>`;
                } else {
                    element.innerHTML = fullTextWithSpan;
                }
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
    if (!subtitle || isTyping)
        return;

    // if (!subtitles || subtitles.length === 0) {
    //     subtitle.innerHTML = "...";
    //     return;
    // }

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
    isTyping = true;
    typeEffect(subtitle, newSubtitle, () => isTyping = false, true);
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

function drawAsciiBox(width, height) {
    let topCharCount = Math.round(width / getCharacterDimensions(BOX_HORIZONTAL_CHAR).width);
    let sideCharCount = Math.round(height / getCharacterDimensions(BOX_VERTICAL_CHAR).height) - 2;

    const topBottomBorder = `${BOX_CORNER_CHAR}${BOX_HORIZONTAL_CHAR.repeat(topCharCount)}${BOX_CORNER_CHAR}\n`;
    let middleRows = '';
    for (let i = 0; i < sideCharCount; i++) {
        middleRows += `${BOX_VERTICAL_CHAR}${' '.repeat(topCharCount)}${BOX_VERTICAL_CHAR}\n`;
    }

    return topBottomBorder + middleRows + topBottomBorder;
}

function drawMainContentBorder() {
    const mainDiv = document.getElementById('main');
    const asciiBox = document.getElementById('ascii-box');
    const backContainer = document.getElementById('back-container');
    const mainDivRect = mainDiv.getBoundingClientRect();

    if (backContainer && backContainer.offsetHeight > 0) {
        asciiBox.style.top = '2em';
    } else {
        asciiBox.style.top = '0';
    }

    asciiBox.textContent = drawAsciiBox(mainDivRect.width, mainDivRect.height);
}


async function fetchTopLanguages() {
    let resp = await fetch("/language-stats.json");
    languageStats = await resp.json();
    // languageStats = JSON.parse(`[{"language": "C#", "percentage": 61.94081575948944, "color": {"color": "#178600", "url": "https://github.com/trending?l=Csharp"}}, {"language": "Python", "percentage": 20.74364767736641, "color": {"color": "#3572A5", "url": "https://github.com/trending?l=Python"}}, {"language": "TypeScript", "percentage": 9.171037242692433, "color": {"color": "#3178c6", "url": "https://github.com/trending?l=TypeScript"}}, {"language": "JavaScript", "percentage": 2.6794664415146925, "color": {"color": "#f1e05a", "url": "https://github.com/trending?l=JavaScript"}}, {"language": "HTML", "percentage": 2.2224567555284644, "color": {"color": "#e34c26", "url": "https://github.com/trending?l=HTML"}}, {"language": "Fluent", "percentage": 1.663353285416743, "color": {"color": "#ffcc33", "url": "https://github.com/trending?l=Fluent"}}, {"language": "Batchfile", "percentage": 0.6639972947301084, "color": {"color": "#C1F12E", "url": "https://github.com/trending?l=Batchfile"}}, {"language": "CSS", "percentage": 0.5151212956002748, "color": {"color": "#563d7c", "url": "https://github.com/trending?l=CSS"}}, {"language": "Shell", "percentage": 0.20629836800716808, "color": {"color": "#89e051", "url": "https://github.com/trending?l=Shell"}}, {"language": "SCSS", "percentage": 0.13155882561993973, "color": {"color": "#c6538c", "url": "https://github.com/trending?l=SCSS"}}, {"language": "Dockerfile", "percentage": 0.034634347019787674, "color": {"color": "#384d54", "url": "https://github.com/trending?l=Dockerfile"}}, {"language": "PLpgSQL", "percentage": 0.02761270701453221, "color": {"color": "#336790", "url": "https://github.com/trending?l=PLpgSQL"}}]`);
    drawTopLanguages({doDrawDelay: true});
}

async function drawTopLanguages({doDrawDelay}) {
    const topLanguages = languageStats.slice(0, 5);

    const languageBarContainer = document.getElementById('language-bar-container');
    if (!languageBarContainer)
        return;

    const barElements = document.querySelectorAll("#language-bar-container > .language-bar");

    const typeBar = (barKey, numChars, color, index) => {
        const barSpan = document.createElement("span");
        barSpan.style.color = color;

        const div = barElements[index];
        div.innerText = barKey;
        div.appendChild(barSpan);

        let currentLength = 0;
        const type = () => {
            if (currentLength < numChars) {
                barSpan.innerText = '|' + '='.repeat(currentLength + 1);
                currentLength++;
                if (doDrawDelay)
                    setTimeout(type, 25);
                else
                    type();
            }
        };

        if (doDrawDelay)
            setTimeout(type, 450 * index);
        else
            type();
    };

    const barCharWidth = getCharacterDimensions("=").width;
    const prefixWidth = getCharacterDimensions("-".repeat(10)).width;
    const barWidth = Math.floor((languageBarContainer.getBoundingClientRect().width - prefixWidth) / barCharWidth);

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
    drawMainContentBorder();
    updateCursorPosition();
});

window.addEventListener('scroll', () => {
    updateCursorPosition();
})

window.addEventListener('load', () => {
    drawMainContentBorder();
    // Also adjust positioning after a short delay to ensure all elements are rendered
    setTimeout(() => {
        drawMainContentBorder();
    }, 100);
});


document.addEventListener('keydown', function(event) {
    const key = event.code;

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