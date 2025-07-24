var divvyStats = {};


subtitles = [];


async function fetchDivvyStats() {
    let resp = await fetch("/divvy-stats.json");
    divvyStats = await resp.json();

    subtitles = [`Data Month: ${divvyStats.meta.as_of}`]
    randomizeSubtitle();
}


function getStatItemByKeyValue(statName, key, value) {
    if (!divvyStats || !divvyStats.stats[statName]) {
        return;
    }

    for (const item of divvyStats.stats[statName]) {
        if (item[key] === value)
            return item;
    }
}


function formatDollarValue(value) {
    let formatter = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD"
    });

    return formatter.format(value);
}


function formatPercentValue(value) {
    value = value / 100;
    let formatter = new Intl.NumberFormat("en-US", {
        style: "percent",
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
    });

    return formatter.format(value);
}


function setElemText(elem_id, text) {
    let elem = document.getElementById(elem_id);
    if (!elem) {
        return;
    }

    typeEffect(elem, text);
    // elem.innerText = text;
}


function loadStats() {
    if (!divvyStats) {
        return;
    }

    loadNeighborhoodStats();
    loadPopularRoutes();
    loadPeakHours();
    loadMembershipStats();
    loadRevenueStats();
    loadTimeOfDayStats();
    loadStationEfficiency();
    createNeighborhoodMap();
}


function loadNeighborhoodStats() {
    let topNeighborhoods = divvyStats.stats.neighborhood_activity.splice(0, 5);
    for (let i = 0; i < topNeighborhoods.length; i++) {
        let id = `top-neighborhood-${i}`;
        let neighborhood = topNeighborhoods[i];
        let ridePercent = formatPercentValue(neighborhood.ride_percent);
        let listItem = document.getElementById(id);
        typeEffect(listItem, `${neighborhood.start_neighborhood} <span class="percent">(${ridePercent})</span>`);
    }
}


function loadPopularRoutes() {
    let popularRoutes = divvyStats.stats.popular_routes.slice(0, 5);
    for (let i = 0; i < popularRoutes.length; i++) {
        let id = `popular-route-${i}`;
        let route = popularRoutes[i];
        let rideCount = new Intl.NumberFormat().format(route.ride_count);
        let listItem = document.getElementById(id);
        typeEffect(listItem, `${route.route} <span class="percent">(${rideCount} rides)</span>`);
    }
}


function loadPeakHours() {
    let peakHours = divvyStats.stats.peak_hours;
    let peakHoursContainer = document.getElementById("peak-hours-chart");
    if (peakHours && peakHours.length > 0) {
        createPeakHoursChart(peakHours, peakHoursContainer);
    }
}


function loadMembershipStats() {
    let memberTrips = getStatItemByKeyValue("rides_by_membership", "member_casual", "member");
    let casualTrips = getStatItemByKeyValue("rides_by_membership", "member_casual", "casual");

    let totalTrips = memberTrips.ride_count + casualTrips.ride_count;

    setElemText("total-trips", new Intl.NumberFormat().format(totalTrips));

    setElemText("counttable-member-percent", formatPercentValue(memberTrips.ride_percent));
    setElemText("counttable-casual-percent", formatPercentValue(casualTrips.ride_percent));
}


function loadRevenueStats() {
    let averageMemberRevenue = getStatItemByKeyValue("average_revenue_per_trip", "member_casual", "member");
    let totalMemberRevenue = getStatItemByKeyValue("revenue_by_membership", "member_casual", "member");

    setElemText("revtable-member-avg", formatDollarValue(averageMemberRevenue.estimated_revenue));
    setElemText("revtable-member-percent", formatPercentValue(totalMemberRevenue.percent_revenue));

    let averageCasualRevenue = getStatItemByKeyValue("average_revenue_per_trip", "member_casual", "casual");
    let totalCasualRevenue = getStatItemByKeyValue("revenue_by_membership", "member_casual", "casual");

    setElemText("revtable-casual-avg", formatDollarValue(averageCasualRevenue.estimated_revenue));
    setElemText("revtable-casual-percent", formatPercentValue(totalCasualRevenue.percent_revenue));

    setElemText("total-revenue", formatDollarValue(divvyStats.stats.total_estimated_revenue));
}


