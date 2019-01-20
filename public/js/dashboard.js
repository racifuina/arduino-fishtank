var socket = io();
var g;
var bounds;
var hasDevicesWithLocation = false;
var map;
var colors = {
    red: "rgba(255, 87, 34, 1)",
    green: "rgba(102, 187, 106, 1)",
    yellow: "rgba(255, 238, 88, 1)",
};
var markers = [];
var marcadores = {};
var infoWindows = {};
var $input = $(".typeahead");
var searchData = [];
var alarmas = {
    allFound: 0,
    lowBat: 0,
    acConnected: 0,
    tempOk: 0,
    noAlarms: 0
};
var totalAlarmas = 0;
var locationAlarms = {};

function addSearchElement(element) {
    if (searchData.indexOf(element) == -1) {
        searchData.push(element)
        $input.typeahead({
            source: searchData,
            autoSelect: false
        });
    }
}

function buscar(id) {
    var marker = marcadores[id];
    var infoWindow = infoWindows[id];

    if (marker && infoWindow) {
        map.setCenter(marker.position);
        map.setZoom(16)
        infoWindow.open(map, marker);
    }
}

var opts = {
    lines: 13,
    length: 28,
    width: 15,
    radius: 42,
    scale: 1,
    corners: 1,
    color: '#000',
    opacity: 0.25,
    rotate: 0,
    direction: 1,
    speed: 1,
    trail: 60,
    fps: 20,
    zIndex: 2e9,
    className: 'spinner',
    top: '50%',
    left: '50%',
    shadow: false,
    hwaccel: false,
    position: 'absolute'
}
var target = document.getElementById('main');
var spinner;

$(document).ready(function () {
    if ($("#message").length) {
        $("#message").snackbar("show");
    }

    spinner = new Spinner(opts).spin(target);
    bounds = new google.maps.LatLngBounds();

    socket.emit("getDevices", {}, function (data) {
        if (!data.error) {
            data.devices.forEach(updatedUI);
            map.fitBounds(bounds);
            var markerCluster = new MarkerClusterer(map, markers, {
                imagePath: 'https://developers.google.com/maps/documentation/javascript/examples/markerclusterer/m'
            });
            google.charts.load('current', {
                'packages': ['corechart']
            });
            google.charts.setOnLoadCallback(drawChart);
            //calcular total de alarmas
            if (totalAlarmas > 0) {
                for (var location in locationAlarms) {
                    $('#location-list').append('<a class="list-group-item"><b>' + location.toUpperCase() + '</b><span class="badge">' + locationAlarms[location] + '</span></a>')
                }
            } else {
                $('#location-list').append('<a class="list-group-item"><b>NO SE ENCONTRARÓN ALARMAS</b></a>')

            }
        }
        spinner.stop();
    });

    socket.on("newRecord", updatedUI)

    $('.time').text(function () {
        return moment(new Date(parseFloat(this.dataset.timestamp))).tz(moment.tz.guess()).format("DD/MMM/YYYY HH:mm");
    });

    $('[data-toggle="tooltip"]').tooltip();

    function drawChart() {
        var data = google.visualization.arrayToDataTable([
          ['Alarma', 'Cantidad'],
          ['Temperatura Alta', alarmas.tempOk],
          ['Modo Batería', alarmas.acConnected],
          ['Batería Baja', alarmas.lowBat],
          ['Lectura de sensores', alarmas.allFound],
          ['Sin Alarmas', alarmas.noAlarms]
        ]);

        var options = {
            chartArea: {
                left: 15,
                top: 20,
                width: '90%',
                height: '90%'
            },
            backgroundColor: "#F2F2F2",
            title: "TIPOS DE ALARMAS",
            colors: ["#e74c3c", "#e67e22", "#f1c40f", "#9b59b6", "#2ecc71"]
        };

        var chart = new google.visualization.PieChart(document.getElementById('piechart'));
        chart.draw(data, options);
    }

    map = new google.maps.Map(document.getElementById('map'), {
        scrollwheel: true,
        disableDefaultUI: false,
        zoom: 14,
        maxZoom: 18,
        clickableIcons: false,
        streetViewControl: false,
        fullscreenControl: false,
        center: {
            lat: -34.397,
            lng: 150.644
        },

    });

    $input.change(function (e) {
        var current = $input.typeahead("getActive");
        if (current) {
            if (current.name == $input.val()) {
                buscar(current.identifier);
            }
        }
    });
});

function pinSymbol(color, alarm) {
    var url = "./images/" + color;
    alarm ? url += "-alarm.png" : url += "-globe.png";
    return url;
}

