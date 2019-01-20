var alreadySubmitted = false;
var socket = io();

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

function onlyPositiveFloats(evt) {
    var input = evt.target;

    if (evt.which == 46 && input.value.includes(".")) {
        return false;
    }
    var charCode = (evt.which) ? evt.which : evt.keyCode;
    if (charCode != 46 && charCode > 31 &&
        (charCode < 48 || charCode > 57))
        return false;
    return true;
}

function onlyFloats(evt) {
    var input = evt.target;

    if (input.value.length > 0 && evt.which == 45) {
        return false
    }
    if (evt.which == 46 && input.value.includes(".")) {
        return false;
    }
    var charCode = (evt.which) ? evt.which : evt.keyCode;
    if (charCode != 45 && charCode != 46 && charCode > 31 &&
        (charCode < 48 || charCode > 57))
        return false;
    return true;
}


$(document).ready(function () {
    if ($("#message").length) {
        $("#message").snackbar("show");
    }

    $("select").val(function () {
        return this.dataset.selection
    });

    if (document.getElementById("country").dataset.selection) {
        socket.emit("getStates", $('#country').val().trim(), states => {
            $('#estado').children().remove();
            $('#estado').append($('<option>', {
                value: '',
                text: 'Selecciona un estado'
            }));

            states.forEach(state => {
                $('#estado').append($('<option>', {
                    value: state,
                    text: state
                }));
            });

            $("#estado").val(function () {
                return this.dataset.selection
            });

            if (document.getElementById("estado").dataset.selection) {
                socket.emit("getMunicipios", {
                    country: $('#country').val().trim(),
                    state: $('#estado').val().trim()
                }, municipios => {
                    $('#municipio').children().remove();
                    municipios.forEach(municipio => {
                        $('#municipio').append($('<option>', {
                            value: municipio,
                            text: municipio
                        }));
                    });
                    $("#municipio").val(function () {
                        return this.dataset.selection
                    });
                });
            }
        });
    }

    $('.date-picker').datepicker({
        autoclose: true,
        language: "es",
        todayBtn: "linked",
    });

    var today = new Date();
    today.setHours(0, 0, 0, 0);

    $('#install-date').datepicker('update', new Date(document.getElementById("install-date").dataset.value));

    $('#company').on("change", function () {
        socket.emit("getClients", $('#company').val().trim(), response => {
            if (!response.error) {
                $('#client').children().remove();

                $('#client').append($('<option>', {
                    value: "",
                    text: "Selecciona un cliente"
                }));

                response.clients.forEach(client => {
                    $('#client').append($('<option>', {
                        value: client.name,
                        text: client.name
                    }));
                });

                $('#client').append($('<option>', {
                    value: "new",
                    text: "Nuevo cliente"
                }));
            }
        });
    });

    $('#client').on("change", function () {
        if (this.value == "new") {
            if ($('#company').length) {
                if ($('#company').val()) {
                    $("#nuevo-cliente").modal("show");
                } else {
                    $.snackbar({
                        content: "Debes escoger una empresa"
                    })
                    $('#company').focus();
                    $('#client').val("");
                }
            } else {
                $("#nuevo-cliente").modal("show");
            }
        }
    });

    $('#country').on("change", function () {
        socket.emit("getStates", $('#country').val().trim(), states => {
            $('#estado').children().remove();
            $('#estado').append($('<option>', {
                value: '',
                text: 'Selecciona un estado'
            }));
            states.forEach(state => {
                $('#estado').append($('<option>', {
                    value: state,
                    text: state
                }));
            });
        });
    });

    $('#estado').on("change", function () {
        socket.emit("getMunicipios", {
            country: $('#country').val().trim(),
            state: $('#estado').val().trim()
        }, municipios => {
            $('#municipio').children().remove();
            municipios.forEach(municipio => {
                $('#municipio').append($('<option>', {
                    value: municipio,
                    text: municipio
                }));
            });
        });
    });

    $('#nuevo-cliente').on('shown.bs.modal', function (e) {
        $("#nuevo-cliente").find("#name").focus();
    });

    $('#nuevo-cliente').on('hidden.bs.modal', function (e) {
        $("#nuevo-cliente").find("#name").val("");
    });

    $("form").submit(function (event) {
        if (!alreadySubmitted) {
            $('#install-date').val($('#install-date').datepicker("getDate").getTime());
            alreadySubmitted = true;
            return;
        }
        event.preventDefault();
    });
});

function saveNewClient() {
    var client = {
        name: $("#nuevo-cliente").find("#name").val().trim(),
    }
    if ($('#company').length) {
        client.company = $("#company").val().trim();
    }

    socket.emit("newClient", client, response => {
        if (!response.error) {
            $('#client').append($('<option>', {
                value: client.name,
                text: client.name
            }));
            $('#client').val(client.name);
            $("#nuevo-cliente").modal('hide');
        } else {
            $.snackbar({
                content: response.message
            });
        }
    });
}


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
                    deviceList.remove("_id", id);
                }
            });
        }
    });
};