function loadTimeOfDayStats() {
    let morningTrips = getStatItemByKeyValue("trips_by_time_of_day", "time_of_day", "Morning");
    let afternoonTrips = getStatItemByKeyValue("trips_by_time_of_day", "time_of_day", "Afternoon");
    let eveningTrips = getStatItemByKeyValue("trips_by_time_of_day", "time_of_day", "Evening");
    let nightTrips = getStatItemByKeyValue("trips_by_time_of_day", "time_of_day", "Night");

    setElemText("timetable-morning-trips", formatPercentValue(morningTrips.ride_percent));
    setElemText("timetable-afternoon-trips", formatPercentValue(afternoonTrips.ride_percent));
    setElemText("timetable-evening-trips", formatPercentValue(eveningTrips.ride_percent));
    setElemText("timetable-night-trips", formatPercentValue(nightTrips.ride_percent));

    let morningRevenue = getStatItemByKeyValue("revenue_by_time_of_date", "time_of_day", "Morning");
    let afternoonRevenue = getStatItemByKeyValue("revenue_by_time_of_date", "time_of_day", "Afternoon");
    let eveningRevenue = getStatItemByKeyValue("revenue_by_time_of_date", "time_of_day", "Evening");
    let nightRevenue = getStatItemByKeyValue("revenue_by_time_of_date", "time_of_day", "Night");

    setElemText("timetable-morning-cost", formatPercentValue(morningRevenue.revenue_percentage));
    setElemText("timetable-afternoon-cost", formatPercentValue(afternoonRevenue.revenue_percentage));
    setElemText("timetable-evening-cost", formatPercentValue(eveningRevenue.revenue_percentage));
    setElemText("timetable-night-cost", formatPercentValue(nightRevenue.revenue_percentage));
}


function loadStationEfficiency() {
    let stationEfficiency = divvyStats.stats.station_efficiency.slice(0, 5);
    for (let i = 0; i < stationEfficiency.length; i++) {
        let station = stationEfficiency[i];
        
        setElemText(`efficiency-station-${i}`, station.station_name);
        setElemText(`efficiency-activity-${i}`, new Intl.NumberFormat().format(station.total_activity));
        
        // Format net flow with + or - sign
        let flowText = station.net_flow > 0 ? `+${station.net_flow}` : station.net_flow.toString();
        setElemText(`efficiency-flow-${i}`, flowText);
        
        // Format utilization as percentage
        let utilizationPercent = formatPercentValue(station.utilization_score * 100);
        setElemText(`efficiency-utilization-${i}`, utilizationPercent);
    }
}


function createPeakHoursChart(peakHours, container) {
    // Find the maximum percentage for scaling
    let maxPercent = Math.max(...peakHours.map(h => h.ride_percent));
    
    // Create the chart HTML
    let chartHTML = '<div class="peak-hours-chart">';
    
    peakHours.forEach(hour => {
        // Ensure minimum height and proper scaling
        let barHeight = Math.max(5, (hour.ride_percent / maxPercent) * 80);
        let hourLabel = hour.hour === 0 ? '12A' : 
                       hour.hour === 12 ? '12P' : 
                       hour.hour > 12 ? `${hour.hour - 12}P` : `${hour.hour}A`;
        
        chartHTML += `
            <div class="hour-bar">
                <div class="bar" style="height: ${barHeight}px"></div>
                <div class="hour-label">${hourLabel}</div>
                <div class="hour-percent">${hour.ride_percent.toFixed(1)}%</div>
            </div>
        `;
    });
    
    chartHTML += '</div>';
    container.innerHTML = chartHTML;
}


