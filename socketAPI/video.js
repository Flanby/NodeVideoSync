var fs = require('fs');
var path = require("path");
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
    var vid = {user: username, src: src, sub: ""};

    if (vid.src.type == 'video/youtube') {
        https.get(vid.src.src, function(resp) {
            let data = '';
            
            // A chunk of data has been recieved.
            resp.on('data', (chunk) => {
                if (data == -1)
                    return;
                data = (chunk+'').match(/<title>(.*) - YouTube<\/title>/gm);
                if (data != null) {
                    vid.name = (""+data).replace(/<title>(.*) - YouTube<\/title>/g, '$1');
                    func(vid);
                    data = -1;
                }
            });
        }).on("error", (err) => {
            vid.name = "none";
            func(vid);
        });
    }
    else {
        vid.name = vid.src.src.replace(/^\/video\/(.*)\.[^.]*$/ig, '$1');
        try {
            fs.accessSync(__dirname + "/" + subFolder + vid.name + '.vtt', fs.constants.R_OK);
            vid.sub = vid.name + '.vtt';
        } catch (err) {
            vid.sub = "";
        }
        func(vid);
    }
    return vid;
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