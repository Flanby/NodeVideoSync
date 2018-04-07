var fs = require('fs');
var path = require("path");
var child = require("child_process");
var router = require('./router');
var upload = require('./upload');

var config = require("./config");

function addSecuredRoute(type, path, callback) {
    router.add(type, path, function(req, res) {
        var token = config.get("adminToken");

        if (typeof token == "string" && token.length > 6 && req.headers.authorization == "Bearer " + token)
            callback(req, res);
        else {
            res.writeHead(401);
            res.end("Bad Token");
        }
    });
}

// Admin page
router.add("GET", "/admin/", function (req, res) {
    fs.readFile(__dirname + '/template/admin.html',
    function (err, data) {
      if (err) {
        res.writeHead(500);
        return res.end('Error loading admin.html');
      }

      res.writeHead(200);
      res.end(data);
    });
});

// Partial Admin page
addSecuredRoute("GET", "/admin/{page}", function (req, res) {
    fs.readFile(__dirname + '/template/partial/admin/' + req.urlParams.page,
        function (err, data) {
            if (err) {
                res.writeHead(404);
                return res.end(req.urlParams.page + ' not found');
            }

            res.writeHead(200);
            res.end(data);
        });
});

function autoFormatFilesize(fileSize) {
    if (fileSize > 1073741824) // 1024^3
        return (fileSize / 1073741824.0).toPrecision(3) + " Go";
    else if (fileSize > 1048576) // 1024^2
        return (fileSize / 1048576.0).toPrecision(3) + " Mo";
    else if (fileSize > 1024)
        return (fileSize / 1024.0).toPrecision(3) + " ko";
    return fileSize + " o"
}

addSecuredRoute("GET", "/admin/film/list", function (req, res) {
    fs.readdir(path.resolve(__dirname, config.get('videoFolder')), function(err, items) {
        if (err)
            return console.log(err);
        var list = [];

        for (file in items) {
            file = items[file];

            try {
                var stat = fs.statSync(path.resolve(config.get('videoFolder'), file));
                list.push({file: file, size: autoFormatFilesize(stat.size), time: stat.birthtime});
            }
            catch (e) {
                list.push({file: file, size: "0 o", time: 0});
            }
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(list));
    });
});

function extractFromStream(stream, index) {
    var tmp = stream.match(new RegExp(index+"=(.*)"));

    if (tmp == null || tmp.lenght < 2)
        return null;
    return tmp[1];
}

function parseStreams(res) {
    var stream, endstream, result = {};
    while ((stream = res.indexOf("[STREAM]")) != -1) {
        if ((endstream = res.indexOf("[/STREAM]")) != -1) {

            stream = res.slice(stream + 8, endstream);
            res = res.slice(endstream + 9);

            var index = extractFromStream(stream, "index");
            if (index == null)
                continue;

            result[index] = {type: extractFromStream(stream, "codec_type"), codec: extractFromStream(stream, "codec_long_name")};

            if (result[index].type == "video") {
                var duration = stream.match(/TAG:DURATION=(.*)/);

                if (duration != null && duration[1] != "N/A")
                    duration = duration[1];
                else
                    duration = extractFromStream(stream, "duration");

                result[index].duration = duration;
            }
            else if (result[index].type == "audio" || result[index].type == "subtitle")
                result[index].langue = extractFromStream(stream, "TAG:language");
        }
    }

    return result;
}

var fileAlreadyFFprobe = {};
addSecuredRoute("GET", "/admin/convert/{movie, type=path}", function (req, res) {
    var movie = path.resolve(__dirname, config.get('videoFolder'), req.urlParams.movie);

    fs.stat(movie, function (err, stat) {
        if (err) {
            res.writeHead(404);
            res.end("");
        }

        if (typeof fileAlreadyFFprobe[req.urlParams.movie] != "undefined" && stat.mtimeMs == fileAlreadyFFprobe[req.urlParams.movie].time) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(fileAlreadyFFprobe[req.urlParams.movie].data);
            return;
        }

        try {
            var result = child.execSync(config.get("pathToffprobe") + " -v error -show_streams -show_format '" + movie + "'").toString();

            fileAlreadyFFprobe[req.urlParams.movie] = {time: stat.mtimeMs, streams: parseStreams(result)};
            fileAlreadyFFprobe[req.urlParams.movie].data = JSON.stringify(fileAlreadyFFprobe[req.urlParams.movie].streams);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(fileAlreadyFFprobe[req.urlParams.movie].data);
        }
        catch (e) {
            res.writeHead(500);
            res.end("");
        }
    });
});

