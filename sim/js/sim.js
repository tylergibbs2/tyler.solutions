
// Load the Visualization API and the corechart package.
google.charts.load("current", {"packages":["corechart","line"]});

// Set a callback to run when the Google Visualization API is loaded.
google.charts.setOnLoadCallback(initialize);

var generation_array = [];
var image_generation = null;
var simulated_generations = [];

function randint(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min; //The maximum is inclusive and the minimum is inclusive
}

function getLatestCoyoteCount() {
    var last_generation = generation_array[generation_array.length-1];

    if (typeof last_generation === 'undefined') {
        return Number(document.getElementById('starting_coyote').value);
    }

    if (last_generation[2] > 0) {
        return last_generation[2];
    } else {
        return null;
    }
}

function getLatestMouseCount() {
    var last_generation = generation_array[generation_array.length-1];

    if (typeof last_generation === 'undefined') {
        return Number(document.getElementById('starting_mice').value);
    }

    if (last_generation[1] > 0) {
        return last_generation[1];
    } else {
        return null;
    }
}

function simulateGenerations(amount) {
    var mouse_count = getLatestMouseCount() || Number(document.getElementById("starting_mice").value);
    var coyote_count = getLatestCoyoteCount() || Number(document.getElementById("starting_coyote").value);
    var needed_to_live = Number(document.getElementById("mice_to_live").value);
    var max_pups = Number(document.getElementById("max_coyote_pups").value);
    var mice_to_reproduce = Number(document.getElementById("mice_to_reproduce").value);
    var mice_multiplier = Number(document.getElementById("mice_multiplier").value);
    for (i = 0; i < amount; i++) {
        for (j = 0; j < coyote_count; j++) {
            var landed_on = randint(0, Math.ceil(mouse_count / 16));
            if (mouse_count - landed_on <= 1) {
                continue;
            }
            mouse_count -= landed_on;
            var mice_after_living = landed_on - needed_to_live;
            if (landed_on < needed_to_live) {
                if (coyote_count > 1) {
                    coyote_count -= 1;
                    continue;
                }
            }
            else if (mice_after_living >= mice_to_reproduce) {
                var pups = Math.floor(mice_after_living / mice_to_reproduce);
                if (pups > max_pups) {
                    pups = max_pups;
                }
                coyote_count += pups;
            }
        }
        mouse_count *= mice_multiplier;
        var last_generation = generation_array[generation_array.length-1][0];
        generation_array.push([last_generation+1, mouse_count, coyote_count]);
        simulated_generations.push(last_generation+1);
    }
    localStorage.setItem('simulated_generations', JSON.stringify(simulated_generations));
    localStorage.setItem('sim_data', JSON.stringify(generation_array));

}

function drawImage(generation) {
    var canvas = document.getElementById("sim_image");
    var ctx = canvas.getContext("2d");
    var grass = document.getElementById("grass_img");
    var coyote = document.getElementById("coyote_img");
    var mouse = document.getElementById("mouse_img");
    var open_positions = [];

    ctx.fillStyle = "green";
    ctx.fillRect(0, 0, 612, 612);
    for (i=0; i <= 612; i+=34) {
        for (j=0; j <= 612; j+=34) {
            ctx.drawImage(grass, i, j);
            open_positions.push([i, j])
        }
    }

    var gen_data = generation_array[generation];
    if (typeof gen_data === "undefined") {
        return null;
    }
    generation = String(gen_data[0]);

    var image_storage = JSON.parse(localStorage.getItem("image_data"));

    if (typeof image_storage[generation] !== "undefined") {
        for (i=0; i <= image_storage[generation]["mice"].length; i++) {
            coords = image_storage[generation]["mice"][i];
            if (typeof coords === "undefined"){
                continue;
            }
            ctx.drawImage(mouse, coords[0], coords[1]);
        }
        for (i=0; i <= image_storage[generation]["coyotes"].length; i++) {
            coords = image_storage[generation]["coyotes"][i];
            if (typeof coords === "undefined"){
                continue;
            }
            ctx.drawImage(coyote, coords[0], coords[1]);
        }

        return null;
    }

    image_storage[generation] = {};
    image_storage[generation]["coyotes"] = [];
    image_storage[generation]["mice"] = [];

    var mice_count = gen_data[1];
    var coyote_count = gen_data[2];
    if (mice_count === 0 || coyote_count === 0) {
        return null;
    }
    for (i=0; i<=mice_count; i++) {
        var index = Math.floor(Math.random() * open_positions.length);
        var coords = open_positions[index];
        open_positions.splice(index, 1);
        var x = coords[0] + 1;
        var y = coords[1] + 1;
        ctx.drawImage(mouse, x, y);
        image_storage[generation]["mice"].push([x, y]);
    }

    for (i=0; i<=coyote_count; i++){
        var index = Math.floor(Math.random() * open_positions.length);
        var coords = open_positions[index];
        open_positions.splice(index, 1);
        var x = coords[0] + 1;
        var y = coords[1] + 1;
        ctx.drawImage(coyote, x, y);
        image_storage[generation]["coyotes"].push([x, y]);
    }

    localStorage.setItem("image_data", JSON.stringify(image_storage));
}

