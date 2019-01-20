var DEVICE_IDENTIFIER = window.location.pathname.replace("/dispositivos/", "").replace("/registros", "");
var socket = io();
var isDownloading = false;

$.fn.datepicker.dates['es'] = {
    days: ["Domingo", "Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sábado"],
    daysShort: ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"],
    daysMin: ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sa"],
    months: ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Augosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"],
    monthsShort: ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"],
    today: "Hoy",
    clear: "Borrar",
    format: "dd/mm/yyyy",
    titleFormat: "MM yyyy",
    weekStart: 0
};

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
    $('form').submit(false);
    $('#start-date').datepicker({
        autoclose: true,
        language: "es",
        todayBtn: "linked",
        disableTouchKeyboard: true
    }).on('changeDate', function (e) {
        $('#end-date').datepicker('setStartDate', e.date);
    });

    $('#end-date').datepicker({
        autoclose: true,
        language: "es",
        todayBtn: "linked",
        disableTouchKeyboard: true
    })

    $('#start-date').datepicker('update', "-2m");
    $('#end-date').datepicker('update', "today");

    getRecords();
});

$('#info-registro').on('shown.bs.modal', function (event) {
    var recordId = $(event.relatedTarget).data('record-id');
    socket.emit("getRecordById", recordId, function (data) {
        if (data.error) {
            $.snackbar({
                content: data.message,
            });
            $('#info-registro').modal('hide');
        } else {
            $('#info-registro').find("#level").text(data.record.level + "%")
            $('#info-registro').find("#battery-level").text(data.record.battery + "0%")
            $('#info-registro').find("#signal").text("-" + data.record.signal + " dBm")
            $('#info-registro').find("#pressure").text(data.record.pressure + " psi")
            $('#info-registro').find("#time").text(moment(new Date(data.record.time)).tz(moment.tz.guess()).format("DD-MM-YYYY HH:mm"));
            var hasAlarm = false;
            for (var key in data.record.alarms) {
                if (data.record.alarms[key]) {
                    hasAlarm = true;
                }
            }
            if (hasAlarm) {
                $('#info-registro').find(".alarm-section").css("display", "inline-block");
                if (data.record.alarms.highLevel) {
                    $('#info-registro').find("#high-level-alarm").css("display", "inline-block");
                }
                if (data.record.alarms.reorder) {
                    $('#info-registro').find("#reorder-level-alarm").css("display", "inline-block");
                }
                if (data.record.alarms.lowLevel) {
                    $('#info-registro').find("#low-level-alarm").css("display", "inline-block");
                }
                if (data.record.alarms.highPressure) {
                    $('#info-registro').find("#high-pressure-alarm").css("display", "inline-block");
                }
                if (data.record.alarms.lowPressure) {
                    $('#info-registro').find("#low-pressure-alarm").css("display", "inline-block");
                }
                if (data.record.alarms.filling) {
                    $('#info-registro').find("#filling-alarm").css("display", "inline-block");
                }
                if (data.record.alarms.data) {
                    $('#info-registro').find("#data-alarm").css("display", "inline-block");
                }
                if (data.record.alarms.battery) {
                    $('#info-registro').find("#battery-alarm").css("display", "inline-block");
                }
                if (data.record.alarms.notConnected) {
                    $('#info-registro').find("#not-connected-alarm").css("display", "inline-block");
                }
            }

        }
    });
});

$('#info-registro').on('hidden.bs.modal', function (event) {
    $('#info-registro .modal-body').find("span").text('');
    $('#info-registro').find("#time").text('');
    $('#info-registro').find(".alarm-section").css('display', 'none');
    $('#info-registro').find(".alarm-icon").css('display', 'none');
});

