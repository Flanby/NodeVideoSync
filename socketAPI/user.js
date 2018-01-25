var config = require("../config");

var users = [];
var io = config.get('SocketIOServ');

exports.searchUser = searchUser;
function searchUser(id) {
    for (var i = 0; i < users.length; i++)
        if (users[i].socket.id == id)
            return users[i];
    return null;
}

exports.login = function (data) {
    if (typeof data.pseudo == "undefined" || data.pseudo == null || data.pseudo.length > 60) {
        this.emit("pseudoInvalide");
        return ;
    }
    for (var i = 0; i < users.length; i++)
        if (users[i].name == data.pseudo && users[i].socket.id != this.id) {
            this.emit("pseudoInvalide");
            return ;
        }

    var u;
    if ((u = searchUser(this.id)) != null)
        return io.emit("changeName", {old: u.name, new: u.name = data.pseudo});

    users.push({"socket": this, name: data.pseudo});
    //this.broadcast.emit("newUser", {name: data.pseudo});
    io.emit("newUser", {name: data.pseudo});
    //this.emit("currentlyAiring", currentVideo);
};

exports.logout = function () {
    for (var i = 0; i < users.length; i++)
        if (users[i].socket.id == this.id) {
            this.broadcast.emit("userLeave", {name: users[i].name});

            var tmp = [];

            for (var y = users.length - 1; i <= y; y--) {
                if (y == i) {
                    users.pop();
                    users = users.concat(tmp.reverse());
                    return;
                }
                else
                    tmp.push(users.pop());
            }
            return ;
        }
}

exports.chatMsg = function (data) {
    if (data.msg.length == 0)
        return;
    for (var i = 0; i < users.length; i++)
        if (users[i].socket.id == this.id) {
            this.broadcast.emit("chatMsg", {msg: "<b>"+users[i].name+":</b> "+data.msg});
            return ;
        }
    this.emit("pseudoInvalide");
}

exports.listUser = function () {
    var list = [];
    for (var i = 0; i < users.length; i++)
        list.push(users[i].name);
    this.emit("userslist", {users: list});
};

exports.nbUsers = function() {
    return users.length;
}