function drawChart() {

    var data = new google.visualization.DataTable();
    data.addColumn("number", "Generation");
    data.addColumn("number", "Mice");
    data.addColumn("number", "Coyotes");

    var data_array = generation_array.slice(0);
    if (data_array.length === 0) {
        data_array = [[0, 0, 0]];
    }
    data.addRows(data_array);
    if (generation_array.length !== 0) {
        var generations = (generation_array.length-1).toString();
    } else {
        var generations = '0';
    }
    var options = {
        chart: {
            title: "Coyote/Mouse Simulation",
            subtitle: generations.concat(" generations")
        },
        width: 900,
        height: 450,
        hAxis: {
            title: "Generation"
        },
        vAxis: {
            title: "Count"
        },
        legend: {
            position: 'bottom'
        }
    };

    var chart = new google.charts.Line(document.getElementById("chart_div"));

    chart.draw(data, google.charts.Line.convertOptions(options));
    drawImage(Number(generations));
}

function drawCurvedChart() {

    var data = new google.visualization.DataTable();
    data.addColumn("number", "Generation");
    data.addColumn("number", "Mice");
    data.addColumn("number", "Coyotes");

    var data_array = generation_array.slice(0);
    if (data_array.length === 0) {
        data_array = [[0, 0, 0]];
    }

    data.addRows(data_array);
    if (generation_array.length !== 0) {
        var generations = (generation_array.length-1).toString();
    } else {
        var generations = '0';
    }

    var options = {
        title: "Coyote/Mouse Simulation, " + generations + " generations",
        curveType: "function",
        smoothline: "true",
        width: 900,
        height: 450,
        hAxis: {
            title: "Generation",
            baseline: 0
        },
        vAxis: {
            title: "Count",
            baseline: 0
        },
        legend: {
            position: 'bottom'
        },
        theme: 'material'
    };

    var chart = new google.visualization.LineChart(document.getElementById("chart_div"));

    chart.draw(data, options);
    drawImage(Number(generations));
}

function showPrevGen() {
    if (generation_array === null) {
        return null;
    }

    var mouse_count = Number(document.getElementById("starting_mice").value);
    var coyote_count = Number(document.getElementById("starting_coyote").value);

    if (generation_array.length === 0) {
        generation_array.push([0, mouse_count, coyote_count]);
        simulated_generations.push(0)
    }

    if (image_generation === null) {
        image_generation = generation_array[generation_array.length-1][0]
    }

    if (image_generation === 0) {
        return null;
    }

    image_generation -= 1;
    document.getElementById('gen_disp').innerHTML = image_generation;
    drawImage(image_generation);
}

function showNextGen() {
    if (generation_array === null) {
        return null;
    }

    var mouse_count = Number(document.getElementById("starting_mice").value);
    var coyote_count = Number(document.getElementById("starting_coyote").value);

    if (generation_array.length === 0) {
        generation_array.push([0, mouse_count, coyote_count]);
        simulated_generations.push(0)
    }

    if (image_generation === null) {
        image_generation = generation_array[generation_array.length-1][0]
    }

    if (typeof generation_array[0] === 'undefined') {
        simulateGenerations(1);
        if (document.getElementById("straight").checked) {
            drawChart();
        }
        else {
            drawCurvedChart();
        }
    }

    if (!simulated_generations.includes(image_generation+1)) {
        simulateGenerations(1);
        if (document.getElementById("straight").checked) {
            drawChart();
        }
        else {
            drawCurvedChart();
        }
    }

    image_generation += 1;
    document.getElementById('gen_disp').innerHTML = image_generation;
    drawImage(image_generation);
}

