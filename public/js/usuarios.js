var deviceList;
var socket = io();

$(document).ready(function () {
    var options = {
        valueNames: ['name', 'userType', 'company', 'email', {
            data: ['_id']
    }, ]
    };

    deviceList = new List('users', options);

    if ($("#message").length)  {
        $("#message").snackbar("show");
    }

    $('[data-toggle="tooltip"]').tooltip();
});

function eliminarUsuario(id) {
    ezBSAlert({
        type: "confirm",
        messageText: "¿Seguro desea eliminar el usuario?",
        alertType: "danger",
    }).done(function (confirmacion) {
        if (confirmacion) {
            socket.emit("deleteUserById", id, function (data) {
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
