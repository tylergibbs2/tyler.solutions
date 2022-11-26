var seenIndices = [];
let subtitles = [
    "Pioneer of writing subtitles",
    "Creator of Coyote/Mouse Simulation",
    "Ex-user of jQuery 😔",
    "<i>is feeling great!</i>",
    "Software Engineer",
    "Backend Engineer",
    "Frontend Engineer",
    "Definitely doesn't make floating-point errors",
    "Pythonista",
    "React > Angular",
    "<i>undefined</i>",
    "Stardew Valley modder"
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
}

function randomizeBackgroundColor() {
    let randomColor = Math.floor(Math.random() * 16777215);
    document.body.style.backgroundColor = `#${randomColor.toString(16)}`;
}

window.onload = function () {
    document.getElementById("profilePic").onclick = randomizeBackgroundColor;
    document.getElementById("description").onclick = randomizeSubtitle;

    randomizeSubtitle();
}
