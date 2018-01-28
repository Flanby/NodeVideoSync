var app = require('http').createServer(handler)
var io = require('socket.io')(app);
var fs = require('fs');
var path = require("path");
var router = require('./router');
var upload = require('./upload');

var config = require("./config");
config.load(__dirname + '/config.json');

app.listen(3000);

// Front page
router.add("GET", "/", function (req, res) {
    fs.readFile(__dirname + '/index.html',
    function (err, data) {
      if (err) {
        res.writeHead(500);
        return res.end('Error loading index.html');
      }

      res.writeHead(200);
      res.end(data);
    });
});

// Expose all ressources
router.add("GET", "/public/{file, type=path}", function(req, res) {
    fs.readFile(__dirname + '/assets/' + req.urlParams.file, function (err, data) {
        if (err) {
            res.writeHead(403);
            return res.end();
        }

        res.writeHead(200);
        res.end(data);
    });
});

// Upload file
router.add("POST", "/upload/{token, type=str, length=16}", function(req, res) {
    if (req.urlParams.token != uploadToken) {
        req.pause();
        res.writeHead(401);
        res.end("Bad Token");
        return ;
    }

    uploadToken = null;
    upload.upload(req, res, function (rq, rs) {
        if (typeof rq.body["upload-file"] != "undefined") {
            fs.rename(path.resolve(config.get("downloadFolder"), rq.body["upload-file"]), path.resolve(__dirname, config.get("videoFolder"), rq.body["upload-file"]), function(err) {
                if (err) {
                    console.log(err);
                    res.writeHead(500);
                    res.end("Succesfully upload \""+rq.body["upload-file"]+"\", but fail server");
                    return ;
                }

                res.writeHead(200);
                //res.write("Succesfully upload \""+rq.body["upload-file"]+"\"");

                if (upload.createVideoThumbnail(rq.body["upload-file"]))
                    res.end("OK");
                else
                    res.end("FAIL");
            });
        }
        else {
            res.writeHead(400);
            res.end('Upload Fail');
        }
    });
});

// Expose video
router.add("GET", "/video/{video, type=path}", function(req, res) {
if (config.get("videoExt").indexOf(req.urlParams.video.replace(/^.*\.([^.]*)$/gi, '$1').toLowerCase()) == -1) {
        res.writeHead(404);
        return res.end();
    }

    var file = path.resolve(__dirname, config.get("videoFolder") + req.urlParams.video);

    fs.stat(file, function(err, stats) {
        if (err) {
            if (err.code === 'ENOENT') {
                // 404 Error if file not found
                res.writeHead(404);
                return res.end();
            }
            res.end(err);
        }
        var range = req.headers.range;
        if (!range) {
            // 416 Wrong range
            return res.writeHead(416);
        }
        var positions = range.replace(/bytes=/, "").split("-");
        var start = parseInt(positions[0], 10);
        var total = stats.size;
        var end = positions[1] ? parseInt(positions[1], 10) : total - 1;
        var chunksize = (end - start) + 1;

        res.writeHead(206, {
            "Content-Range": "bytes " + start + "-" + end + "/" + total,
            "Accept-Ranges": "bytes",
            "Content-Length": chunksize,
            "Content-Type": "video/"+req.urlParams.video.replace(/^.*\.([^.]*)$/gi, '$1').toLowerCase()
        });

        var stream = fs.createReadStream(file, { start: start, end: end })
            .on("open", function() {
                stream.pipe(res);
            }).on("error", function(err) {
                res.end(err);
            });
        });
});

// Expose subtitle
router.add("GET", "/sub/{sub, type=path}", function(req, res) {
    fs.readFile(__dirname + "/" + config.get("subFolder") + req.urlParams.sub, function (err, data) {
        if (err || req.urlParams.sub.replace(/^.*\.([^.]*)$/gi, '$1').toLowerCase() != "vtt") {
            res.writeHead(404);
            return res.end();
        }

        res.writeHead(200);
        res.end(data);
    });
});

function handler (req, res) {
    try {
        router.exec(req, res);
    } catch (e) {
        res.writeHead(500, {'Content-Type': 'text/plain'});
        console.log(e);
        res.end("Internal Error");
    }
}

var uploadToken = null;

config.set('SocketIOServ', io);
var user = require("./socketAPI/user");
var video = require("./socketAPI/video");
var playlist = require("./socketAPI/playlist");

io.on('connection', function (socket) {
    // upload

    socket.on("getUploadToken", function (data) {
        if (typeof data.pass == "undefined") {
            return socket.emit("chatMsg", {msg: "<b>Sever:</b> Invalid request", color: 1});
        }

        function randStr(length) {
            var str = "";
            for (var i = 0; i < length; i++)
                str += Math.floor(Math.random() * 256).toString(16);
            return Buffer.from(str).toString('base64').substr(0, length);
        }

        if (data.pass == config.get("rootPass")) {
            uploadToken = randStr(16);
            socket.emit("chatMsg", {msg: "<b>Sever:</b> new token is <b>" + uploadToken + "</b>", color: 1});
        }
        else
            socket.emit("chatMsg", {msg: "<b>Sever:</b> Bad password", color: 1});
    });

    // user/chat

    socket.on('login', user.login);
    socket.on('disconnect', user.logout);
    socket.on('chatMsg', user.chatMsg);
    socket.on('listUsers', user.listUser);

    // Video

    socket.on('play', video.play);
    socket.on('pause', video.pause);
    socket.on("videoClub", video.listMoviesFile);
    socket.on("currentVideo", video.getCurrentVideo);

    // Playlist

    socket.on("addToPlaylist", playlist.add);
    socket.on("getPlaylist", playlist.get);
    socket.on("playlistNext", playlist.next);
    socket.on("playlistPrev", playlist.prev);
    socket.on("removeFromPlaylist", playlist.remove);
    socket.on("playVideoPlaylist", playlist.playVideo);

    // Video Ended

    socket.on("videoEnded", playlist.videoEnd);
});
