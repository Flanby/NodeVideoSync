var fs = require("fs");
var child = require("child_process");
var config = require("./config");
var path = require("path");

exports.getMovieDuration = getMovieDuration;
function getMovieDuration(file) {
    try {
        return child.execSync(config.get("pathToffprobe") + " -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 '" + path.resolve(__dirname, config.get("videoFolder"), file) + "'");
    } catch (e) {
        //console.log("Duration:", e.output[2].toString());
        return null;
    }
}

exports.createVideoThumbnail = function (file) {
    var duration = getMovieDuration(file);
    if (duration == null)
        return false;

    try {
        child.execSync(config.get("pathToffmpeg") + " -i '" + path.resolve(__dirname, config.get("videoFolder"), file) + "' -ss " +
                       Math.floor(duration / 3600).toString().padStart(2, '0') + ":" + Math.floor(duration / 60 % 60).toString().padStart(2, '0') + ":" + Math.floor(duration % 60).toString().padStart(2, '0') + "." + (duration * 1000 % 1000).toString().padStart(3, '0') +
                       " -vframes 1 '" + path.resolve(__dirname, config.get("thumbFolder"), file.replace(new RegExp("(" + config.get("videoExt").join("|") + ")$", 'i'), 'jpg')) + "'");
    } catch (e) {
        console.log("Thumbnail:", e);
        return false;
    }
    return true;
}

exports.upload = function(req, res, masterCallback) {
    var buffData = Buffer.from([]),
        meta = {__cnt: 0},
        contentType = req.headers["content-type"].split(";"), 
        boundary = null,
        regexpInput = null,
        stream = null,
        lineEnding = null,
        endReached = false,
        files = [];

    req.body = {};
    
    // Check content-type header
    if (contentType[0] != "multipart/form-data") {
        res.writeHead(400, {'Content-Type': 'text/plain'});
        res.end();
        req.connection.destroy();
        return;
    }

    // Extract boundary
    for (var i = 1; i < contentType.length; i++) {
        if ((boundary = contentType[i].match(/boundary=(\S*)/i)) != null)
            break;
    }
    if (boundary == null) {
        res.writeHead(400, {'Content-Type': 'text/plain'});
        res.end();
        req.connection.destroy();
        return;
    }
    boundary = "--" + boundary[1];
    
    // Create/Write File Steam
    function createFileStream(filename, chunk = null, callback = null) {
        if (stream == null) {
            stream = fs.createWriteStream(path.resolve(__dirname, config.get("downloadFolder"), filename));
            stream.once('open', function(fd) {
                stream.addListener("error", function(err) {
                    // Trow Error ?
                    console.debug("Got error while writing to file '" + filename + "': ", err);
                    res.writeHead(500, {'Content-Type': 'text/plain'});
                    res.end("Internal Error");
                    req.connection.destroy();
                });

                stream.write(chunk, "binary", function() {
                    if (callback != null)
                        callback();
                    req.resume();
                });
            });
        }
        else {
            stream.write(chunk, "binary", function() {
                if (callback != null)
                    callback();
                req.resume();
            });
        }
    }

    // Receive Data Chunk
    function receiveData(chunk = Buffer.from([])) {
        var pos = -1;

        var guardrail = 0;
        do {
            if (guardrail++ == 20) { // Prevent infinite loop on bad request // Todo: replace this with error detection
                req.abort();
                res.writeHead(400);
                return res.end();
            } 
            pos = Buffer.concat([buffData, chunk], buffData.length + chunk.length).indexOf(boundary);
            // if the actual data is a file and boundary not found append buff to file
            if (pos == -1 && meta.__cnt == 2 && typeof meta.filename != "undefined") {
                if (chunk.length == 0)
                    return ;

                req.pause();
                createFileStream(meta.filename, buffData, function() {
                    buffData = chunk;
                });

                break ;
            }

            // if chunk not empty concat chunck
            if (chunk.length != 0) {
                buffData = Buffer.concat([buffData, chunk], buffData.length + chunk.length);
                chunk = Buffer.from([]);
            }

            // if boundary fisrt, shift it and restart the loop and the meta
            if (pos == 0) {
                buffData = Buffer.from(buffData.slice(boundary.length));
                if (typeof meta.name != "undefined") {
                    if (typeof meta.filename != "undefined") {
                        files.push(req.body[meta.name] = meta.filename);
                        stream.end();
                        stream = null;
                    }
                    else
                        req.body[meta.name] = meta.__data;
                }
                else if (meta.__cnt != 0)
                    console.log("Input not valid: ", meta);
                
                meta = {__cnt: 0};
                continue;
            }

            // if line ending not define
            if (lineEnding == null)
                lineEnding = ("" + buffData).match(/^([\r\n]+)/i)[0];

            var linePos;
            while ((linePos = buffData.indexOf(lineEnding)) != -1 && (linePos < pos || pos == -1)) {

                if (linePos == 0) {
                    // if there was an empty line, data is empty
                    if (meta.__cnt == 2) {
                        if (pos == -1)
                            return ;
                        meta.__data = "";
                    }
                    else
                        meta.__cnt++;
                }
                else {
                    // if not empty line before then it's meta data
                    if (meta.__cnt <= 1) {
                        var line = (buffData.slice(0, linePos) + "").split(";");
                        if (meta.__cnt == 0 && line[0].match(/\s*Content-Disposition: *form-data/i) == null && line[0] != "--") {
                            req.pause();
                            return onFail();
                        }
                        for (var i = 1; i < line.length; i++) {
                            if ((line[i] = line[i].match(/^\s*([^=\s]+)="?([^"]+)"?\s*$/i)) == null)
                                continue;
                            meta[line[i][1]] = line[i][2];
                        }

                        meta.__cnt = 1;
                    }
                    else {
                        if (pos == -1)
                            return ;

                        if (typeof meta.filename != "undefined") {
                            req.pause();

                            chunk = Buffer.from(buffData.slice(0, pos - lineEnding.length));
                            buffData = Buffer.from(buffData.slice(pos));

                            createFileStream(meta.filename, chunk, function() {
                                receiveData();
                            });
                            return ;
                        }
                        else {
                            meta.__data = "" + buffData.slice(0, pos - lineEnding.length);
                        }
                    }
                }

                buffData = Buffer.from(buffData.slice(linePos + lineEnding.length));
                if (pos != -1)
                    pos -= linePos + lineEnding.length;
            }
        } while (pos != -1);

        if (endReached) {
            if (buffData.length == 0 && chunk.length == 0)
                onDone(); // Ok
            else {
                onFail();
            }
        }
    }

    // Remove all receve Data and File
    function onFail() {
        if (stream != null)
            stream.end("", "binary", function() {
                stream = null;
                onFail();
            });
        else {
            for (var i = 0; i < files.length; i++)
                fs.unlink(path.resolve(__dirname, config.get("downloadFolder"), files[i]), () => {});
            if (typeof meta.filename != "undefined")
                fs.unlink(path.resolve(__dirname, config.get("downloadFolder"), meta.filename), () => {});
            req.body = {};
            masterCallback(req, res);
        }
    }

    // Add parameter to keep or delete receive file at the end ?
    function onDone() {
        masterCallback(req, res);
    }

    req.on('data', receiveData);

    req.on('end', function() {
        endReached = true;
        if (buffData.length == 0)
            onDone();
    });
    
    req.on('abort', function() {
        if (!endReached)
            onFail();
    });
    
    req.on('close', function() {
        if (!endReached)
            onFail();
    });

    
};