function getRecords() {
    var startDate = $('#start-date').datepicker('getDate');
    var endDate = $('#end-date').datepicker('getDate');
    endDate.setHours(23, 59, 59, 99);

    if (!isDownloading) {
        if (startDate.getTime() < endDate.getTime()) {
            isDownloading = true;
            spinner = new Spinner(opts).spin(target);
            socket.emit("getAllRecords", {
                device: DEVICE_IDENTIFIER,
                timezone: moment.tz.guess(),
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString()
            }, function (data) {
                spinner.stop();
                isDownloading = false;
                $('.record-row').remove();
                if (!data.error) {
                    if (data.records.length) {
                        data.records.forEach(function (record, index) {
                            var hasAlarm = false;
                            for (var key in record.alarms) {
                                if (record.alarms[key]) {
                                    hasAlarm = true;
                                }
                            }
                            var newRow = "<tr class='record-row' ";

                            if (data.canDeleteRecords) {
                                newRow += "oncontextmenu='deleteRecord(this); return false;' ";
                            }

                            newRow += "data-record-id='" + record._id + "' id='" + index + "'>";

                            newRow += "<td class='text-center'><a role='button' onclick='openComments(this)' data-record-id='" + record._id + "' data-time='" + moment(new Date(record.time)).tz(moment.tz.guess()).format("DD/MM/YYYY HH:mm") + "'>";
                            newRow += moment(new Date(record.time)).tz(moment.tz.guess()).format("DD/MM/YYYY HH:mm")
                            newRow += "</a></td>"

                            if (record.maxTemp) {
                                newRow += "<td class='text-center'>" + record.maxTemp + "º C</td>";
                            } else {
                                newRow += "<td class='text-center'>N/A</td>";
                            }

                            if (record.sensorAverageTemp) {
                                if (record.sensorAverageTemp.sensor1) {
                                    newRow += "<td class='text-center'>" + record.sensorAverageTemp.sensor1 + "º C</td>";
                                } else {
                                    newRow += "<td class='text-center'>N/A</td>";
                                }

                                if (record.sensorAverageTemp.sensor2) {
                                    newRow += "<td class='text-center'>" + record.sensorAverageTemp.sensor2 + "º C</td>";
                                } else {
                                    newRow += "<td class='text-center'>N/A</td>";
                                }

                                if (record.sensorAverageTemp.sensor3) {
                                    newRow += "<td class='text-center'>" + record.sensorAverageTemp.sensor3 + "º C</td>";
                                } else {
                                    newRow += "<td class='text-center'>N/A</td>";
                                }

                                if (record.sensorAverageTemp.sensor4) {
                                    newRow += "<td class='text-center'>" + record.sensorAverageTemp.sensor4 + "º C</td>";
                                } else {
                                    newRow += "<td class='text-center'>N/A</td>";
                                }

                                if (record.sensorAverageTemp.sensor5) {
                                    newRow += "<td class='text-center'>" + record.sensorAverageTemp.sensor5 + "º C</td>";
                                } else {
                                    newRow += "<td class='text-center'>N/A</td>";
                                }

                                if (record.sensorAverageTemp.sensor6) {
                                    newRow += "<td class='text-center'>" + record.sensorAverageTemp.sensor6 + "º C</td>";
                                } else {
                                    newRow += "<td class='text-center'>N/A</td>";
                                }
                            } else {
                                newRow += "<td class='text-center'>N/A</td>";
                                newRow += "<td class='text-center'>N/A</td>";
                                newRow += "<td class='text-center'>N/A</td>";
                                newRow += "<td class='text-center'>N/A</td>";
                                newRow += "<td class='text-center'>N/A</td>";
                                newRow += "<td class='text-center'>N/A</td>";
                            }

                            if ($("#sensors-col").length) {
                                newRow += "<td class='text-center'>" + record.sensor.count + "</td>";
                            }
                            if ($("#read-col").length) {
                                newRow += "<td class='text-center'>" + record.sensor.read + "</td>";
                            }
                            if ($("#hot-col").length) {
                                newRow += "<td class='text-center'>" + record.sensor.hot + "</td>";
                            }
                            if ($("#alarms-col").length) {
                                newRow += "<td class='text-center'>"
                                if (!record.acConnected) {
                                    if (record.lowBattery) {
                                        newRow += "<img class='alarm-icon' src='/images/battery.png' height='20px' data-toggle='tooltip' data-placement='top' data-container='body' title='Batería Baja'>";
                                    } else {
                                        newRow += "<img class='alarm-icon' src='/images/ac-disconnected.png' height='20px' data-toggle='tooltip' data-placement='top' data-container='body' title='Modo Batería'>";
                                    }
                                }
                                if (!record.allFound) {
                                    newRow += "<img class='alarm-icon' src='/images/rfid.png' height='20px' data-toggle='tooltip' data-placement='top' data-container='body' title='No todos los tags fueron leídos'>";
                                }
                                if (!record.tempOk) {
                                    newRow += "<img class='alarm-icon' src='/images/reorder.png' height='20px' data-toggle='tooltip' data-placement='top' data-container='body' title='Se encontrarón sensores calientes'>";
                                }
                                newRow += "</td>";
                            }
                            newRow += "</tr>";
                            $("#records-tbody").prepend(newRow);

                        });
                    } else {
                        $('#grafica').html("<center>No se encontraron registros con las fechas seleccionadas</center>")
                    }
                } else {
                    $('#grafica').html("<center>Ocurrio un error al obtener los registros del dispositivo</center>")
                }

                $('[data-toggle="tooltip"]').tooltip();
            });
        }
    }
}

function deleteRecord(row) {
    ezBSAlert({
        type: "confirm",
        messageText: "¿Seguro desea eliminar el registro?",
        alertType: "danger",
    }).done(function (confirmacion) {
        if (confirmacion) {
            $(row).remove()
            socket.emit("deleteRecordById", row.dataset.recordId, function (data) {

                $.snackbar({
                    content: data.message,
                });

                if (!data.error) {
                    $(row).remove()
                }
            });
        }
    });
};

function eliminarDispositivo(id) {
    ezBSAlert({
        type: "confirm",
        messageText: "¿Seguro desea eliminar el dispositivo?",
        alertType: "danger",
    }).done(function (confirmacion) {
        if (confirmacion) {
            socket.emit("deleteDeviceById", id, function (data) {
                $.snackbar({
                    content: data.message,
                });
                if (!data.error) {
                    window.location.href = "/dispositivos"
                }
            });
        }
    });
};

function downloadExcel() {
    var startDate = $('#start-date').datepicker('getDate');
    var endDate = $('#end-date').datepicker('getDate');
    endDate.setHours(23, 59, 59, 99);

    window.location = "/reports/excel?device=" + DEVICE_IDENTIFIER + "&startdate=" + startDate.toISOString() + "&enddate=" + endDate.toISOString() + "&tz=" + moment.tz.guess();
}

function openComments(row) {
    ezBSAlert({
        type: "display-comments",
        headerText: row.dataset.time,
        alertType: "default",
        record_id: row.dataset.recordId
    }).then(note_id => {
        if (note_id) {
            var anns = graphicElement.annotations();
            let newAnns = [];
            let newAnnotations = [];
            anns.forEach(a => {
                if (a.note.note_id != note_id) {
                    newAnns.push(a)
                }
            });

            annotations.forEach(a => {
                if (a.note.note_id != note_id) {
                    newAnnotations.push(a)
                }
            });

            annotations = newAnnotations;
            graphicElement.setAnnotations(newAnns)
        }
    });
}