function createNeighborhoodMap() {
    if (!divvyStats.stats.neighborhood_stations || !divvyStats.stats.neighborhood_svg_map) return;
    
    let mapContainer = document.getElementById("neighborhood-map");
    let detailsContainer = document.getElementById("neighborhood-details");
    let backLink = document.getElementById("neighborhood-back");
    let selectedNeighborhood = document.getElementById("selected-neighborhood");
    let neighborhoodStats = document.getElementById("neighborhood-stats");
    let stationsList = document.getElementById("neighborhood-stations-list");
    
    // Insert the SVG map
    mapContainer.innerHTML = divvyStats.stats.neighborhood_svg_map;
    mapContainer.classList.remove("hidden");
    detailsContainer.classList.add("hidden");

    // --- HEATMAP COLORING ---
    // Get all ride_percent values for normalization
    const stationData = divvyStats.stats.neighborhood_stations;
    const ridePercents = Object.values(stationData).map(n => n.ride_percent || 0);
    const minPercent = Math.min(...ridePercents);
    const maxPercent = Math.max(...ridePercents);
    // Helper: interpolate between two hex colors
    function lerpColor(a, b, t) {
        // a, b: hex strings like '#1a1a1a', '#63a4ff'
        // t: 0..1
        const ah = a.replace('#','');
        const bh = b.replace('#','');
        const ar = parseInt(ah.substring(0,2),16), ag = parseInt(ah.substring(2,4),16), ab = parseInt(ah.substring(4,6),16);
        const br = parseInt(bh.substring(0,2),16), bg = parseInt(bh.substring(2,4),16), bb = parseInt(bh.substring(4,6),16);
        const rr = Math.round(ar + (br-ar)*t);
        const rg = Math.round(ag + (bg-ag)*t);
        const rb = Math.round(ab + (bb-ab)*t);
        return `#${rr.toString(16).padStart(2,'0')}${rg.toString(16).padStart(2,'0')}${rb.toString(16).padStart(2,'0')}`;
    }
    // Log scale normalization
    const logMin = Math.log(minPercent + 1);
    const logMax = Math.log(maxPercent + 1);
    // Apply fill to each neighborhood path
    mapContainer.querySelectorAll('.neighborhood').forEach(path => {
        const n = path.getAttribute('data-neighborhood');
        const data = stationData[n];
        if (!data) return;
        const percent = data.ride_percent || 0;
        // Log scale normalization
        let t = (Math.log(percent + 1) - logMin) / (logMax - logMin || 1);
        // Use a blue gradient: #1a1a1a (low) to #63a4ff (high)
        const fill = lerpColor('#1a1a1a', '#63a4ff', t);
        path.style.fill = fill;
    });
    // --- END HEATMAP COLORING ---

    // Get the SVG element once
    const svg = mapContainer.querySelector('svg');

    // --- TOOLTIP FOR NEIGHBORHOOD NAMES ---
    // Create tooltip div
    let tooltip = document.createElement('div');
    tooltip.style.position = 'absolute';
    tooltip.style.pointerEvents = 'none';
    tooltip.style.background = '#111';
    tooltip.style.color = '#63a4ff';
    tooltip.style.fontFamily = 'monospace';
    tooltip.style.fontSize = '12px';
    tooltip.style.padding = '2px 8px';
    tooltip.style.border = '1px solid #63a4ff';
    tooltip.style.borderRadius = '4px';
    tooltip.style.zIndex = 100;
    tooltip.style.display = 'none';
    mapContainer.style.position = 'relative'; // Ensure mapContainer is positioned
    mapContainer.appendChild(tooltip);

    if (svg) {
        svg.addEventListener('mousemove', function(e) {
            if (tooltip.style.display === 'block') {
                // Position tooltip relative to mapContainer
                const rect = mapContainer.getBoundingClientRect();
                tooltip.style.left = (e.clientX - rect.left + 12) + 'px';
                tooltip.style.top = (e.clientY - rect.top + 12) + 'px';
            }
        });
        svg.querySelectorAll('.neighborhood').forEach(path => {
            path.addEventListener('mouseenter', function(e) {
                tooltip.textContent = path.getAttribute('data-neighborhood');
                tooltip.style.display = 'block';
            });
            path.addEventListener('mouseleave', function(e) {
                tooltip.style.display = 'none';
            });
        });
    }
    // --- END TOOLTIP ---

    // --- INITIAL ZOOM TO TOP 5 NEIGHBORHOODS ---
    if (svg) {
        // Find top 5 neighborhoods by ride_percent
        const topNeighborhoods = Object.entries(stationData)
            .sort((a, b) => (b[1].ride_percent || 0) - (a[1].ride_percent || 0))
            .slice(0, 5)
            .map(([name]) => name);
        // Get their SVG paths
        const paths = Array.from(svg.querySelectorAll('.neighborhood'))
            .filter(path => topNeighborhoods.includes(path.getAttribute('data-neighborhood')));
        if (paths.length > 0) {
            // Compute combined bounding box
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            paths.forEach(path => {
                const bbox = path.getBBox();
                minX = Math.min(minX, bbox.x);
                minY = Math.min(minY, bbox.y);
                maxX = Math.max(maxX, bbox.x + bbox.width);
                maxY = Math.max(maxY, bbox.y + bbox.height);
            });
            // Add padding (10%)
            const padX = (maxX - minX) * 0.1;
            const padY = (maxY - minY) * 0.1;
            minX -= padX; minY -= padY; maxX += padX; maxY += padY;
            const viewBoxStr = `${minX} ${minY} ${maxX - minX} ${maxY - minY}`;
            svg.setAttribute('viewBox', viewBoxStr);
        }
    }
    // --- END INITIAL ZOOM ---

    // --- PAN & ZOOM ---
    if (svg) {
        let viewBox = svg.getAttribute('viewBox').split(' ').map(Number);
        const originalViewBox = [...viewBox];
        let isPanning = false;
        let startPoint = { x: 0, y: 0 };
        let panOrigin = { x: 0, y: 0 };
        let zoomFactor = 1.1;

        // Convert screen coords to SVG coords
        function clientToSvg(x, y) {
            const rect = svg.getBoundingClientRect();
            const svgX = viewBox[0] + (x - rect.left) * (viewBox[2] / rect.width);
            const svgY = viewBox[1] + (y - rect.top) * (viewBox[3] / rect.height);
            return { x: svgX, y: svgY };
        }

        svg.addEventListener('wheel', function(e) {
            e.preventDefault();
            const { x, y } = clientToSvg(e.clientX, e.clientY);
            let scale = e.deltaY < 0 ? 1 / zoomFactor : zoomFactor;
            let newW = viewBox[2] * scale;
            let newH = viewBox[3] * scale;
            // Center zoom on mouse
            let newX = x - (x - viewBox[0]) * scale;
            let newY = y - (y - viewBox[1]) * scale;
            viewBox = [newX, newY, newW, newH];
            svg.setAttribute('viewBox', viewBox.join(' '));
        }, { passive: false });

        svg.addEventListener('mousedown', function(e) {
            if (e.button !== 0) return;
            isPanning = true;
            startPoint = { x: e.clientX, y: e.clientY };
            panOrigin = { x: viewBox[0], y: viewBox[1] };
            svg.style.cursor = 'move';
        });
        window.addEventListener('mousemove', function(e) {
            if (!isPanning) return;
            const dx = (e.clientX - startPoint.x) * (viewBox[2] / svg.clientWidth);
            const dy = (e.clientY - startPoint.y) * (viewBox[3] / svg.clientHeight);
            viewBox[0] = panOrigin.x - dx;
            viewBox[1] = panOrigin.y + dy;
            svg.setAttribute('viewBox', viewBox.join(' '));
        });
        window.addEventListener('mouseup', function(e) {
            if (isPanning) {
                isPanning = false;
                svg.style.cursor = '';
            }
        });
        svg.addEventListener('dblclick', function(e) {
            viewBox = [...originalViewBox];
            svg.setAttribute('viewBox', viewBox.join(' '));
        });
    }
    // --- END PAN & ZOOM ---
    
    // Add click handlers to neighborhood paths
    const mapOuterContainer = document.getElementById("neighborhood-map-container");
    mapContainer.addEventListener("click", function(e) {
        if (e.target.classList.contains("neighborhood")) {
            let neighborhood = e.target.getAttribute("data-neighborhood");
            let isActive = e.target.classList.contains("active");

            // Remove active class from all neighborhoods
            document.querySelectorAll(".neighborhood").forEach(n => n.classList.remove("active"));

            if (isActive) {
                // Deselect and hide details
                detailsContainer.classList.add("hidden");
                mapContainer.classList.remove("hidden");
                mapOuterContainer.classList.remove("details-fullscreen");
                return;
            }

            // Add active class to clicked neighborhood
            e.target.classList.add("active");

            // Move clicked path to end so it's on top
            if (e.target.parentNode) {
                e.target.parentNode.appendChild(e.target);
            }

            // Show details view, hide map
            showNeighborhoodDetails(neighborhood);
            mapContainer.classList.add("hidden");
            detailsContainer.classList.remove("hidden");
            mapOuterContainer.classList.add("details-fullscreen");
        }
    });

    // Back link handler
    backLink.onclick = function(e) {
        e.preventDefault();
        detailsContainer.classList.add("hidden");
        mapContainer.classList.remove("hidden");
        mapOuterContainer.classList.remove("details-fullscreen");
        // Remove all active highlights
        document.querySelectorAll(".neighborhood").forEach(n => n.classList.remove("active"));
    };

    function showNeighborhoodDetails(neighborhood) {
        let data = divvyStats.stats.neighborhood_stations[neighborhood];
        if (!data) return;
        selectedNeighborhood.textContent = neighborhood;
        let totalRides = new Intl.NumberFormat().format(data.total_rides);
        let ridePercent = formatPercentValue(data.ride_percent);
        neighborhoodStats.textContent = `${totalRides} trips (${ridePercent} of all trips)`;
        stationsList.innerHTML = "";
        data.top_stations.forEach(station => {
            let li = document.createElement("li");
            let rideCount = new Intl.NumberFormat().format(station.ride_count);
            li.textContent = `${station.station_name} (${rideCount} rides)`;
            stationsList.appendChild(li);
        });
    }
}