var listToConvert = [];
function genUniqueId(length = 16) {
    var str = "";
    for (var i = 0; i < length; i++)
        str += Math.floor(Math.random() * 256).toString(16);
    str = Buffer.from(str).toString('base64').substr(0, length);

    for (i in listToConvert)
        if (listToConvert[i].id == str)
            return genUniqueId(length);
    return str;
}

function formatConvert(list) {
    var ret = [];
    
    for (i in list) {
        ret.push(Object.assign({}, list[i]));

        ret[i].input = path.basename(ret[i].input);
        ret[i].output = path.basename(ret[i].output);

        var streams = ret[i].streams;
        ret[i].streams = [];
        for (s in streams)
            ret[i].streams[s] = fileAlreadyFFprobe[ret[i].input].streams[streams[s]];
    }

    return ret;
}

function buildExtracts(streams, movie) {
    var ret = [], ts = {
        video: {f: config.get('videoFolder'), ext: ".mp4"}, 
        audio: {f: config.get('audioFolder'), ext: ".mp3"}, 
        subtitle: {f: config.get('subFolder'), ext: ".vtt"}
    };

    for (i in streams) {
        if (typeof ts[fileAlreadyFFprobe[movie].streams[streams[i]].type] == "undefined")
            continue;
        var id = listToConvert.push({
            id: genUniqueId(), 
            input: path.resolve(__dirname, config.get('videoFolder'), movie), 
            streams: [streams[i]], 
            output: path.resolve(
                __dirname, 
                ts[fileAlreadyFFprobe[movie].streams[streams[i]].type].f, 
                movie.replace(/\.[^.]+$/, "") + ts[fileAlreadyFFprobe[movie].streams[streams[i]].type].ext
            ),
            status: 0
        });
        ret.push(listToConvert[id - 1]);
    }

    return ret;
}

addSecuredRoute("POST", "/admin/convert/{movie, type=path}/extract/all", function (req, res) {
    if (typeof fileAlreadyFFprobe[req.urlParams.movie] == "undefined") { // || fileAlreadyFFprobe[req.urlParams.movie].data.length < 20) {
        res.writeHead(409);
        res.end("Not Stat Before");
        return ;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(formatConvert(buildExtracts(Object.keys(fileAlreadyFFprobe[req.urlParams.movie].streams), req.urlParams.movie))));
});

addSecuredRoute("POST", "/admin/convert/{movie, type=path}/extract", function (req, res) {
    if (typeof fileAlreadyFFprobe[req.urlParams.movie] == "undefined") { // || fileAlreadyFFprobe[req.urlParams.movie].data.length < 20) {
        res.writeHead(409);
        res.end("Not Stat Before");
        return ;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(formatConvert(buildExtracts(req.body.streams, req.urlParams.movie))));
});

function buildGathers(streams, movie) {
    var ret = [], validStreams = []; ts = {
        video: {f: config.get('videoFolder'), ext: ".mp4"}, 
        audio: {f: config.get('audioFolder'), ext: ".mp3"}, 
        subtitle: {f: config.get('subFolder'), ext: ".vtt"}
    };

    var type = null, isok = true;
    for (i in streams) {
        if (typeof ts[fileAlreadyFFprobe[movie].streams[streams[i]].type] == "undefined")
            continue;

        if (type == null || fileAlreadyFFprobe[movie].streams[streams[i]].type == "video")
            type = fileAlreadyFFprobe[movie].streams[streams[i]].type;

        if (type != fileAlreadyFFprobe[movie].streams[streams[i]].type)
            isok = false;

        validStreams.push(streams[i]);
    }

    if (!isok && type != "video")
        return [];

    var id = listToConvert.push({
        id: genUniqueId(), 
        input: path.resolve(__dirname, config.get('videoFolder'), movie), 
        streams: validStreams, 
        output: path.resolve(__dirname, ts[type].f, movie.replace(/\.[^.]+$/, "") + ts[type].ext),
        status: 0
    });
    ret.push(listToConvert[id - 1]);

    return ret;
}

