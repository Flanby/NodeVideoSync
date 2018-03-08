function randName(length = 8) {
    var str = "";
    for (var i = 0; i < length; i++)
        str += Math.floor(Math.random() * 256).toString(16);
    return btoa(str).substr(0, length);
}

function createElementOpt(tag, option = {}) {
    return Object.assign(document.createElement(tag), option);
}

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

        var row = createElementOpt("tr", {
            id: "row-"+id, 
            draggable: true, 
            ondragstart: function(e) {
                e.dataTransfer.setData("data", e.target.id);
            },
            ondragover: function(e) {
                e.preventDefault();
                if (this.offsetHeight / 2 > e.offsetY)
                    $(this).removeClass("drag-on-top drag-on-bottom").addClass("drag-on-top");
                else
                    $(this).removeClass("drag-on-top drag-on-bottom").addClass("drag-on-bottom");
            },
            ondragleave: function (e) {
                $(this).removeClass("drag-on-top drag-on-bottom");
            },
            ondrop: function(e) {
                var tbody = document.getElementsByTagName("tbody")[0],
                    movedRow = document.getElementById(e.dataTransfer.getData("data"));
                    
                if (movedRow != null)
                    if (this.classList.contains("drag-on-top"))
                        tbody.insertBefore(movedRow, this);
                    else {
                        for (var i = 0; i < tbody.childNodes.length; i++)
                            if (tbody.childNodes[i].id == this.id) {
                                if (i + 1 < tbody.childNodes.length)
                                    tbody.insertBefore(movedRow, tbody.childNodes[i + 1]);
                                else
                                    tbody.appendChild(movedRow);
                                break;
                            }
                    }

                $(this).removeClass("drag-on-top drag-on-bottom");
            },
            ondragend: function() {
                $(".drag-on-top, .drag-on-bottom").removeClass("drag-on-top drag-on-bottom");
            }
        });

        row.appendChild(createElementOpt("td"))
        row.lastChild.appendChild(createElementOpt("i", {className: "fas fa-ellipsis-v"}));

        row.appendChild(createElementOpt("td"));
        row.lastChild.appendChild(document.createTextNode(this.value.substring((this.value.indexOf('\\') >= 0 ? this.value.lastIndexOf('\\') : this.value.lastIndexOf('/')) + 1)));
        row.lastChild.appendChild(input);

        row.appendChild(createElementOpt("td"))
        row.lastChild.appendChild(createElementOpt("div", {className: "progress file-upload"}));
        row.lastChild.lastChild.appendChild(createElementOpt("div", {
            className: "progress-bar progress-bar-striped progress-bar-animated", 
            role: "progressbar", 
            // "aria-valuenow": 0, 
            // "aria-valuemin": 0, 
            // "aria-valuemax": 100
        }));
        row.lastChild.lastChild.appendChild(createElementOpt("div", {className: "progress-text"}));
        row.lastChild.lastChild.lastChild.appendChild(document.createTextNode("Queued"));

        row.appendChild(createElementOpt("td"))
        row.lastChild.appendChild(createElementOpt("i", {className: "fas fa-times remove-file", onclick: function() {
            var rowToDelete = this.parentElement.parentElement;
            rowToDelete.remove()
        }}));

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
                url: '/upload/' + window.location.pathname.substr(7, 16),
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