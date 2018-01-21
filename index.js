var app = require('http').createServer(handler)
var io = require('socket.io')(app);
var fs = require('fs');
var path = require("path");
var router = require('./router');
var https = require("https");
var upload = require('./upload');

// Put This in conf file
var videoExt = ["ogg", "mp4", "webm"], // "avi", "mkv", 
    videoFolder = "assets/video/",
    subFolder = "assets/sub/",
    rootPass = "Test";

app.listen(3000);

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

upload.setDownloadDir(__dirname + "/assets/upload");
router.add("POST", "/upload/{tocken, type=str, length=16}", function(req, res) {
    upload.upload(req, res, function (rq, rs) {
        if (typeof rq.body["upload-file"] != "undefined") {
            res.writeHead(200);
            res.end("Succesfully upload \""+rq.body["upload-file"]+"\"");
        }
        else {
            res.writeHead(400);
            res.end('Upload Fails');
        }
    });
});

router.add("GET", "/video/{video, type=path}", function(req, res) {
    if (videoExt.indexOf(req.urlParams.video.replace(/^.*\.([^.]*)$/gi, '$1').toLowerCase()) == -1) {
        res.writeHead(404);
        return res.end();
    }

    var file = path.resolve(__dirname, videoFolder + req.urlParams.video);

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

router.add("GET", "/sub/{sub, type=path}", function(req, res) {
    fs.readFile(__dirname + "/" + subFolder + req.urlParams.sub, function (err, data) {
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

var users = [];
var playlist = [];
var idUnique = 1;

var currentVideo = {
    id: null,
    user: "n/a",
    name: "none",
    src: "",
    isplaying: false,
    time: 0,
    lastUpdate: Date.now(),
    playlistID: -1,
    sub: ""
};

var uploadToken = null;

io.on('connection', function (socket) {
    // upload
    socket.on("getUploadTocken", function (data) {
        if (typeof data.pass == "undefined") {
            return socket.emit("chatMsg", {msg: "<b>Sever:</b> Invalid request", color: 1});
        }
        
        function randStr(length) {
            var str = "";
            for (var i = 0; i < length; i++)
                str += Math.floor(Math.random() * 256).toString(16);
            return Buffer.from(str).toString('base64').substr(0, length);
        }

        if (data.pass == rootPass) {
            uploadToken = randStr(16);
            socket.emit("chatMsg", {msg: "<b>Sever:</b> new tocken is <b>" + uploadToken + "</b>", color: 1});
        }
        else 
            socket.emit("chatMsg", {msg: "<b>Sever:</b> Bad password", color: 1});
    });

    // user/chat
    socket.on('login', function (data) {
        if (typeof data.pseudo == "undefined" || data.pseudo == null || data.pseudo.length > 60) {
            socket.emit("pseudoInvalide");
            return ;
        }
        for (var i = 0; i < users.length; i++)
            if (users[i].name == data.pseudo && users[i].socket.id != socket.id) {
                socket.emit("pseudoInvalide");
                return ;
            }

        for (var i = 0; i < users.length; i++)
            if (users[i].socket.id == socket.id) {
                io.emit("changeName", {old: users[i].name, new: users[i].name = data.pseudo});
                return ;
            }
        users.push({"socket": socket, name: data.pseudo});
        io.emit("newUser", {name: data.pseudo});
        socket.emit("currentlyAiring", currentVideo);
    });

    socket.on('disconnect', function () {
        for (var i = 0; i < users.length; i++)
            if (users[i].socket.id == socket.id) {
                socket.broadcast.emit("userLeave", {name: users[i].name});

                var tmp = [];

                for (var y = users.length - 1; i <= y; y--) {
                    if (y == i) {
                        users.pop();
                        users = users.concat(tmp.reverse());
                        return;
                    }
                    else
                        tmp.push(users.pop());
                }
                return ;
            }
    });

    socket.on('chatMsg', function (data) {
        if (data.msg.length == 0)
            return;
        for (var i = 0; i < users.length; i++)
            if (users[i].socket.id == socket.id) {
                socket.broadcast.emit("chatMsg", {msg: "<b>"+users[i].name+":</b> "+data.msg});
                return ;
            }
        socket.emit("pseudoInvalide");
    });

    socket.on('listUsers', function () {
        var list = [];
        for (var i = 0; i < users.length; i++)
            list.push(users[i].name);
        socket.emit("userslist", {users: list});
    });

    // Video

    socket.on('play', function (data) {
        for (var i = 0; i < users.length; i++)
            if (users[i].socket.id == socket.id) {

                currentVideo.isplaying = true;
                currentVideo.time = data.time;
                currentVideo.lastUpdate = Date.now();

                socket.broadcast.emit("play", {time: data.time, user: users[i].name});
                return ;
            }
        socket.emit("pseudoInvalide");
    });
    
    socket.on('pause', function (data) {
        for (var i = 0; i < users.length; i++)
            if (users[i].socket.id == socket.id) {

                currentVideo.isplaying = false;
                currentVideo.time = data.time;
                currentVideo.lastUpdate = Date.now();

                socket.broadcast.emit("pause", {time: data.time, user: users[i].name});
                return ;
            }
        socket.emit("pseudoInvalide");
    });

    socket.on("videoClub", function() {
        fs.readdir(path.resolve(__dirname, videoFolder), function(err, items) {
            socket.emit("videoClubList", {files: [].concat(items).filter(file => videoExt.indexOf(file.replace(/^.*\.([^.]*)$/gi, '$1').toLowerCase()) != -1)});
        });
    });

    function prepareVideo(src, func) {
        var vid = {};

        for (var i = 0; i < users.length; i++)
            if (users[i].socket.id == socket.id) {

                vid.user = users[i].name;
                vid.src = src;
                vid.sub = "";

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
        socket.emit("pseudoInvalide");
        return null;
    }

    function changeVideo(vid) {
        Object.assign(currentVideo, vid);
        currentVideo.isplaying = true;
        currentVideo.time = 0;
        currentVideo.lastUpdate = Date.now();
        currentVideo.ended = 0;

        io.emit("currentlyAiring", currentVideo);
    }

    socket.on("changeVideo", function(data) {
        prepareVideo(data.src, changeVideo);
    });

    // Playlist

    socket.on("addToPlaylist", function(data) {
        prepareVideo(data.src, function(vid) {
            vid.id = idUnique++;
            playlist.push(vid);

            if (currentVideo.playlistID == -1)
                nextVid();
        });
    });

    socket.on("getPlaylist", function() {
        socket.emit("playlist", {playlist: playlist, offset: currentVideo.playlistID});
    });

    function nextVid() {
        currentVideo.playlistID++;
        if (currentVideo.playlistID >= playlist.length) {
            currentVideo.playlistID = playlist.length - 1
            return ;
        }

        changeVideo(playlist[currentVideo.playlistID]);
    }

    socket.on("playlistNext", nextVid);
    
    socket.on("playlistPrev", function() {
        currentVideo.playlistID--;
        if (currentVideo.playlistID < 0) {
            currentVideo.playlistID = 0;
            return ;
        }

        changeVideo(playlist[currentVideo.playlistID]);
    });

    socket.on("removeFromPlaylist", function(data) {
        for (var i = 0; i < playlist.length; i++)
            if (playlist[i].id == data.id) {
                var tmp = [];

                for (var y = playlist.length - 1; i <= y; y--) {
                    if (y == i) {
                        playlist.pop();
                        playlist = playlist.concat(tmp.reverse());
                        return;
                    }
                    else
                        tmp.push(playlist.pop());
                }
                return ;
            }
    });

    socket.on("playVideoPlaylist", function(data) {
        for (var i = 0; i < playlist.length; i++)
            if (playlist[i].id == data.id) {
                changeVideo(playlist[currentVideo.playlistID = i]);
                return ;
            }
    });

    // Video Ended

    socket.on("videoEnded", function() {
        currentVideo.ended++;

        if (currentVideo.ended >= users.length)
            nextVid();
    });
});