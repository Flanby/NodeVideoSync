function fileDurationConverter(time = "") {
    if (time == null || time == "")
        return "";

    if (time.indexOf(":") != -1)
        return time.replace(/\.[^/.]+$/, "");

    time = parseInt(time);

    var str = "";
    while (time > 0) {
        var data = time % 60;
        str = ':' + data.toString().padStart(2, '0') + str;
        time = (time - data) / 60;
    }

    while (str.length < 8)
        str = ":00"+str;
    return str.substr(1);
}

var typeToIcon = {video: "video", audio: "headphones", subtitle: "closed-captioning"}
function getIcon(type) {
    if (typeof typeToIcon[type] == "undefined")
        return "fas fa-question";
    return "fas fa-" + typeToIcon[type];
}

var currentfile = {name: null, streams: null};
function getMovieList() {
    $.ajax("/admin/film/list", {headers: { authorization: "Bearer " + sessionStorage.getItem("adminToken") }}).done(function(data) {
        for (i in data)
            data[i].time = new Date(data[i].time);
        data.sort((a, b) => b.time - a.time);

        for (i in data) {
            var row = createElementOpt("tr");
            row.appendChild(createElementOpt("td"));
            row.lastChild.appendChild(document.createTextNode(data[i].file));
            row.appendChild(createElementOpt("td"));
            row.lastChild.appendChild(document.createTextNode(data[i].size));
            row.appendChild(createElementOpt("td"));
            var d = data[i].time;
            row.lastChild.appendChild(document.createTextNode(("0" + d.getDate()).slice(-2) + "/" + ("0" + (d.getMonth() + 1)).slice(-2) + "/" + d.getFullYear() + " " + ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2)));

            row.onclick = function () {
                currentfile.name = this.firstChild.innerText;
                $.ajax("/admin/convert/" + currentfile.name, {headers: { authorization: "Bearer " + sessionStorage.getItem("adminToken") }}).done(function(res) {
                    
                    $(".details h2").html(currentfile.name);
                    $(".streams-list").html("");
                    currentfile.streams = res;
                    for (i in currentfile.streams) {
                        var stream = createElementOpt("div", {className: "stream"});
                        stream.dataset.id = i;
                        stream.appendChild(createElementOpt("i", {className: getIcon(currentfile.streams[i].type)}));
                        stream.appendChild(createElementOpt("div", {className: "stream-details"}));
                        stream.lastChild.appendChild(createElementOpt("b"));
                        stream.lastChild.lastChild.appendChild(document.createTextNode("Id: " + i + (currentfile.streams[i].type == "audio" || currentfile.streams[i].type == "subtitle" ? " (" + currentfile.streams[i].langue + ")" : " - " + currentfile.streams[i].codec)));
                        stream.lastChild.appendChild(createElementOpt("br"));
                        stream.lastChild.appendChild(document.createTextNode(currentfile.streams[i].type == "video" ? fileDurationConverter(currentfile.streams[i].duration) : currentfile.streams[i].codec));

                        stream.onclick = function() {
                            this.classList.toggle("select");
                        }
                        
                        $(".streams-list").append(stream);
                    }
                }).fail(function() {
                    console.log("error");
                });
            }

            $(".movielist tbody").append(row);
        }
    }).fail(function() {
        console.log("error");
    });
}

var tbody;
function getConvertList() {
    tbody.clear();

    $.ajax("/admin/convert/list", {headers: { authorization: "Bearer " + sessionStorage.getItem("adminToken") }}).done(displayConvertList).fail(function(err) { console.log(err); });
}

function updateConvertRow(row, status) {
    if (typeof status == "string") {
        $(row).find(".progress-bar").addClass("progress-bar-animated");
        $(row).find(".progress-text").text(status);
    } else if (status == -1) {
        $(row).find(".progress-bar").removeClass("progress-bar-animated").addClass("bg-danger");
        $(row).find(".progress-bar").css("width", "100%");
        $(row).find(".progress-text").text("Fail");
    } else if (status == 100) {
        $(row).find(".progress-bar").removeClass("progress-bar-animated").addClass("bg-success");
        $(row).find(".progress-bar").css("width", "100%");
        $(row).find(".progress-text").text("100%");
    } else {
        $(row).find(".progress-bar").addClass("progress-bar-animated");
        $(row).find(".progress-bar").css("width", status + "%");
        $(row).find(".progress-text").text(Math.round(status) + "%");
    }
}

