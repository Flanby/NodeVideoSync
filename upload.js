var fs = require("fs");

exports.upload = function(req, res) {
    var bodyData = '';
    req.body = {};
    
    req.on('data', function (data) {
        bodyData += data;
        
        if(bodyData.length > 1e6) {
            bodyData = "";
            res.writeHead(413, {'Content-Type': 'text/plain'});
            res.end();
            req.connection.destroy();
        }
    });

    req.on('end', function () {
        // req.body = querystring.parse(bodyData);
        
        try {
            //console.log(req.headers["content-type"]);

            var contentType = req.headers["content-type"].split(";"), boundary = null;

            if (contentType[0] != "multipart/form-data") {
                res.writeHead(400, {'Content-Type': 'text/plain'});
                res.end();
                return;
            }

            for (var i = 1; i < contentType.length; i++) {
                if ((boundary = contentType[i].match(/boundary=(\S*)/i)) != null)
                    break;
            }
            boundary = boundary[1];
            
            var datas = bodyData.split("--" + boundary),
                regexpInput = null;
            for (var j = 0; j < datas.length; j++) {
                if (datas[j].length == 0)
                    continue;
                if (regexpInput == null) {
                    var lineEnding = datas[j].match(/^([\r\n]+)/i)[0];
                    regexpInput = new RegExp('^'+lineEnding+'([^\r\n]+)('+lineEnding+'.+)?'+lineEnding+''+lineEnding+'([^]*)'+lineEnding+'$', 'i');
                }

                var data = datas[j],
                    meta = {};



                data = regexpInput.exec(data);//data.match(/^[\r\n]{1,2}([^\r\n]+)[\r\n]{1,2}(.*)[\r\n]{1,2}([^]*[^\r\n])[\r\n]{1,2}$/i);
                if (data == null || data.length != 4) {
                    console.log("Erreur here / ", data);
                    continue;
                }

                var line = data[1].split(";");
                if (line[0].match(/\s*Content-Disposition: *form-data/i) == null)
                    console.log("Not 'form-data' : "+line[0]);
                for (var i = 1; i < line.length; i++) {
                    if ((line[i] = line[i].match(/^\s*([^=\s]+)="?([^"]+)"?\s*$/i)) == null)
                        continue;
                    meta[line[i][1]] = line[i][2];
                }

                if (typeof meta.name == "undefined") {
                    console.log("name not found");
                    continue;
                }

                if (typeof meta.filename != "undefined") {
                    req.body[meta.name] = meta.filename;

                    var filecontent = data[3], stream = fs.createWriteStream(__dirname + "/assets/upload/" + meta.filename);
                    stream.once('open', function(fd) {
                      stream.write(new Buffer(filecontent));
                        console.log("First char: ", filecontent[0], ", code: ", filecontent.charCodeAt(0));
                      stream.end();
                    });
                }
                else {
                    req.body[meta.name] = data[3];
                }
            }

            console.log(req.body);
            res.writeHead(200, {"Content-Type": "text/plain"});
            res.end("bodyData");
        } catch (e) {
            res.writeHead(500, {'Content-Type': 'text/plain'});
            console.log(e);
            res.end("Internal Error");
        }
    });
}

// function parse_multipart(req) {
//     var parser = multipart.parser();

//     parser.headers = req.headers;

//     req.addListener("data", function(chunk) {
//         parser.write(chunk);
//     });

//     req.addListener("end", function() {
//         parser.close();
//     });

//     return parser;
// }

// exports.upload = function(req, res) {
//     //req.setBodyEncoding("binary");

//     var stream = parse_multipart(req),
//         fileName = null,
//         fileStream = null;

//     stream.onPartBegin = function(part) {
//         console.debug("Started part, name = " + part.name + ", filename = " + part.filename);

//         fileName = __dirname + "/assets/video/" + stream.part.filename;
//         fileStream = fs.createWriteStream(fileName);

//         fileStream.addListener("error", function(err) {
//             console.debug("Got error while writing to file '" + fileName + "': ", err);
//         });

//         fileStream.addListener("drain", function() {
//             req.resume();
//         });
//     };

//     stream.onData = function(chunk) {
//         req.pause();
//         //console.debug("Writing chunk");
//         fileStream.write(chunk, "binary");
//     };

//     stream.onEnd = function() {
//         fileStream.addListener("drain", function() {
//             fileStream.end();
            
//             res.sendHeader(200, {"Content-Type": "text/plain"});
//             res.write("Thanks for playing!");
//             res.end();
//         });
//     };
// };