addSecuredRoute("POST", "/admin/convert/{movie, type=path}/gather/all", function (req, res) {
    if (typeof fileAlreadyFFprobe[req.urlParams.movie] == "undefined") { // || fileAlreadyFFprobe[req.urlParams.movie].data.length < 20) {
        res.writeHead(409);
        res.end("Not Stat Before");
        return ;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(formatConvert(buildGathers(Object.keys(fileAlreadyFFprobe[req.urlParams.movie].streams), req.urlParams.movie))));
});

addSecuredRoute("POST", "/admin/convert/{movie, type=path}/gather", function (req, res) {
    if (typeof fileAlreadyFFprobe[req.urlParams.movie] == "undefined") { // || fileAlreadyFFprobe[req.urlParams.movie].data.length < 20) {
        res.writeHead(409);
        res.end("Not Stat Before");
        return ;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(formatConvert(buildGathers(req.body.streams, req.urlParams.movie))));
});

function convertTimeToSec(time) {
    var sec = 0.0, row = 1.0, last;

    while ((last = time.lastIndexOf(":")) != -1) {
        sec += time.substr(last + 1) * row;

        row *= 60.0;
        time = time.substr(0, last);
    }
    sec += time * row;

    return sec;
}

var converter = {
    ongoing: false,
    converting: null,
    exec: null,

    start: function () {
        this.ongoing = true;
        this.convert();
    },
    
    stop: function () {
        this.ongoing = false;
    },

    convert: function() {
        if (this.exec != null)
            return false;

        for (i in listToConvert) {
            if (listToConvert[i].status == 0) {
                this.converting = listToConvert[i];
                var duration = upload.getMovieDuration(path.basename(listToConvert[i].input));

                if (duration != null)
                    duration = duration.toString() * 1.0;
                else
                    listToConvert[i].status = "In Progress";

                var args = ["-threads", "8",  "-i", listToConvert[i].input];
                for (j in listToConvert[i].streams) {
                    args.push("-map");
                    args.push("0:" + listToConvert[i].streams[j]);
                }
                args.push(listToConvert[i].output);

                this.exec = child.spawn(config.get("pathToffmpeg"), args);
                this.exec.stderr.on('data', function (data) {
                    var res = null;

                    if (data.includes("already exists. Overwrite ? [y/N]"))
                        converter.exec.stdin.write("n\n");
                    else if (listToConvert[i].status != "In Progress" && (res = data.toString().match(/size=.+time=.*(\d{2}:\d{2}:\d{2}\.\d{2,}).*bitrate=.*speed=.*/)) != null)
                        listToConvert[i].status = convertTimeToSec(res[1]) * 100.0 / duration;
                });
                
                this.exec.on('exit', function (code) {
                    if (code == 0)
                        listToConvert[i].status = 100;
                    else
                        listToConvert[i].status = -1;
                    
                    converter.exec = converter.converting = null;

                    if (converter.ongoing)
                        converter.convert();
                });
                return true;
            }
        }

        this.ongoing = false;
        return true;
    },

    getOngoing: function() {
        if (this.converting == null)
            return null;
        return {id: this.converting.id, status: this.converting.status};
    }
};

addSecuredRoute("PUT", "/admin/convert/start", function(req, res) {
    converter.start();
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(converter.getOngoing()));
});

addSecuredRoute("PUT", "/admin/convert/stop", function(req, res) {
    converter.stop();

    res.writeHead(200);
    res.end();
});

addSecuredRoute("GET", "/admin/convert/ongoing", function(req, res) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(converter.getOngoing()));
});

addSecuredRoute("GET", "/admin/convert/list", function (req, res) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(formatConvert(listToConvert)));
});