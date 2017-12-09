var app = require('http').createServer(handler)
var io = require('socket.io')(app);
var fs = require('fs');
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

function handler (req, res) {
    try {
        router.exec(req, res);
    } catch (e) {
        res.writeHead(500, {'Content-Type': 'text/plain'});
        console.log(e);
        res.end("Internal Error");
    }
}

io.on('connection', function (socket) {
  socket.emit('news', { hello: 'world' });
  socket.on('my other event', function (data) {
    console.log(data);
  });
});