function addRow(rowData) {
    var str = rowData.input + ' [';

    for (i in rowData.streams)
        str += " " + rowData.streams[i].type + (rowData.streams[i].type != "video" ? ":" + rowData.streams[i].langue : "") + " |";

    var row = createDragableRowLoading(
        rowData.id, 
        tbody, 
        [
            document.createTextNode(str.replace(/\|$/, "]") + " "), 
            createElementOpt("br"), 
            createElementOpt("i", {className: "fas fa-magic"}), 
            document.createTextNode(" " + rowData.output)
    ]);
    updateConvertRow(row, rowData.status);
    tbody.appendChild(row);
}

function getSelectedStreams() {
    var streams = $(".stream.select"), ids = [];
    for (var i = 0; i < streams.length; i++)
        ids.push(streams[i].dataset.id);

    return ids;
}

function displayConvertList(list) {
    for (i in list)
        addRow(list[i]);
}

function keepRowsUpdated() {
    $.ajax("/admin/convert/ongoing", {type: "GET", headers: { authorization: "Bearer " + sessionStorage.getItem("adminToken") }})
    .done(function (data) {
        if (data != null) {
            updateConvertRow(document.getElementById("row-"+data.id), data.status);
            setTimeout(keepRowsUpdated, 1000);
        }
    })
    .fail(function(err) { console.log(err); });
}

$(function() {
    tbody = document.getElementsByClassName("dragable-n-loading")[0].getElementsByTagName("tbody")[0];

    $(".extract-all").click(function() {
        if (currentfile.name == null)
            return ;

        $.ajax("/admin/convert/" + currentfile.name + "/extract/all", {type: "POST", headers: { authorization: "Bearer " + sessionStorage.getItem("adminToken") }})
        .done(displayConvertList)
        .fail(function(err) { console.log(err); });
    });

    $(".extract").click(function() {
        if (currentfile.name == null)
            return ;

        $.ajax("/admin/convert/" + currentfile.name + "/extract", {
            type: "POST", 
            data: JSON.stringify({streams: getSelectedStreams()}), 
            headers: { 
                "content-type": "application/json", 
                authorization: "Bearer " + sessionStorage.getItem("adminToken") 
        }}).done(displayConvertList)
        .fail(function(err) { console.log(err); });
    });

    $(".gather-all").click(function() {
        if (currentfile.name == null)
            return ;

        $.ajax("/admin/convert/" + currentfile.name + "/gather/all", {type: "POST", headers: { authorization: "Bearer " + sessionStorage.getItem("adminToken") }})
        .done(displayConvertList)
        .fail(function(err) { console.log(err); });
    });

    $(".gather").click(function() {
        if (currentfile.name == null)
            return ;

        $.ajax("/admin/convert/" + currentfile.name + "/gather", {
            type: "POST", 
            data: JSON.stringify({streams: getSelectedStreams()}), 
            headers: { 
                "content-type": "application/json", 
                authorization: "Bearer " + sessionStorage.getItem("adminToken") 
        }}).done(displayConvertList)
        .fail(function(err) { console.log(err); });
    });

    $(".play-convert").click(function() {
        $.ajax("/admin/convert/start", {type: "PUT", headers: { authorization: "Bearer " + sessionStorage.getItem("adminToken") }})
        .done(function (data) { if (data != null) { updateConvertRow(document.getElementById("row-"+data.id), data.status); setTimeout(keepRowsUpdated, 1000); } })
        .fail(function(err) { console.log(err); });
    });

    $(".stop-convert").click(function() {
        $.ajax("/admin/convert/stop", {type: "PUT", headers: { authorization: "Bearer " + sessionStorage.getItem("adminToken") }})
        .done(() => console.log("stop"))
        .fail(function(err) { console.log(err); });
    });

    getMovieList();
    getConvertList();
});