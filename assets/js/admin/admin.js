Element.prototype.clear = function(){while (this.firstChild) {this.removeChild(this.firstChild);}}

function setLoader() {
    $(".main-content").html('<div class="center"><i class="fas fa-football-ball loader"></i></div>');
}

function setError() {
    $(".main-content").html('<div class="center"><h1 class="errorAjax"><i class="fas fa-cogs"></i> Erreur <i class="fas fa-quidditch"></i></h1></div>');
}

function randName(length = 8) {
    var str = "";
    for (var i = 0; i < length; i++)
        str += Math.floor(Math.random() * 256).toString(16);
    return btoa(str).substr(0, length);
}

function createElementOpt(tag, option = {}) {
    return Object.assign(document.createElement(tag), option);
}

function createDragableRowLoading(id, tbody, text, onMove, onDelete) {
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
            //var tbody = document.getElementsByTagName("tbody")[0],
            var movedRow = document.getElementById(e.dataTransfer.getData("data"));
                
            if (movedRow != null) {
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

                if (onMove != null)
                    for (var i = 0; i < tbody.childNodes.length; i++)
                        if (tbody.childNodes[i].id == movedRow.id) {
                            onMove(i, movedRow.id);
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

    if (typeof text == "string")
        row.lastChild.appendChild(document.createTextNode(text));
    else if (text instanceof Array)
        for (i in text)
            row.lastChild.appendChild(text[i]);
    else if (text instanceof Node)
        row.lastChild.appendChild(text);
    else
        row.lastChild.innerHTML = text;

    row.appendChild(createElementOpt("td"))
    row.lastChild.appendChild(createElementOpt("div", {className: "progress file-upload"}));
    row.lastChild.lastChild.appendChild(createElementOpt("div", {
        className: "progress-bar progress-bar-striped progress-bar-animated", 
        role: "progressbar"
    }));
    row.lastChild.lastChild.appendChild(createElementOpt("div", {className: "progress-text"}));
    row.lastChild.lastChild.lastChild.appendChild(document.createTextNode("Queued"));

    row.appendChild(createElementOpt("td"))
    row.lastChild.appendChild(createElementOpt("i", {className: "fas fa-times remove-row", onclick: function() {
        if (onDelete != null && !onDelete())
            return ;
        var rowToDelete = this.parentElement.parentElement;
        rowToDelete.remove()
    }}));

    return row;
}

var token = "";
$(function() {
    $(".sideMenu li a").click(function (e) {
        e.preventDefault();
        setLoader();
        
        $.ajax(this.href, {headers: { authorization: "Bearer " + sessionStorage.getItem("adminToken") }}).done(function(data) {
            $(".main-content").html(data);
        }).fail(function() {
            setError();
        });

        return false;
    })
});