var fs = require("fs");

exports.upload = function(req, res) {
    var buffData = Buffer.from([]),
        meta = {__cnt: 0},
        contentType = req.headers["content-type"].split(";"), 
        boundary = null,
        regexpInput = null,
        stream = null,
        lineEnding = null,
        endReached = false;

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
    
    // Create File Steam
    function createFileStream(filename, chunk = null, callback = null) {
        if (stream == null) {
            stream = fs.createWriteStream(__dirname + "/assets/upload/" + filename);
            stream.once('open', function(fd) {
                // stream.addListener("drain", function() {
                //     if (callback != null)
                //         callback();
                //     req.resume();
                // });
                stream.addListener("finish", function() {
                    receiveData();
                });
                stream.addListener("error", function(err) {
                    console.debug("Got error while writing to file '" + filename + "': ", err);
                    res.writeHead(500, {'Content-Type': 'text/plain'});
                    res.end("Internal Error");
                    req.connection.destroy();
                });

                if (chunk != null)
                    // wait the next chunk to check for croped boundary before adding it to the file
                    stream.write(chunk, "binary", function() {
                        if (callback != null)
                            callback();
                        req.resume();
                    });
                else {
                    req.resume();
                }
            });
        }
        else {
            if (chunk != null) {
                stream.write(chunk, "binary", function() {
                    if (callback != null)
                        callback();
                    req.resume();
                });
            }
            else {
                req.resume();
            }
        }
    }

    // Receive Data Chunk
    function receiveData(chunk = Buffer.from([])) {
        var pos = -1;
        console.log("Receive: ",chunk.length);

        var guardrail = 0;
        do {
            if (guardrail++ == 20) return ; // Prevent infinite loop
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
                        req.body[meta.name] = meta.filename;
                        stream.end();
                        stream = null;
                    }
                    else
                        req.body[meta.name] = meta.__data;
                }
                else if (meta.__cnt != 0)
                    console.log("Input not valid: ", meta);
                console.log(meta);
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
                        if (meta.__cnt == 0 && line[0].match(/\s*Content-Disposition: *form-data/i) == null)
                            console.log("Not 'form-data' : "+line[0]);
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
                            
                            // if boundary not found write nothing wait the next chunk
                            if (pos == -1)
                                createFileStream(meta.filename);
                            // else chunck the data
                            else {
                                chunk = Buffer.from(buffData.slice(0, pos - lineEnding.length));
                                buffData = Buffer.from(buffData.slice(pos));

                                createFileStream(meta.filename, chunk, function() {
                                    receiveData();
                                });
                            }
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
            if (buffData.length == 0 && chunk.length == 0) {
                console.log("Ends on:", req.body);
            }
        }
    }

    req.on('data', receiveData);
    req.on('end', function() {
        endReached = true;
    });
};