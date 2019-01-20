var deviceList;
var socket = io();

var myTextExtraction = function (node) {
    if ($(node).hasClass("blank")) {
        return 0;
    } else if ($(node).hasClass("date-item")) {
        return moment(node.innerHTML, "DD-MM-YYYY HH:mm").valueOf().toString();
    } else if ($(node).hasClass("level")) {
        return parseInt($(node).text());
    } else if ($(node).hasClass("alarms")) {
        return $(node).children().length
    } else {
        return node.innerHTML;
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
var target = document.getElementById('dispositivos');
var spinner;

$(document).ready(function () {
    spinner = new Spinner(opts).spin(target);

    if ($("#message").length) {
        $("#message").snackbar("show");
    }

    socket.emit("getDevices", {
        alarms: false,
        deviceType: "all",
        substance: "all"
    }, function (data) {
        if (!data.error) {
            data.devices.forEach(updateUI);
        }

        if (data.devices.length > 0) {
            $(".tablesorter").tablesorter({
                textExtraction: myTextExtraction,
                sortList: [[0, 0]]
            });
        }

        spinner.stop();

        $('[data-toggle="tooltip"]').tooltip();

    });

    socket.on("newRecord", updateUI);
});

var updateUI = function (device) {
    if (device.lastRecordThermoAlert) {

        var newRow = "<tr id='device-" + device.identifier + "'>";

        newRow += "<td class='text-center'><a href='/dispositivos/" + device.identifier + "/registros' >" + device.identifier + "</a></td>";
        newRow += "<td class='text-center'>" + device.name + "</td>";

        if (device.lastRecordThermoAlert.maxTemp) {
            newRow += "<td class='text-center'>" + device.lastRecordThermoAlert.maxTemp + "º C</td>";
        } else {
            newRow += "<td class='text-center'>N/A</td>";
        }

        if (device.lastRecordThermoAlert.averageTemp) {
            newRow += "<td class='text-center'>" + device.lastRecordThermoAlert.averageTemp + "º C</td>";
        } else {
            newRow += "<td class='text-center'>N/A</td>";
        }

        newRow += "<td class='text-center'>" + device.lastRecordThermoAlert.sensor.hot + "/" + device.lastRecordThermoAlert.sensor.count + "</td>";
        newRow += "<td class='text-center'>" + moment(new Date(device.lastRecordThermoAlert.time)).tz(moment.tz.guess()).format("DD/MM/YYYY HH:mm") + "</td>";

        newRow += "<td class='text-center'>";

        var hasAlarms = false;

        if (!device.lastRecordThermoAlert.acConnected) {
            if (device.lastRecordThermoAlert.lowBattery) {
                newRow += "<img class='alarm-icon' src='/images/battery.png' height='20px' data-toggle='tooltip' data-placement='top' data-container='body' title='Batería Baja'>";
                hasAlarms = true;
            } else {
                newRow += "<img class='alarm-icon' src='/images/ac-disconnected.png' height='20px' data-toggle='tooltip' data-placement='top' data-container='body' title='Modo Batería'>";
                hasAlarms = true;
            }
        }

        if (!device.lastRecordThermoAlert.allFound) {
            newRow += "<img class='alarm-icon' src='/images/rfid.png' height='20px' data-toggle='tooltip' data-placement='top' data-container='body' title='No todos los tags fueron leídos'>";
            hasAlarms = true;
        }

        if (!device.lastRecordThermoAlert.tempOk) {
            newRow += "<img class='alarm-icon' src='/images/reorder.png' height='20px' data-toggle='tooltip' data-placement='top' data-container='body' title='Se encontrarón sensores calientes'>";
            hasAlarms = true;
        }

        if (!hasAlarms) {
            newRow += "Sín alarmas</td>";
        }

        if ($('#mayoristas-row').length) {
            newRow += "<td class='text-center'>" + device.company + "</td>";
        }

        if ($('#clientes-row').length) {
            newRow += "<td class='text-center'>" + device.client + "</td>";
        }


        newRow += "</td></tr>";

        if ($("#device-" + device.identifier).length) {
            $("#device-" + device.identifier).replaceWith(newRow);
        } else {
            $('#dispositivos').append(newRow);
        }
    } else {
        var newRow = "<tr id='device-" + device.identifier + "'><td class='text-center'><a href='/dispositivos/" + device.identifier + "/registros' >" + device.identifier + "</a></td><td class='text-center'>" + device.name + "</td><td class='text-center'>N/A</td><td class='text-center'>N/A</td><td class='text-center'>N/A</td><td class='text-center'>N/A</td><td class='text-center'>N/A</td>";

        if ($('#mayoristas-row').length) {
            newRow += "<td class='text-center'>" + device.company + "</td>";
        }

        if ($('#clientes-row').length) {
            newRow += "<td class='text-center'>" + device.client + "</td>";
        }

        newRow += "</tr>";


        if ($("#device-" + device.identifier).length) {
            $("#device-" + device.identifier).replaceWith(newRow);
        } else {
            $('#dispositivos').append(newRow);
        }
    }

    $('#devices-table').trigger("update");
}
