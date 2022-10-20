let radiusKm = 1;
let circle;
let map;
let crd;
let layerBikes;
let layerBuses;
let layerStations;
let positionMarker;
let enabledBikes = [];
let enabledBuses = [];
let enabledStations = [];
const allBikes = [];
const allBuses = [];
const allStations = [];
const maxRadius = 4;
const minRadius = 0.2;
const stepRadius = 0.2;
const tooltipPosition = 'Ma Position';

const options = {
    enableHighAccuracy: true,
    timeout: 5000,
    maximumAge: 0
}

const LeafIcon = L.Icon.extend({})

let positionIcon = new LeafIcon({
    iconUrl: 'assets/images/position.png',
    iconSize: [40, 40],
})


let veloIcon = {
    icon: L.icon({
        iconUrl: 'assets/images/velo.png',
        iconSize: [40, 40]
    })
}

let busIcon = {
    icon: L.icon({
        iconUrl: 'assets/images/bus.png',
        iconSize: [40, 40]
    })
}

let stationIcon = {
    icon: L.icon({
        iconUrl: 'assets/images/station.png',
        iconSize: [40, 40]
    })
}

L.Control.Command = L.Control.extend({
    options: {
        position: 'bottomleft',
    },

    onAdd: function (map) {
        const controlDiv = L.DomUtil.create('div', 'leaflet-control-command');
        controlDiv.style.textAlign = "left";
        L.DomEvent.disableClickPropagation(controlDiv);

        const controlUI = L.DomUtil.create('div', 'leaflet-control-command-interior', controlDiv);
        controlUI.title = 'Nearby Radius';
        controlUI.style.width = 'auto';
        controlUI.style.height = 'auto';
        controlUI.style.textAlign = 'center';

        const label = L.DomUtil.create('h4', 'label-range', controlUI);
        label.innerText = radiusKm + ' km';

        const rangeInput = L.DomUtil.create('input', 'input-range', controlUI);
        rangeInput.min = minRadius;
        rangeInput.step = stepRadius;
        rangeInput.value = radiusKm;
        rangeInput.max = maxRadius;
        rangeInput.type = "range";
        L.DomEvent.addListener(rangeInput, 'input', function () {
            radiusKm = this.value;
            label.innerText = this.value + ' km';
            circle.setRadius(radiusKm * 1000);
            updateMap()
        });

        return controlDiv;
    }
});

L.control.command = function (options) {
    return new L.Control.Command(options);
};


L.Control.Position = L.Control.extend({
    options: {
        position: 'bottomright',
    },

    onAdd: function (map) {
        const controlDiv = L.DomUtil.create('div', 'leaflet-control-command');
        controlDiv.style.textAlign = "center";
        controlDiv.style.width = 'auto';
        controlDiv.style.height = 'auto';
        L.DomEvent.disableClickPropagation(controlDiv);

        const controlUI = L.DomUtil.create('div', 'leaflet-control-command-interior', controlDiv);
        controlUI.title = 'Locate';
        controlUI.style.textAlign = 'center';
        controlUI.id = 'controlUI-locate';

        const img = L.DomUtil.create('img', 'postion-button', controlUI);
        img.src = "assets/images/location.png";
        img.width = 30;
        img.height = 30;
        img.style.veticalAlign = 'middle';
        L.DomEvent.addListener(img, 'click', function () {
            initPositionMarker();
            circle.setLatLng(positionMarker.getLatLng());
            updateMap();
        });
        return controlDiv;
    }
});

L.control.position = function (options) {
    return new L.Control.position(options);
};

async function fetchApi(url) {
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                accept: 'application/json',
            },
        });

        if (!response.ok) {
            console.error(err);
            throw new Error(`Error! status: ${response.status}`);
        }

        const result = await response.json();
        return result;
    } catch (error) {
        console.log(error);
    }
}

function updateMap() {

    circle.setRadius(radiusKm * 1000);

    enabledBikes = [];
    enabledBuses = [];
    enabledStations = [];

    enabledBikes = allBikes.filter(bike => isInsideRadius(bike.getLatLng()));
    enabledBuses = allBuses.filter(bus => isInsideRadius(bus.getLatLng()));
    enabledStations = allStations.filter(station => isInsideRadius(station.getLatLng()));

    if (layerBikes !== undefined) {
        layerBikes.clearLayers();
        layerBuses.clearLayers();
        layerStations.clearLayers();

        enabledBikes.map(bike => layerBikes.addLayer(bike));
        enabledBuses.map(bus => layerBuses.addLayer(bus));
        enabledStations.map(station => layerStations.addLayer(station));
    } else {
        layerBikes = L.layerGroup(enabledBikes);
        layerBuses = L.layerGroup(enabledBuses);
        layerStations = L.layerGroup(enabledStations);
    }
}

