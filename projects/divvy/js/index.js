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

    let topStations = divvyStats.stats.station_activity.splice(0, 5);
    for (let i = 0; i < topStations.length; i++) {
        let id = `top-station-${i}`;
        let station = topStations[i];
        let ridePercent = formatPercentValue(station.total_ride_percent);
        let listItem = document.getElementById(id);
        typeEffect(listItem, `${station.station_name} <span class="percent">(${ridePercent})</span>`);
    }

    let topNeighborhoods = divvyStats.stats.neighborhood_activity.splice(0, 5);
    for (let i = 0; i < topNeighborhoods.length; i++) {
        let id = `top-neighborhood-${i}`;
        let neighborhood = topNeighborhoods[i];
        let ridePercent = formatPercentValue(neighborhood.ride_percent);
        let listItem = document.getElementById(id);
        typeEffect(listItem, `${neighborhood.start_neighborhood} <span class="percent">(${ridePercent})</span>`);
    }

    let memberTrips = getStatItemByKeyValue("rides_by_membership", "member_casual", "member");
    let casualTrips = getStatItemByKeyValue("rides_by_membership", "member_casual", "casual");

    let totalTrips = memberTrips.ride_count + casualTrips.ride_count;

    setElemText("total-trips", new Intl.NumberFormat().format(totalTrips));

    setElemText("counttable-member-percent", formatPercentValue(memberTrips.ride_percent));
    setElemText("counttable-casual-percent", formatPercentValue(casualTrips.ride_percent));

    let averageMemberRevenue = getStatItemByKeyValue("average_revenue_per_trip", "member_casual", "member");
    let totalMemberRevenue = getStatItemByKeyValue("revenue_by_membership", "member_casual", "member");

    setElemText("revtable-member-avg", formatDollarValue(averageMemberRevenue.estimated_revenue));
    setElemText("revtable-member-percent", formatPercentValue(totalMemberRevenue.percent_revenue));

    let averageCasualRevenue = getStatItemByKeyValue("average_revenue_per_trip", "member_casual", "casual");
    let totalCasualRevenue = getStatItemByKeyValue("revenue_by_membership", "member_casual", "casual");

    setElemText("revtable-casual-avg", formatDollarValue(averageCasualRevenue.estimated_revenue));
    setElemText("revtable-casual-percent", formatPercentValue(totalCasualRevenue.percent_revenue));

    setElemText("total-revenue", formatDollarValue(divvyStats.stats.total_estimated_revenue));

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


window.addEventListener('load', async () => {
    await fetchDivvyStats();
    loadStats();
});