window.addEventListener('load', async () => {
    await fetchDivvyStats();
    loadStats();
    startTripCounter();
});


function startTripCounter() {
    if (!divvyStats) return;
    
    // Calculate total trips from the data
    let memberTrips = getStatItemByKeyValue("rides_by_membership", "member_casual", "member");
    let casualTrips = getStatItemByKeyValue("rides_by_membership", "member_casual", "casual");
    let totalTrips = memberTrips.ride_count + casualTrips.ride_count;
    
    // Get time-of-day data for dynamic rates
    let morningTrips = getStatItemByKeyValue("trips_by_time_of_day", "time_of_day", "Morning");
    let afternoonTrips = getStatItemByKeyValue("trips_by_time_of_day", "time_of_day", "Afternoon");
    let eveningTrips = getStatItemByKeyValue("trips_by_time_of_day", "time_of_day", "Evening");
    let nightTrips = getStatItemByKeyValue("trips_by_time_of_day", "time_of_day", "Night");
    
    // Create time-of-day rate multipliers
    let timeOfDayRates = {
        "Morning": morningTrips.ride_percent / 100,
        "Afternoon": afternoonTrips.ride_percent / 100,
        "Evening": eveningTrips.ride_percent / 100,
        "Night": nightTrips.ride_percent / 100
    };
    
    // Calculate base trips per second (assuming this is monthly data)
    let tripsPerDay = totalTrips / 30; // Assuming monthly data
    let baseTripsPerSecond = tripsPerDay / (24 * 60 * 60);
    
    let pageLoadTime = Date.now();
    let counterElement = document.getElementById("trip-counter");
    
    // Function to get current time of day
    function getCurrentTimeOfDay() {
        let hour = new Date().getHours();
        if (5 <= hour && hour < 12) return "Morning";
        if (12 <= hour && hour < 17) return "Afternoon";
        if (17 <= hour && hour < 21) return "Evening";
        return "Night";
    }
    
    // Function to get current rate multiplier
    function getCurrentRateMultiplier() {
        let currentTimeOfDay = getCurrentTimeOfDay();
        return timeOfDayRates[currentTimeOfDay] || 1;
    }
    
    // Update counter every second with dynamic rate
    setInterval(() => {
        let elapsedSeconds = (Date.now() - pageLoadTime) / 1000;
        let currentRateMultiplier = getCurrentRateMultiplier();
        let dynamicTripsPerSecond = baseTripsPerSecond * currentRateMultiplier;
        let tripsSinceLoad = Math.floor(dynamicTripsPerSecond * elapsedSeconds);
        counterElement.textContent = tripsSinceLoad.toLocaleString();
    }, 1000);
}
