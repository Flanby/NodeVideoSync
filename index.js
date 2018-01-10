var app = require('http').createServer(handler)
var io = require('socket.io')(app);
var fs = require('fs');
var path = require("path");
var router = require('./router');

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

router.add("GET", "/video", function(req, res) {
    var file = path.resolve(__dirname, "assets/Anime.mp4");

    fs.stat(file, function(err, stats) {
        if (err) {
            if (err.code === 'ENOENT') {
                // 404 Error if file not found
                return res.sendStatus(404);
            }
            res.end(err);
        }
        var range = req.headers.range;
        if (!range) {
            // 416 Wrong range
            return res.sendStatus(416);
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
            "Content-Type": "video/mp4"
        });

        var stream = fs.createReadStream(file, { start: start, end: end })
            .on("open", function() {
                stream.pipe(res);
            }).on("error", function(err) {
                res.end(err);
            });
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
var ready = [];

io.on('connection', function (socket) {
    socket.on('login', function (data) {
        if (data.pseudo.length > 60) {
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
    });

    socket.on('disconnect', function () {
        for (var i = 0; i < users.length; i++)
            if (users[i].socket.id == socket.id) {
                socket.broadcast.emit("userLeave", {name: users[i].name});

                var tmp = [];

                for (var y = users.length; i <= y; y--) {
                    if (y == i) {
                        tmp.pop();
                        users.concat(tmp.reverse());
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


    socket.on('ready', function (data) {
        ready++;
        console.log("Nombre de ready: "+ready);
    });

    socket.on('my other event', function (data) {
        console.log(data);
    });
});