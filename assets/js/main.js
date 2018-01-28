var video, socket, msgbox, pseudo;

window.onresize = function() {
    document.querySelector(".autoResize").onclick();
};

window.onload = function() {
    socket = io(document.location.origin);
    msgbox = document.getElementsByClassName("msgbox")[0];
    pseudo = "";
    video = videojs(document.querySelector('.video-js'));
    video.SidePlaylist();

    // Chat Commands
    var cmds = {
        "/help": {func: displayHelp, params: [], description: "Display this help"},
        "/name": {path: "login", params: ["pseudo"], description: "Change pseudo"},
        "/getUploadToken": {path: "getUploadToken", params: ["pass"], description: "Get the upload token"}
    }

    function displayHelp() {
        var help = "<b>System:</b> Help:<br>";

        for (var cmd in cmds) {
            help += " - "+cmd+" ";

            for (var i = 0; i < cmds[cmd].params.length; i++)
                help += "[" + cmds[cmd].params[i] + "] ";

            help += ": " + cmds[cmd].description+"<br>"
        }

        addMsg(help.substring(0, help.length - 4), 1);
    }

    // Chat Input
    document.getElementsByClassName("inputChat")[0].onkeypress = function(evt) {
        if (!evt.shiftKey && evt.key == "Enter") {
            if (this.value.length == 0)
                return false;

            if (this.value.match(/^\/[a-z\-_0-9]+/i)) {
                var parser = this.value.replace(/ +/g, " ").replace(/ +$/, "").split(" ");

                if (typeof cmds[parser[0]] != "undefined") {
                    if (cmds[parser[0]].params.length + 1 == parser.length) {
                        this.value = "";
                        var data = {}

                        for (var i = 0; i < cmds[parser[0]].params.length; i++)
                            data[cmds[parser[0]].params[i]] = parser[i + 1];

                        if (typeof cmds[parser[0]].func != "undefined")
                            cmds[parser[0]].func(data);
                        else
                            socket.emit(cmds[parser[0]].path, data);
                    }
                    else
                        addMsg("<b>System:</b> Invalid argument", 1);
                }
                else
                    addMsg("<b>System:</b> Invalid command, try /help", 1);
            }
            else {
                var msg = this.value.replace(/([^>\r\n]?)(\r\n|\n\r|\r|\n)/g, '$1<br>$2');
                socket.emit('chatMsg', { "msg": msg });
                this.value = "";
                addMsg("<b>"+pseudo+":</b> "+msg);
            }
            return false
        }
        return true;
    }
    
    // Chat Display (0 = white, 1 = pink, 2 = blue, 3 = green)
    function addMsg(msg, isInfo = 0) {
        var div = document.createElement('div');

        if (isInfo == 1)
            div.classList.add("info");
        if (isInfo == 2)
            div.classList.add("video-info");
        if (isInfo == 3)
            div.classList.add("video-title");
        div.classList.add("msg");

        div.innerHTML = "["+new Date().toLocaleTimeString()/*.toISOString().substr(11, 12)*/+"] "+msg;

        var isDown = (msgbox.scrollTop == msgbox.scrollHeight - msgbox.offsetHeight);

        msgbox.appendChild(div);

        if (isDown)
            msgbox.scrollTop = msgbox.scrollHeight - msgbox.offsetHeight;
    }

    // Generate Random strings
    function randName(length = 8) {
        var str = "";
        for (var i = 0; i < length; i++)
            str += Math.floor(Math.random() * 256).toString(16);
        return btoa(str).substr(0, length);
    }

    // Chat/User

    socket.emit('login', { "pseudo": pseudo = prompt("Please enter your name", 'Flan '+randName())});
    socket.emit("listUsers");

    socket.on("pseudoInvalide", function() {
        socket.emit('login', { "pseudo": pseudo = prompt("Please enter another name", 'Flan '+randName())});
        socket.emit("listUsers");
    });
    
    socket.on('changeName', function (data) {
        addMsg("<b>"+data.old+"</b> is now known as <b>"+data.new+"</b>", 1);
        
        if (pseudo == data.old)
            data.new;

        var list = document.querySelector(".usersList");
        for (var i = 0; list.childElementCount > i; i++)
            if (list.children[i].innerHTML == data.old) {
                list.children[i].innerHTML = data.new;
                break;
            }
    });
    
    socket.on('newUser', function (data) {
        addMsg("<b>"+data.name+"</b> is now online", 1);

        var li = document.createElement('li');
        li.innerHTML = data.name;

        document.querySelector(".usersList").appendChild(li);
    });

    socket.on('userLeave', function (data) {
        addMsg("<b>"+data.name+"</b> is now offline", 1);

        var list = document.querySelector(".usersList");
        for (var i = 0; list.childElementCount > i; i++)
            if (list.children[i].innerHTML == data.name) {
                list.removeChild(list.children[i]);
                break;
            }
    });
    
    socket.on('chatMsg', function (data) {
        addMsg(data.msg, (typeof data.color == "undefined" ? 0 : data.color));
    });

    socket.on("userslist", function(data) {
        var li = null, id = -1, list = document.querySelector(".usersList");
        list.innerHTML = "";
        
        if (pseudo != "") {
            li = document.createElement('li');
            li.innerHTML = pseudo;
            li.classList.add = "self";
            id = data.users.findIndex(function(a) { return a == pseudo });

            if (id == -1)
                li.classList.add = "offline";
            list.appendChild(li);
        }

        for (var i = 0; i < data.users.length; i++) {
            if (i == id)
                continue;
            li = document.createElement('li');
            li.innerHTML = data.users[i];

            list.appendChild(li);
        }
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
        if (receve || video.currentTime() >= video.duration())
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
        if (data.src.length == 0)
            return ;
        receve = true;

        var tracks = video.textTracks().tracks_;
        
        for (var i = 0; i < tracks.length; i++)
            video.removeRemoteTextTrack(tracks[i]);

        var newvidstr = typeof data.src == "string" ? data.src : data.src.src;
        if (typeof video.src() == "undefined" || 
            (typeof video.src() == "object" && video.src().src != newvidstr) || 
            (typeof video.src() == "string" && video.src().replace(/^.*3000(\/video.*)$/g, "$1") != data.src))
            video.src(data.src);
        if (data.isplaying) {
            setVideoTime(data.time + ((Date.now() - data.lastUpdate) / 1000));
            video.play();
        }
        else {
            setVideoTime(data.time);
            video.pause();
        }
        if (data.sub != "")
            video.addRemoteTextTrack({src: "/sub/" + data.sub, srclang: "fr", mode: 'showing', default: true}, false)

        addMsg("Current video <b>"+data.name+"</b> added by <b>"+data.user+"</b> at <b>"+timeConvertion(video.currentTime())+"</b>", 3);
        window.setTimeout(function() { receve = false; }, 500)
    });

    // Option 

    document.querySelector("form.size").onsubmit = function() {
        video.width(this.querySelector("input.w").value);
        video.height(this.querySelector("input.h").value);
        return false;
    };

    document.querySelector(".autoResize").onclick = function() {
        document.querySelector("input.w").value = window.innerWidth;
        document.querySelector("form.size").onsubmit();
    };

    document.querySelector(".autoResize").onclick();

    // Video Club

    document.querySelector("button.btn.btn-primary.changeVideo").onclick = function() {
        socket.emit("videoClub");
    }

    document.querySelector("button.validateYT").onclick = function() {
        socket.emit("addToPlaylist", {src: {src: document.querySelector("input.inputYT").value, type: 'video/youtube'}});
        //socket.emit("changeVideo", {src: document.querySelector("input.inputYT").value});
        $('#videoClubYT').modal('hide');
        document.querySelector("input.inputYT").value = "";
    }

    socket.on("videoClubList", function(data) {
        var box = document.querySelector("#videoClub .modal-body");
        box.innerHTML = "";

        for (var i = 0; i < data.files.length; i++) {
            var div = document.createElement('div');
            div.classList.add("choice");
            div.innerHTML = data.files[i];
            div.onclick = function() {
                socket.emit("addToPlaylist", {src: {src: "/video/"+this.innerHTML, type: 'video/'+this.innerHTML.replace(/^.*\.([^.]*)$/gi, '$1').toLowerCase()}});
                $('#videoClub').modal('hide');
            }
            box.appendChild(div);
        }

        $('#videoClub').modal('show');
    });

    // Playlist

    document.querySelector("button.playN").onclick = function() {
        socket.emit("playlistNext");
    }

    document.querySelector("button.playP").onclick = function() {
        socket.emit("playlistPrev");
    }

    socket.on("playlist", function(data) {
        video.SidePlaylist.setPlaylist(data);
    });

    // Video Ended

    video.on("ended", function() {
        receve = true; 
        socket.emit("videoEnded");
        window.setTimeout(function() { receve = false; }, 500)
    });
}