function initialize() {

    if (localStorage.getItem("image_data") === null) {
        localStorage.setItem("image_data", JSON.stringify({}));
    }
    if (localStorage.getItem("graph_type") === null) {
        localStorage.setItem("graph_type", "straight");
    }
    if (localStorage.getItem("sim_data") === null) {
        localStorage.setItem("sim_data", JSON.stringify([]));
        localStorage.setItem("image_data", JSON.stringify({}));
    }
    if (localStorage.getItem('sim_speed') === null) {
        localStorage.setItem('sim_speed', '5');
    }
    if (localStorage.getItem('simulated_generations') === null) {
        localStorage.setItem('simulated_generations', '[]');
    }

    generation_array = JSON.parse(localStorage.getItem('sim_data'));
    simulated_generations = JSON.parse(localStorage.getItem('simulated_generations'));

    if (simulated_generations.length !== 0) {
        document.getElementById('gen_disp').innerHTML = simulated_generations[simulated_generations.length-1];
        image_generation = simulated_generations[simulated_generations.length-1];
    }

    var slider_disp = document.getElementById('slider_disp');
    var slider = document.getElementById('speed_slider');
    slider_disp.innerHTML = localStorage.getItem('sim_speed');
    slider.value = localStorage.getItem('sim_speed');

    var button = document.getElementById("generate");
    var reset_b = document.getElementById("reset");
    var curved_radio = document.getElementById("curved");
    var straight_radio = document.getElementById("straight");
    var play_b = document.getElementById('play');
    var next_gen_b = document.getElementById('next_gen');
    var prev_gen_b = document.getElementById('prev_gen');
    var playing_status = false;

    var graph_type = localStorage.getItem("graph_type");

    if (graph_type === "straight") {
        drawChart();
        straight_radio.checked = true;
    } else {
        drawCurvedChart();
        straight_radio.checked = false;
        curved_radio.checked = true;
    }

    prev_gen_b.onclick = function () {
        showPrevGen();
    };
    next_gen_b.onclick = function () {
        showNextGen();
    };

    curved_radio.onclick = function () {
        localStorage.setItem("graph_type", "curved");
        drawCurvedChart();
    };
    straight_radio.onclick = function () {
        localStorage.setItem("graph_type", "straight");
        drawChart();
    };
    reset_b.onclick = function () {
        generation_array = [];
        localStorage.setItem("sim_data", JSON.stringify([]));
        localStorage.setItem("image_data", JSON.stringify({}));
        localStorage.setItem('sim_speed', '5');
        localStorage.setItem('simulated_generations', '[]');
        slider.value = '5';
        slider_disp.innerHTML = '5';
        document.getElementById('gen_disp').innerHTML = '';
        image_generation = null;
        simulated_generations = [];
        playing_status = false;
        play_b.innerHTML = 'Play';
        drawChart();
    };
    button.onclick = function () {
        if (generation_array.length === 0) {
            generation_array.push([0, getLatestMouseCount(), getLatestCoyoteCount()]);
            simulated_generations.push(0)
        }
        simulateGenerations(document.getElementById('generations').value);
        if (document.getElementById("straight").checked) {
            drawChart();
        }
        else {
            drawCurvedChart();
        }
        image_generation = simulated_generations[simulated_generations.length-1]

        drawImage(image_generation);
        document.getElementById('gen_disp').innerHTML = image_generation;
    };
    play_b.onclick = function () {
        if (image_generation === null) {
            return null;
        }

        playing_status = !playing_status;
        if (playing_status === true) {
            play_b.innerHTML = 'Stop';
        } else {
            play_b.innerHTML = 'Play';
        }

        do_play();

        function do_play() {
            if (playing_status === false) {
                return null;
            }
            if (simulated_generations.indexOf(image_generation+1) > -1) {
                image_generation += 1;
            } else {
                image_generation = 0;
            }
            drawImage(image_generation);
            document.getElementById('gen_disp').innerHTML = image_generation;
            var sleep_time = Number(document.getElementById('slider_disp').innerHTML) * 1000;
            if (sleep_time === 0) {
                sleep_time = 1000;
            }
            setTimeout(function() {
                do_play();
            }, sleep_time);
        }
    }
}

$(document).ready(function() {
    $(function () {
        $('#divContainer').draggable();
    });
})