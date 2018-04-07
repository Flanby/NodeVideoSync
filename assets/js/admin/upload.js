var input = null;
function add_file_to_upload() {
    if (input != null)
        return input.click();

    var id;
    while (document.getElementById("input-" + (id = randName())) != null);
    input = createElementOpt("input", {type: "file", id: "input-" + id, name: "upload-file", onchange: function() {
        if (this.value.length != 0) {
            if (this.value.match(/\.(mp4|ogg|webm|avi|mkv)$/i) == null)
                return alert("Wrong File");
        }
        else
            return ;

        var row = createDragableRowLoading(id, document.getElementsByTagName("tbody")[0], this.value.substring((this.value.indexOf('\\') >= 0 ? this.value.lastIndexOf('\\') : this.value.lastIndexOf('/')) + 1));
        row.children[1].appendChild(input);

        input = null;
        $("tbody").append(row);
    }});

    input.click();
}

var uploading = false, execQueue = false;
function start_upload() {
    execQueue = true;

    if (uploading)
        return ;

    var tbody = document.getElementsByTagName("tbody")[0];
    
    for (var i = 0; i < tbody.childNodes.length; i++) {
        var row = tbody.childNodes[i], text = row.getElementsByClassName("progress-text")[0];

        if (text.innerText == "Queued") {
            var bar = row.getElementsByClassName("progress-bar")[0],
                form = createElementOpt("form", {enctype:"multipart/form-data", method:"post"});
                form.appendChild(row.getElementsByTagName("input")[0]);
            
            $.ajax({
                // Your server script to process the upload
                url: '/upload/' + sessionStorage.getItem("adminToken"),
                type: 'POST',
        
                // Form data
                data: new FormData(form),
        
                // Tell jQuery not to process data or worry about content-type
                // You *must* include these options!
                cache: false,
                contentType: false,
                processData: false,
    
                beforeSend: function (xhr) {
                    uploading = true;
                },
        
                // Custom XMLHttpRequest
                xhr: function() {
                    var myXhr = $.ajaxSettings.xhr();
                    if (myXhr.upload) {
                        // For handling the progress of the upload
                        myXhr.upload.addEventListener('progress', function(e) {
                            if (e.lengthComputable) {
                                var percent = e.loaded * 100 / e.total;
                                $(bar).css("width", percent + "%");
                                text.innerText = Math.round(percent) + "%";
                            }
                        } , false);
                    }
                    return myXhr;
                },
            }).done(function( data, textStatus, jqXHR ) {
                $(bar).removeClass("progress-bar-animated");
    
                if (jqXHR.status == 200 && data == "OK")
                    $(bar).addClass("bg-success");
                else if (jqXHR.status == 200 && data == "FAIL")
                    $(bar).addClass("bg-warning");   
                else
                    $(bar).addClass("bg-danger");
            }).fail(function() {
                $(bar).removeClass("progress-bar-animated");
                $(bar).addClass("bg-danger");
            }).always(function () {
                uploading = false;
                
                if (execQueue)
                    start_upload();
            });

            break;
        }
    }
}



$(function() {
    $(".add-upload").click(add_file_to_upload);
    $(".play-upload").click(start_upload);
    $(".stop-upload").click(() => execQueue = false);
});