async function loadAllBikes() {
    const resultBikes = await fetchApi('https://api.agglo-larochelle.fr/production/opendata/api/records/1.0/search/dataset=yelo___disponibilite_des_velos_en_libre_service&facet=station_nom&rows=1000&api-key=');
    for (let i of resultBikes['records']) {
        const field = i.fields;
        const tooltip = field.station_nom.slice(3).trim();
        const popup = "Vélos disponibles : " + field.velos_disponibles;
        allBikes.push(L.marker([field.station_latitude, field.station_longitude], veloIcon).bindPopup((popup === "" ? "" : "<strong style='font-size:1.1em'>" + popup + "</strong><br>" + tooltip)).bindTooltip(tooltip));
    }
}

async function loadAllStations() {
    const resultStations = Papa.parse(await fetch('https://raw.githubusercontent.com/Diskata/gares/main/ensemble_gares.csv')
        .then(response => {
            return response.text()
        }));

    for (let i of resultStations.data.slice(2)) {
        try {
            allStations.push(L.marker([i[2], i[3]], stationIcon).bindTooltip(i[1]).bindPopup("<strong style='font-size:1.1em'>" + i[1] + "</strong><br>Gare"));
        } catch (err) {
            console.error(err);
        }
    }
}

async function loadAllBuses() {
    const resultBuses = await fetchApi('https://api.agglo-larochelle.fr/production/opendata/api/records/1.0/search/dataset=transport_yelo___gtfs_stop_des_bus&facet=stop_id&rows=1000&refine.location_type=1');
    for (let i of resultBuses['records']) {
        const field = i.fields;
        const popup = field.stop_name;
        allBuses.push(L.marker([field.stop_lat, field.stop_lon], busIcon).bindPopup("<strong style='font-size:1.1em'>" + popup + "</strong><br>").bindTooltip(popup));
    }
}

async function initMap() {

    await loadAllBikes();
    await loadAllBuses();
    await loadAllStations();
    circle = L.circle([crd.latitude, crd.longitude], radiusKm * 1000, {
        color: 'red',
        fillColor: 'red',
        fillOpacity: 0.05
    });
    const layerCircle = L.layerGroup([circle]);

    map = L.map('map').setView([crd.latitude, crd.longitude], 13);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);

    updateMap();
    layerBikes.addTo(map);
    layerBuses.addTo(map);
    layerStations.addTo(map);
    const overlayMaps = {
        "Bikes": layerBikes,
        "Buses": layerBuses,
        "Stations": layerStations,
        "Radius": layerCircle,
    };

    const layerControl = L.control.layers(null, overlayMaps, {
        position: 'topright'
    });
    layerControl.addTo(map);
    initPositionMarker();
    map.addControl(new L.Control.Command);
    map.addControl(new L.Control.Position);
}

function initPositionMarker() {
    if (positionMarker !== undefined) {
        positionMarker.remove();
    }

    positionMarker = L.marker([crd.latitude, crd.longitude], {
        draggable: true,
    }).bindTooltip(tooltipPosition).bindPopup("<strong style='font-size:1.1em'>" + tooltipPosition + "</strong>");

    positionMarker.options.icon = positionIcon;
    positionMarker.on('drag', function (e) {
        circle.setLatLng(e.latlng);
        updateMap();
    });

    positionMarker.addTo(map);
}

async function success(pos) {
    crd = pos.coords;
    console.log('Your current position is:');
    console.log(`Latitude : ${crd.latitude}`);
    console.log(`Longitude: ${crd.longitude}`);
    console.log(`More or less ${crd.accuracy} meters.`);
    console.log("Nearby radius : " + radiusKm + " km");

    initMap();


    /* //Read and add csv data
    const resultGares = await fetchApi('https://api.sncf.com/v1/coverage/sncf/stop_areas/stop_area:SNCF:87485003/departures');
    for (let i of resultBuses['records']) {
        const field = i.fields;
        addMarker(field.stop_lat, field.stop_lon, field.stop_name, map, busIcon);
    }
    console.log("map");
    */

}

function isInsideRadius(latLng) {
    const distance = latLng.distanceTo(circle.getLatLng());
    return distance < circle.getRadius() - 50;
}

function error(err) {
    let message = "";
    switch (err.code) {
        case 1:
            message = "Permission refusée";
            break;
        case 2:
            message = "Position non disponibe";
            break;
        case 3:
            message = "Dépassement de délai";
            break;
        case 4:
            message = "Erreur inconnue";
            break;
    }
}

function getposition() {
    navigator.geolocation.getCurrentPosition(success, error, options);
}


getposition();