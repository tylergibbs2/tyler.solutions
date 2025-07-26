window.addEventListener('resize', () => {
    drawTopLanguages({doDrawDelay: false});
});

window.addEventListener('load', () => {
    let desc = document.getElementById("description");
    if (desc && !desc.classList.contains("no-refresh")) {
        desc.onclick = randomizeSubtitle;
    }
    randomizeSubtitle();
    
    // Execute both fetch functions concurrently
    Promise.all([
        fetchTopLanguages(),
        fetchCtaTapData()
    ]).catch(error => {
        console.error("Error loading data:", error);
    });
});

document.addEventListener('keydown', function(event) {
    const key = event.code;

    if (key === 'Enter') {
        randomizeSubtitle();
        return;
    }
});
