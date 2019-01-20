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

$(document).ready(function () {
    bounds = new google.maps.LatLngBounds();

    $("select").val(function () {
        return this.dataset.selection
    });

    $('#filtros').on('hidden.bs.collapse', function (event) {
        $(this).find('select').val(function () {
            return this.dataset.selection
        });
    });

    map = new google.maps.Map(document.getElementById('map'), {
        scrollwheel: true,
        disableDefaultUI: true,
        zoom: 14,
        maxZoom: 18,
        clickableIcons: false,
        streetViewControl: false,
        fullscreenControl: false
    });

    $input.change(function (e) {
        var current = $input.typeahead("getActive");
        if (current) {
            if (current.name == $input.val()) {
                buscar(current.identifier);
            }
        }
    });

    socket.emit("getDevices", {
        alarms: document.getElementById('alarms-filter').value,
        deviceType: document.getElementById('devicetype-filter').value,
        substance: document.getElementById('substance-filter').value
    }, function (data) {
        if (!data.error) {
            data.devices.forEach(updatedUI)

            map.fitBounds(bounds);

            var markerCluster = new MarkerClusterer(map, markers, {
                imagePath: 'https://developers.google.com/maps/documentation/javascript/examples/markerclusterer/m'
            });
        }
    });

    socket.on("newRecord", updatedUI)
});

function pinSymbol(color, alarm) {
    var url = "./images/" + color;
    alarm ? url += "-alarm.png" : url += "-globe.png";
    return url;
}

