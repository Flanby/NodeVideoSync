var filesManager = {
    add: function(file) {
        socket.emit("addToPlaylist", {video: {src: "", type: file.type}, origin: "P2P", name: file.name, owner: socket.id});
    }
}

$(function() {
    $("#upload .modal-footer .btn-primary").click(function() {
        console.log("Pink");
        if ($("#upload form input[type=file]")[0].files.length != 1 || $("#upload form input[type=file]").val().match(/\.(mp4|ogg|webm)$/i) == null) {
            return ;
        }

        
        video.src({type: $("#upload form input[type=file]")[0].files[0].type, src: (window.URL || window.webkitURL).createObjectURL($("#upload form input[type=file]")[0].files[0])})
    });
});