var updatedUI = function (device) {
    if (device.location.coordinates[0] && device.location.coordinates[1]) {

        addSearchElement({
            identifier: device.identifier,
            name: device.identifier + ", " + device.name
        });

        var color = "green";
        var content = "<a href='/dispositivos/" + device.identifier + "/registros'><h4>" + device.name + "</h4></a>";
        content += "<p>Identificador: <b>" + device.identifier + "</b></p>";

        if (device.lastRecordThermoAlert) {
            var hasAlarm = (!device.lastRecordThermoAlert.allFound || device.lastRecordThermoAlert.lowBattery || !device.lastRecordThermoAlert.acConnected || !device.lastRecordThermoAlert.tempOk);
            device.lastRecordThermoAlert.allFound ? color = 'green' : color = 'yellow';
            device.lastRecordThermoAlert.tempOk ? color = color : color = 'red';

            content += "<p>Sensores Leídos: <b>" + device.lastRecordThermoAlert.sensor.read + "/" + device.lastRecordThermoAlert.sensor.count + "</b></p>";
            content += "<p>Sensores Calientes: <b>" + device.lastRecordThermoAlert.sensor.hot + "/" + device.lastRecordThermoAlert.sensor.count + "</b></p>";

            content += "<p>Último registro: <b>" + moment(new Date(device.lastRecordThermoAlert.time)).tz(moment.tz.guess()).format("DD/MMM/YYYY HH:mm") + "</b></p>";

            if (hasAlarm == true) {
                totalAlarmas++;
                var locationString = device.location.town + ", " + device.location.state
                if (locationAlarms[locationString]) {
                    locationAlarms[locationString] += 1;
                } else {
                    locationAlarms[locationString] = 1;
                }
                content += "<p style='color:gray'><b>Alarmas</b></p>";
                if (!device.lastRecordThermoAlert.acConnected) {
                    if (device.lastRecordThermoAlert.lowBattery) {
                        content += "<p style='color: red'><img class='alarm-icon' src='images/battery.png' height='20px'>Batería Baja</p>";
                        alarmas.lowBattery++;
                    } else {
                        content += "<p style='color: red'><img class='alarm-icon' src='images/ac-disconnected.png' height='20px'>Modo Batería</p>";
                        alarmas.acConnected++;
                    }
                }
                if (!device.lastRecordThermoAlert.allFound) {
                    content += "<p style='color: red'><img class='alarm-icon' src='images/rfid.png' height='20px'>No todos los tags fueron leídos</p>";
                    alarmas.allFound++;
                }
                if (!device.lastRecordThermoAlert.tempOk) {
                    content += "<p style='color: red'><img class='alarm-icon' src='images/reorder.png' height='20px'>Se encontrarón sensores calientes</p>";
                    alarmas.tempOk++;
                }
            } else {
                alarmas.noAlarms++;
            }
        } else {
            alarmas.noAlarms++;
        }

        var marker = new google.maps.Marker({
            map: map,
            position: {
                lat: device.location.coordinates[0],
                lng: device.location.coordinates[1]
            },
            title: device.name,
            icon: pinSymbol(color, hasAlarm)
        });

        var infowindow = new google.maps.InfoWindow({
            content: content
        });

        if (infoWindows[device.identifier]) {
            infoWindows[device.identifier].setMap(null);
        }

        infoWindows[device.identifier] = infowindow;

        marker.addListener('click', function () {
            infowindow.open(map, marker);
        });

        if (marcadores[device.identifier]) {
            marcadores[device.identifier].setMap(null);
        }

        marcadores[device.identifier] = marker;

        markers.push(marker);
        bounds.extend(marker.position);

    } else {

        if (device.lastRecordThermoAlert) {

            var hasAlarm = (!device.lastRecordThermoAlert.allFound || device.lastRecordThermoAlert.lowBattery || !device.lastRecordThermoAlert.acConnected || !device.lastRecordThermoAlert.tempOk);

            if (hasAlarm == true) {
                totalAlarmas++;
                var locationString = device.location.town + ", " + device.location.state
                if (locationAlarms[locationString]) {
                    locationAlarms[locationString] += 1;
                } else {
                    locationAlarms[locationString] = 1;
                }
                if (!device.lastRecordThermoAlert.acConnected) {
                    if (device.lastRecordThermoAlert.lowBattery) {
                        alarmas.lowBattery++;
                    } else {
                        alarmas.acConnected++;
                    }
                }
                if (!device.lastRecordThermoAlert.allFound) {
                    alarmas.allFound++;
                }
                if (!device.lastRecordThermoAlert.tempOk) {
                    alarmas.tempOk++;
                }
            } else {
                alarmas.noAlarms++;
            }

        } else {
            alarmas.noAlarms++;
        }
    }

}
