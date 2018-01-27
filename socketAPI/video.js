var fs = require('fs');
var path = require("path");
var https = require("https");
var users = require("./user");
var config = require("../config");

var io = config.get('SocketIOServ');

var currentVideo = {
    id: null,
    user: "n/a",
    name: "none",
    src: "",
    isplaying: false,
    time: 0,
    lastUpdate: Date.now(),
    sub: ""
};

exports.play =  function (data) {
    var user;
    if ((user = users.searchUser(this.id)) != null) {
        currentVideo.isplaying = true;
        currentVideo.time = data.time;
        currentVideo.lastUpdate = Date.now();

        this.broadcast.emit("play", {time: data.time, user: user.name});
        return ;
    }
    this.emit("pseudoInvalide");
};

exports.pause = function (data) {
    var user;
    if ((user = users.searchUser(this.id)) != null) {
        currentVideo.isplaying = false;
        currentVideo.time = data.time;
        currentVideo.lastUpdate = Date.now();

        this.broadcast.emit("pause", {time: data.time, user: user.name});
        return ;
    }
    this.emit("pseudoInvalide");
};

exports.listMoviesFile = function() {
    var socket = this;
    fs.readdir(path.resolve(__dirname, "../", config.get('videoFolder')), function(err, items) {
        if (err)
            return console.log(err);
        socket.emit("videoClubList", {files: [].concat(items).filter(file => config.get('videoExt').indexOf(file.replace(/^.*\.([^.]*)$/gi, '$1').toLowerCase()) != -1)});
    });
};

exports.prepareVideo = prepareVideo;
function prepareVideo(src, username, func) {
    var vid = {user: username, src: src, sub: "", thumb: ""};

    if (vid.src.type == 'video/youtube') {
        var key = config.get("googleAPIKey");

        if (typeof key != "string" || key.length < 0) {
            vid.name = vid.src.src;
            return func(vid);
        }

        var id = vid.src.src.match(/(youtu.be\/|youtube.com\/(watch?(.*)?v=|(embed|v)\/))([^?&"'>]+)/);

        if (id == null || typeof id[5] == 'undefined' || id[5].length != 11)
            return func(null);

        https.get("https://www.googleapis.com/youtube/v3/videos?part=snippet&id="+id[5]+"&key="+config.get("googleAPIKey"), function(resp) {
            let data = "";

            resp.on("data", (chunk) => data += chunk);
            resp.on("end", function() {
                data = JSON.parse(data);

                vid.name = data.items[0].snippet.title;
                vid.thumb = data.items[0].snippet.thumbnails.medium.url;

                func(vid);
            });
            
        }).on("error", (err) => {
            console.log("error");
            vid.name = "none";
            func(vid);
        });
    }
    else {
        try {
            fs.accessSync(path.resolve(config.get("videoFolder"), vid.src.src.substring(7)), fs.constants.R_OK);
            vid.name = vid.src.src.replace(/^\/video\/(.*)\.[^.]*$/ig, '$1');

            try {
                fs.accessSync(path.resolve(config.get("subFolder"), vid.name + '.vtt'), fs.constants.R_OK);
                vid.sub = vid.name + '.vtt';
            } catch (err) {
                vid.sub = "";
            }

            try {
                fs.accessSync(path.resolve(config.get("thumbFolder"), vid.name + '.png'), fs.constants.R_OK);
                vid.thumb = vid.name + '.png';
            } catch (err) {
                vid.thumb = "";
            }
        } catch (e) {
            console.log("Here;", vid.src.src.substring(7));
            console.log(e);
            vid = null;
        }

        func(vid);
    }
}

exports.changeVideo = changeVideo;
function changeVideo(vid) {
    Object.assign(currentVideo, vid);
    currentVideo.isplaying = true;
    currentVideo.time = 0;
    currentVideo.lastUpdate = Date.now();
    currentVideo.ended = 0;

    io.emit("currentlyAiring", currentVideo);
}