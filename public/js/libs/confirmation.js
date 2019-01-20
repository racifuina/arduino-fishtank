function ezBSAlert(options) {

    var deferredObject = $.Deferred();

    var defaults = {
        type: "confirm",
        modalSize: 'modal-sm',
        okButtonText: 'Aceptar',
        cancelButtonText: 'Cancelar',
        yesButtonText: 'Si',
        fromModal: false,
        noButtonText: 'No',
        headerText: 'Atención',
        messageText: '',
        alertType: 'danger',
        inputFieldType: 'text',
    }

    $.extend(defaults, options);

    var _show = function () {
        var headClass = "";
        switch (defaults.alertType) {
            case "primary":
                headClass = "alert-primary";
                break;
            case "success":
                headClass = "alert-success";
                break;
            case "info":
                headClass = "alert-info";
                break;
            case "warning":
                headClass = "alert-warning";
                break;
            case "danger":
                headClass = "alert-danger";
                break;
        }

        $('BODY').append(
            '<div id="ezAlerts" class="modal fade">' +
            '<div class="modal-dialog" class="' + defaults.modalSize + '">' +
            '<div class="modal-content">' +
            '<div id="ezAlerts-header" class="modal-header ' + headClass + '">' +
            '<button id="close-button" type="button" class="close" data-dismiss="modal"><span aria-hidden="true">×</span><span class="sr-only">Close</span></button>' +
            '<h4 id="ezAlerts-title" class="modal-title">Modal title</h4>' +
            '</div>' +
            '<div id="ezAlerts-body" class="modal-body">' +
            '<div id="ezAlerts-message" ></div>' +
            '</div>' +
            '<div id="ezAlerts-footer" class="modal-footer">' +
            '</div>' +
            '</div>' +
            '</div>' +
            '</div>'
        );

        $('.modal-header').css({
            'padding': '15px 15px',
            '-webkit-border-top-left-radius': '5px',
            '-webkit-border-top-right-radius': '5px',
            '-moz-border-radius-topleft': '5px',
            '-moz-border-radius-topright': '5px',
            'border-top-left-radius': '5px',
            'border-top-right-radius': '5px'
        });

        $('#ezAlerts-title').text(defaults.headerText);
        $('#ezAlerts-message').html('<h4>' + defaults.messageText + '</h4>');

        var keyb = "false",
            backd = "static";
        var calbackParam = "";
        switch (defaults.type) {
            case 'alert':
                keyb = "true";
                backd = "true";
                $('#ezAlerts-footer').html('<button class="btn btn-' + defaults.alertType + '">' + defaults.okButtonText + '</button>').on('click', ".btn", function () {
                    calbackParam = true;
                    $('#ezAlerts').modal('hide');
                });
                break;
            case 'confirm':
                var btnhtml = '<button id="ezok-btn" class="btn btn-danger">' + defaults.yesButtonText + '</button>';
                if (defaults.noButtonText && defaults.noButtonText.length > 0) {
                    btnhtml += '<button id="ezclose-btn" class="btn btn-default">' + defaults.noButtonText + '</button>';
                }
                $('#ezAlerts-footer').html(btnhtml).on('click', 'button', function (e) {
                    if (e.target.id === 'ezok-btn') {
                        calbackParam = true;
                        $('#ezAlerts').modal('hide');
                    } else if (e.target.id === 'ezclose-btn') {
                        calbackParam = false;
                        $('#ezAlerts').modal('hide');
                    }
                });
                break;
            case 'edit':
                var btnhtml = '<button id="ezok-btn" class="btn btn-success">' + defaults.yesButtonText + '</button>';
                if (defaults.noButtonText && defaults.noButtonText.length > 0) {
                    btnhtml += '<button id="ezclose-btn" class="btn btn-default">' + defaults.noButtonText + '</button>';
                }
                $('#ezAlerts-footer').html(btnhtml).on('click', 'button', function (e) {
                    if (e.target.id === 'ezok-btn') {
                        calbackParam = true;
                        $('#ezAlerts').modal('hide');
                    } else if (e.target.id === 'ezclose-btn') {
                        calbackParam = false;
                        $('#ezAlerts').modal('hide');
                    }
                });
                break;

            case 'prompt':
                $('#ezAlerts-message').html(defaults.messageText + '<br /><br /><div class="form-group"><input type="' + defaults.inputFieldType + '" class="form-control" id="prompt" /></div>');
                $('#ezAlerts-footer').html('<button class="btn btn-primary">' + defaults.okButtonText + '</button>').on('click', ".btn", function () {
                    calbackParam = $('#prompt').val();
                    $('#ezAlerts').modal('hide');
                });
                break;
            case 'comment':
                let body = defaults.messageText + '<div class="floating-label-form-group floating-label-form-group-with-value"><label for="prompt">Título Corto (Max. 20 letras) [Obligatorio]</label><input type="form-control" class="form-control" id="prompt" maxlength="20"/></div><br><div id="comments"><label><small>Comentarios</small></label><input type="text" placeholder="Agrega un comentario" class="comment-input first-comment" onkeyup="newComment(event)"></div>';

                $('#ezAlerts-message').html(body);
                $('#ezAlerts-footer').html('<button class="btn btn-success">Guardar nota</button>').on('click', ".btn", function () {
                    var comments = [];
                    $('#ezAlerts-message').find("#comments").children().each(function (index, comment) {
                        if ($(comment).val().trim().length > 0) {
                            comments.push($(comment).val().trim())
                        }
                    });

                    calbackParam = {
                        title: $('#prompt').val(),
                        comments: comments
                    };
                    $('#ezAlerts').modal('hide');
                });

                break;

            case 'display-comments':

                socket.emit("getRecordById", defaults.record_id, data => {

                    var body = '<h3 style="color: darkorange; margin-top:0px;">Comentarios</h3><div id="comments">';

                    data.record.comments.forEach(comment => {

                        body += '<div class="comment"><label>' + comment.createdBy.displayName + ' <small style="color:gray;">' + moment(new Date(comment.createdAt)).tz('America/Guatemala').format("DD-MM-YYYY HH:mm") + '</small> '

                        if (comment.canDelete) {
                            body += '<a role="button" onclick="deleteComment(this)" data-record_id=' + defaults.record_id + ' data-comment-id=' + comment._id + '><i class="fa fa-trash-o hover-red" aria-hidden="true"></i></a>'
                        }
                        body += '</label><p>' + comment.message + '</p><hr></div>';
                    });

                    body += '</div>';

                    if (data.addComments) {
                        body += '<div id="new-comments"><input data-record_id=' + defaults.record_id + ' type="text" placeholder="Agrega un comentario" class="comment-input first-comment" onkeyup="pushComment(event, this)" autofocus></div>';
                    }

                    $('#ezAlerts-message').html(body);

                    let footer = '<button id="ezclose-btn" class="btn btn-default">Cerrar</button>'

                    $('#ezAlerts-footer').html(footer).on('click', "button", function (e) {
                        $('#ezAlerts').modal('hide');
                    });
                });
                break;
        }

        $('#ezAlerts').modal({
            show: false,
            backdrop: backd,
            keyboard: keyb
        }).on('hidden.bs.modal', function (e) {
            $('#ezAlerts').remove();
            if (defaults.fromModal) {
                $('body').addClass("modal-open");
            }
            deferredObject.resolve(calbackParam);
        }).on('shown.bs.modal', function (e) {
            if ($('#prompt').length > 0) {
                $('#prompt').focus();
            }
        }).modal('show');
    }

    _show();
    return deferredObject.promise();
}

