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
    
    function addMsg(msg, isInfo = false) {
        var div = document.createElement('div');

        if (isInfo)
            div.classList.add("info");
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

    socket.emit('login', { "pseudo": pseudo = prompt("Please enter your name", 'Flan '+randName())});

    socket.on("pseudoInvalide", function() {
        socket.emit('login', { "pseudo": pseudo = prompt("Please enter another name", 'Flan '+randName())});
    });
    
    socket.on('changeName', function (data) {
        addMsg("<b>"+data.old+"</b> is now known as <b>"+data.new+"</b>", true);
    });
    
    socket.on('newUser', function (data) {
        addMsg("<b>"+data.name+"</b> is now online", true);
    });

    socket.on('userLeave', function (data) {
        addMsg("<b>"+data.name+"</b> is now offline", true);
    });
    
    socket.on('chatMsg', function (data) {
        addMsg(data.msg);
    });

    video = videojs(document.querySelector('.video-js'));

    video.ready(function() {
        socket.emit('ready');
    });

}