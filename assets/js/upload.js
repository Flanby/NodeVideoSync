var uploading = false;
$(function() {
    $('#upload').on('show.bs.modal', function (e) {
        if (uploading)
            return;
        $(".select-file .btn").removeClass("btn-success btn-primary btn-danger bg-warning").addClass("btn-primary");
        $(".select-file .btn").html("Browse...");
        $("#upload form input[type=file]").val("");
    })

    $(".select-file").click(function() {
        if (uploading)
            return;
        $("#upload form input[type=file]").click();
    });

    $("#upload form input[type=file]").on('change', function(){
        if ($(this).val().length != 0) {
            if ($(this).val().match(/\.(mp4|ogg|webm|avi|mkv)$/i) == null)
                $(".select-file .btn").removeClass("btn-success btn-primary btn-danger").addClass("btn-danger");
            else
                $(".select-file .btn").removeClass("btn-success btn-primary btn-danger").addClass("btn-success");
            $(".select-file .btn").html($(this).val().substring(($(this).val().indexOf('\\') >= 0 ? $(this).val().lastIndexOf('\\') : $(this).val().lastIndexOf('/')) + 1));
        }
    });

    $("#upload .modal-footer .btn-success").click(function() {
        if (uploading)
            return;

        if ($("#upload form input[name=token]").val().length != 16) {
            return ;
        }
        if ($("#upload form input[type=file]").val().length == 0 || $("#upload form input[type=file]").val().match(/\.(mp4|ogg|webm|avi|mkv)$/i) == null) {
            return ;
        }

        $.ajax({
            // Your server script to process the upload
            url: '/upload/'+$("#upload form input[name=token]").val(),
            type: 'POST',
    
            // Form data
            data: new FormData($("#upload form")[0]),
    
            // Tell jQuery not to process data or worry about content-type
            // You *must* include these options!
            cache: false,
            contentType: false,
            processData: false,

            beforeSend: function (xhr) {
                uploading = true;
                $("#upload .progress-bar").removeClass("bg-success bg-danger").addClass("progress-bar-animated");
                $(".select-file .btn").removeClass("btn-success btn-primary btn-danger");
            },
    
            // Custom XMLHttpRequest
            xhr: function() {
                var myXhr = $.ajaxSettings.xhr();
                if (myXhr.upload) {
                    // For handling the progress of the upload
                    myXhr.upload.addEventListener('progress', function(e) {
                        if (e.lengthComputable) {
                            var percent = Math.round(e.loaded * 100 / e.total)
                            $("#upload .progress-bar").attr("aria-valuenow", percent);
                            $("#upload .progress-bar").css("width", percent + "%");
                        }
                    } , false);
                }
                return myXhr;
            },
        }).done(function( data, textStatus, jqXHR ) {
            $("#upload .progress-bar").removeClass("progress-bar-animated");

            if (jqXHR.status == 200 && data == "OK")
                $("#upload .progress-bar").addClass("bg-success");
            else if (jqXHR.status == 200 && data == "FAIL")
                $("#upload .progress-bar").addClass("bg-warning");   
            else
                $("#upload .progress-bar").addClass("bg-danger");
        }).fail(function() {
            $("#upload .progress-bar").removeClass("progress-bar-animated");
            $("#upload .progress-bar").addClass("bg-danger");
        }).always(function () {
            uploading = false;
        });
    });
});