$(function() {
    $("#upload .modal-footer .btn-success").click(function() {
        if ($("#upload form input[name=tocken]").val().length != 16) {
            return ;
        }
        if ($("#upload form input[type=file]").val().length == 0) {
            return ;
        }

        $.ajax({
            // Your server script to process the upload
            url: '/upload/'+$("#upload form input[name=tocken]").val(),
            type: 'POST',
    
            // Form data
            data: new FormData($("#upload form")[0]),
    
            // Tell jQuery not to process data or worry about content-type
            // You *must* include these options!
            cache: false,
            contentType: false,
            processData: false,
    
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
                            $("#upload .progress-bar").html(percent + " %");
                        }
                    } , false);
                }
                return myXhr;
            },
        });
    });
});