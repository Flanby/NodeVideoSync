var video;

window.onload = function() {
    var socket = io(document.location.origin),
        msgbox = document.getElementsByClassName("msgbox")[0],
        pseudo = "";

    document.getElementsByClassName("inputChat")[0].onkeypress = function(evt) {
        if (!evt.shiftKey && evt.key == "Enter") {
            if (this.value.length == 0)
                return false;
            var msg = this.value.replace(/([^>\r\n]?)(\r\n|\n\r|\r|\n)/g, '$1<br>$2');
            socket.emit('chatMsg', { "msg": msg });
            this.value = "";
            addMsg("<b>"+pseudo+":</b> "+msg);
            return false
        }
        return true;
    }
    
    function addMsg(msg, isInfo = 0) {
        var div = document.createElement('div');

        if (isInfo == 1)
            div.classList.add("info");
        if (isInfo == 2)
            div.classList.add("video-info");
        div.classList.add("msg");

        div.innerHTML = msg;

        var isDown = (msgbox.scrollTop == msgbox.scrollHeight - msgbox.offsetHeight);

        msgbox.appendChild(div);

        if (isDown)
            msgbox.scrollTop = msgbox.scrollHeight - msgbox.offsetHeight;
    }

    function randName(length = 8) {
        var str = "";
        for (var i = 0; i < length; i++)
            str += Math.floor(Math.random() * 256).toString(16);
        return btoa(str).substr(0, length);
    }

    // Chat/User

    socket.emit('login', { "pseudo": pseudo = prompt("Please enter your name", 'Flan '+randName())});

    socket.on("pseudoInvalide", function() {
        socket.emit('login', { "pseudo": pseudo = prompt("Please enter another name", 'Flan '+randName())});
    });
    
    socket.on('changeName', function (data) {
        addMsg("<b>"+data.old+"</b> is now known as <b>"+data.new+"</b>", 1);
    });
    
    socket.on('newUser', function (data) {
        addMsg("<b>"+data.name+"</b> is now online", 1);
    });

    socket.on('userLeave', function (data) {
        addMsg("<b>"+data.name+"</b> is now offline", 1);
    });
    
    socket.on('chatMsg', function (data) {
        addMsg(data.msg);
    });

    video = videojs(document.querySelector('.video-js'));

    video.ready(function() {
        socket.emit('ready');
    });

    // Video

    function timeConvertion(time) {
        var date = new Date(null);
        date.setTime(time * 1000);
        return date.toISOString().substr(11, 8);
    }

    function setVideoTime(time) {
        if (Math.abs(video.currentTime() - time) > 0.5)
            video.currentTime(time);
    }

    var receve = false;
    video.on('play', function play() {
        if (receve)
            return ;
        addMsg("<b>"+pseudo+"</b> play the video at "+timeConvertion(video.currentTime()), 2);
        socket.emit("play", {time: video.currentTime()});
    });

    socket.on("play", function(data) {
        receve = true;
        setVideoTime(data.time);
        video.play();
        addMsg("<b>"+data.user+"</b> play the video at "+timeConvertion(data.time), 2);
        window.setTimeout(function() { receve = false; }, 500)
    });

    video.on('pause', function () {
        if (receve)
            return ;
        addMsg("<b>"+pseudo+"</b> pause the video at "+timeConvertion(video.currentTime()), 2);
        socket.emit("pause", {time: video.currentTime()});
    });
    
    socket.on("pause", function(data) {
        receve = true;
        setVideoTime(data.time);
        video.pause();
        addMsg("<b>"+data.user+"</b> pause the video at "+timeConvertion(data.time), 2);
        window.setTimeout(function() { receve = false; }, 500)
    });

    socket.on("currentlyAiring", function(data) {
        receve = true;
        if (video.src().replace(/^.*3000(\/video.*)$/g, "$1") != data.src)
            video.src(data.src);
        if (data.isplaying) {
            setVideoTime(data.time + ((Date.now() - data.lastUpdate) / 1000));
            video.play();
        }
        else {
            setVideoTime(data.time);
            video.pause();
        }
        window.setTimeout(function() { receve = false; }, 500)
    });
}