function deleteComment(object) {
    console.log(object.dataset)
    let info = {
        note_id: object.dataset.record_id,
        comment_id: object.dataset.commentId
    };
    socket.emit("deleteComment", info, callbackData => {
        if (!callbackData.error) {
            if ($($(object)[0].parentNode.parentNode).hasClass("comment")) {
                $(object)[0].parentNode.parentNode.remove();
            } else {
                $(object)[0].parentNode.parentNode.remove();
            }
        }
    });
}

function pushComment(e, object) {
    if (e.keyCode == 13 && $('#ezAlerts').find(".comment-input").val()) {
        let info = {
            id: $(object).data("record_id"),
            comment: $(object).val()
        };
        socket.emit("pushComment", info, callbackData => {
            if (!callbackData.error) {
                let newComment = '<div class="comment"><label>' + callbackData.comment.createdBy.displayName + ' <small style="color:gray;">' + moment(new Date()).tz('America/Guatemala').format("DD-MM-YYYY HH:mm") + '</small> <a role="button" onclick="deleteComment(this)" data-record_id=' + $(object).data("record_id") + ' data-commentid=' + callbackData.comment._id + '><i class="fa fa-trash-o hover-red" aria-hidden="true"></i></a></label><p>' + $(object).val() + '</p><hr></div>'

                $("#ezAlerts").find("#comments").append(newComment);
                $(object).val("");
            }
        });
    }
}

function onKeyUpInputs(e) {
    if (e.keyCode == 13 && $('#ezAlerts').find(".comment-input").val()) {
        $('#ezAlerts').find("#comments").append('<div class="new-comment"><label>' + $('#current-user-display-name').text().trim() + ' <small style="color:gray;">' + moment(new Date()).tz('America/Guatemala').format("DD-MM-YYYY HH:mm") + '</small> <a role="button" onclick="deleteComment(this)"><i class="fa fa-trash-o hover-red" aria-hidden="true"></i></a></label><p class="message">' + $('#ezAlerts').find(".comment-input").val().trim() + '</p><hr></div>')
        $('#ezAlerts').find(".comment-input").val("");
    }
}

function newComment(e) {
    if (e.keyCode == 13) {
        var nuevoRow = $('<input type="text" placeholder="Agrega un comentario" class="comment-input" onkeyup="newComment(event)">');
        $(e.currentTarget).after(nuevoRow);
        nuevoRow.focus()
    }
    if (e.keyCode == 38) {
        $(e.currentTarget).prev().focus();
    }
    if (e.keyCode == 40) {
        $(e.currentTarget).next().focus();
    }
    if (e.keyCode == 8) {
        if ($(e.currentTarget).val().length < 1) {
            if (!$(e.currentTarget).hasClass("first-comment")) {
                $(e.currentTarget).prev().focus()
                $(e.currentTarget).remove()
            }

        }
    }
}
