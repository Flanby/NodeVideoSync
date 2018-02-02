var users = require("./user");
var video = require("./video");
var config = require("../config");

var playlist = [];
var idUnique = 1;
var actualvid = -1;
var videoEnded = 0;

function changeVideo(vid) {
    videoEnded = 0;
    video.changeVideo(vid);
}

exports.get = function() {
    if (0 > actualvid || actualvid >= playlist.length)
        actualvid = -1;
    this.emit("playlist", {playlist: playlist, offset: (actualvid == -1 ? -1 : playlist[actualvid].id)});
};

exports.add = function(data) {
    var u = users.searchUser(this.id), self = this;
    if (u == null)
        return ;
    video.prepareVideo(data.src, u.name, function(vid) {
        if (vid == null)
            return;
        vid.id = idUnique++;
        playlist.push(vid);

        self.emit("playlistAdd", vid);
        self.broadcast.emit("playlistAdd", vid);

        if (actualvid == -1)
            nextVid();
    });
};

exports.remove = function(data) {
    for (var i = 0; i < playlist.length; i++)
        if (playlist[i].id == data.id) {
            var tmp = [];

            for (var y = playlist.length - 1; i < y; y--)
                tmp.push(playlist.pop());

            var id = playlist.pop().id;
            playlist = playlist.concat(tmp.reverse());

            this.emit("playlistRm", {id: id});
            this.broadcast.emit("playlistRm", {id: id});

            if (i == actualvid) {
                if (i == playlist.length)
                    prevVid();
                else {
                    actualvid--;
                    nextVid();
                }
            }
            return ;
        }
};

exports.next = nextVid;
function nextVid() {
    actualvid++;
    if (actualvid >= playlist.length) {
        actualvid = playlist.length - 1
        return ;
    }
    if (actualvid < 0)
        actualvid = 0;

    changeVideo(playlist[actualvid]);
}
    
exports.prev = prevVid;
function prevVid() {
    actualvid--;
    if (actualvid < 0) {
        actualvid = 0;
        return ;
    }
    if (actualvid >= playlist.length)
        actualvid = playlist.length - 1

    changeVideo(playlist[actualvid]);
}

exports.playVideo = function(data) {
    for (var i = 0; i < playlist.length; i++)
        if (playlist[i].id == data.id) {
            changeVideo(playlist[actualvid = i]);
            return ;
        }
};

exports.videoEnd = function() {
    videoEnded++;

    if (videoEnded >= users.nbUsers())
        nextVid();
};