var updatedUI = function (device) {
    // && (device.lastRecord || device.lastRecordThermoAlert)
    if (device.location.coordinates[0] && device.location.coordinates[1]) {

        if (device.lastRecord && device.deviceType != "ThermoAlert+") {

            addSearchElement({
                identifier: device.identifier,
                name: device.identifier + ", " + device.name
            });

            var hasAlarm = false;
            for (var key in device.alarms) {
                if (device.alarms[key]) {
                    hasAlarm = true;
                }
            }
            var color = 'green';
            if (device.lastRecord.level >= device.thresholdValues.highLevel) {
                color = 'red';
            }

            if (device.lastRecord.level <= device.thresholdValues.reorder) {
                color = 'yellow';
            }

            if (device.lastRecord.level <= device.thresholdValues.lowLevel) {
                color = 'red';
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

            var content = "<a href='/dispositivos/" + device.identifier + "/registros'>";

            content += "<h4>" + device.name + "</h4>";
            content += "</a>";
            content += "<p>Identificador: <b>" + device.identifier + "</b></p>";
            content += "<div class='display: inline-block;'><p>Nivel:</p>";
            content += '<div class="progress">';
            content += '<div class="progress-bar';


            if (device.deviceType == "Teletank H2O") {
                if (device.lastRecord.level <= device.thresholdValues.minOpt && device.lastRecord.level > device.thresholdValues.lowLevel) {
                    content += ' progress-bar-warning';
                } else if (device.lastRecord.level <= device.thresholdValues.lowLevel) {
                    content += ' progress-bar-danger';
                } else {
                    content += ' progress-bar-success';
                }
                content += '" id="level" role="progressbar" style="width: ' + device.lastRecord.level + '%;">' + device.lastRecord.level + '%</div></div>';
                content += '</div></div>';
            } else {
                if (device.lastRecord.level <= device.thresholdValues.reorder && device.lastRecord.level > device.thresholdValues.lowLevel) {
                    content += ' progress-bar-warning';
                } else if (device.lastRecord.level <= device.thresholdValues.lowLevel) {
                    content += ' progress-bar-danger';
                } else {
                    content += ' progress-bar-success';
                }
                content += '" id="level" role="progressbar" style="width: ' + device.lastRecord.level + '%;">' + device.lastRecord.level + '%</div></div>';
                content += '</div></div>';
            }

            if (device.deviceType == "Tank-Tel" || device.deviceType == "DataPort") {
                content += "<p>Presión: <b>" + device.lastRecord.pressure + " psi</b></p>";
            }

            if (device.deviceType == "Fairbanks" || device.deviceType == "DataPort") {
                content += "<p>Peso: <b>" + device.lastRecord.pressure + " " + device.capacity.unit + "</b></p>";
            }

            content += "<p>Último registro: <b>" + moment(new Date(device.lastRecord.time)).tz(moment.tz.guess()).format("DD/MMM/YYYY HH:mm") + "</b></p>";

            if (hasAlarm) {
                content += "<p style='color:gray'><b>Alarmas</b></p>";
                if (device.alarms.highLevel) {
                    content += "<p style='color: red'><img class='alarm-icon' src='images/high-level.png' height='20px'>Nivel alto</p>";
                } else if (device.alarms.reorder) {
                    content += "<p style='color: red'><img class='alarm-icon' src='images/reorder.png' height='20px'>Nivel de reorden</p>";
                } else if (device.alarms.lowLevel) {
                    content += "<p style='color: red'><img class='alarm-icon' src='images/low-level.png' height='20px'>Nivel crítico</p>";
                }

                if (device.alarms.highPressure) {
                    content += "<p style='color: red'><img class='alarm-icon' src='images/high-pressure.png' height='20px'>Presión alta</p>";
                } else if (device.alarms.lowPressure) {
                    content += "<p style='color: red'><img class='alarm-icon' src='images/low-pressure.png' height='20px'>Presión baja</p>";
                }

                if (device.alarms.filling) {
                    content += "<p style='color: red'><img class='alarm-icon' src='images/filling.png' height='20px'>Modo de llenado</p>";
                }

                if (device.alarms.battery) {
                    content += "<p style='color: red'><img class='alarm-icon' src='images/battery.png' height='20px'>Modo batería</p>";
                }

                if (device.alarms.data) {
                    content += "<p style='color: red'><img class='alarm-icon' src='images/data-disconnected.png' height='20px'>Cable de datos desconectado</p>";
                }

                if (device.alarms.notConnected) {
                    content += "<p style='color: red'><img class='alarm-icon' src='images/no-connection.png' height='20px'>No conectado</p>";
                }
            }

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
        } else if (device.lastRecordThermoAlert && device.deviceType == "ThermoAlert+") {

            addSearchElement({
                identifier: device.identifier,
                name: device.identifier + ", " + device.name
            });

            var hasAlarm = (!device.lastRecordThermoAlert.allRead || device.lastRecordThermoAlert.lowBattery || !device.lastRecordThermoAlert.acConnected || !device.lastRecordThermoAlert.tempOk);

            var color = 'green';

            device.lastRecordThermoAlert.allRead ? color = 'green' : color = 'yellow';
            device.lastRecordThermoAlert.tempOk ? color = color : color = 'red';

            var marker = new google.maps.Marker({
                map: map,
                position: {
                    lat: device.location.coordinates[0],
                    lng: device.location.coordinates[1]
                },
                title: device.name,
                icon: pinSymbol(color, hasAlarm)
            });

            var content = "<a href='/dispositivos/" + device.identifier + "/registros'>";

            content += "<h4>" + device.name + "</h4>";
            content += "</a>";
            content += "<p>Identificador: <b>" + device.identifier + "</b></p>";

            content += "<p>Presión: <b>" + device.lastRecordThermoAlert.sensor.read + "/" + device.lastRecordThermoAlert.sensor.count + "</b></p>";

            content += "<p>Último registro: <b>" + moment(new Date(device.lastRecordThermoAlert.time)).tz(moment.tz.guess()).format("DD/MMM/YYYY HH:mm") + "</b></p>";

            if (hasAlarm) {
                content += "<p style='color:gray'><b>Alarmas</b></p>";

                if (!device.lastRecordThermoAlert.acConnected) {
                    if (device.lastRecordThermoAlert.lowBattery) {
                        content += "<p style='color: red'><img class='alarm-icon' src='images/battery.png' height='20px'>Batería Baja</p>";
                    } else {
                        content += "<p style='color: red'><img class='alarm-icon' src='images/ac-disconnected.png' height='20px'>Modo Batería</p>";
                    }
                }

                if (!device.lastRecordThermoAlert.allFound) {
                    content += "<p style='color: red'><img class='alarm-icon' src='images/rfid.png' height='20px'>No todos los tags fueron leídos</p>";
                }
                if (!device.lastRecordThermoAlert.tempOk) {
                    content += "<p style='color: red'><img class='alarm-icon' src='images/reorder.png' height='20px'>Se encontrarón sensores calientes</p>";
                }
            }

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
        }

    }
}
