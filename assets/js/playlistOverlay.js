const Component = videojs.getComponent('Component');

const dom = videojs.dom || videojs;
const registerPlugin = videojs.registerPlugin || videojs.plugin;

class SidePlaylist extends Component {
    constructor(player, options) {
        super(player, options);
        this.items = [];
    }

    createEl() {
        var el = dom.createEl("div", {className: "vjs-side-playlist-overlay"}),
            content = dom.createEl("div", {className: "vjs-side-playlist-content"}),
            title = dom.createEl("h2", {});

        this.listContainer = dom.createEl("div", {className: "vjs-side-playlist-container"});

        title.appendChild(dom.createEl("i", {className: "fa fa-arrow-right", onclick: () => document.querySelector(".vjs-side-playlist-overlay").style.width = "0"}));
        title.appendChild(document.createTextNode("Playlist"));

        content.appendChild(title);
        content.appendChild(this.listContainer);

        el.appendChild(content);
        return el;
    }

    buildCSSClass() {
        return "vjs-side-playlist-overlay";
    }

    addItem(item) {
        if (typeof this.listContainer == "undefine")
            return;

        this.items.push(item);
        this.listContainer.appendChild(item.el());
    }

    resetData() {
        while (this.items.length) {
            var tmp = this.items.pop();
            this.listContainer.removeChild(tmp.el());
            tmp.dispose();
        }
    }
}

Component.registerComponent('SidePlaylist', SidePlaylist);


const ClickableComponent = videojs.getComponent('ClickableComponent');
class SidePlaylistItem extends ClickableComponent {
    constructor(player, options) {
        super(player, options);

        this.id = options.id;
        this.name = options.name;
        this.user = options.user;
        console.log(this);
    }

    buildCSSClass() {
        return "vjs-side-playlist-item";
    }

    createEl() {
        var el = super.createEl(),
            textContaineur = dom.createEl("div", {className: "text-containeur"});
        el.dataset.id =  this.options_.id;

        el.appendChild(dom.createEl("button", {innerHTML: "&times;", className: "close", onclick: function(event) {
            event.stopPropagation();
            socket.emit("removeFromPlaylist", {id: this.parentElement.dataset.id});
            this.parentElement.parentElement.removeChild(this.parentElement);
        }}, {type: "button"}));

        el.appendChild(dom.createEl("img", {}, {src: "/public/img/vid.png", alt: "thumbnail"}));


        textContaineur.appendChild(dom.createEl("span", {innerText: this.options_.name, className: "title"}));
        textContaineur.appendChild(dom.createEl("br"));
        textContaineur.appendChild(dom.createEl("span", {innerText: this.options_.user, className: "contributor"}));

        el.appendChild(textContaineur);

        return el;
    }

    handleClick(e) {
        socket.emit("playVideoPlaylist", {id: this.id});
    }
}

Component.registerComponent('SidePlaylistItem', SidePlaylistItem);


const Button = videojs.getComponent('Button');
class SidePlaylistButton extends Button {
    constructor(player, options) {
        super(player, options);
    }

    createEl() {
        var el = super.createEl();
        el.appendChild(dom.createEl("i", {className: "fa fa-bars"}));
        return el;
    }

    buildCSSClass() {
        return "vjs-side-playlist-button";
    }

    handleClick(e) {
        document.querySelector(".vjs-side-playlist-overlay").style.width = "450px";
    }
}

SidePlaylistButton.prototype.controlText_ = 'Display Playlist';

Component.registerComponent('SidePlaylistButton', SidePlaylistButton);


var plugin = function(options) {
    this.addChild('SidePlaylistButton', {});
    this.playlistUI = this.addChild('SidePlaylist', {});
    console.log(this);
};

plugin.setPlaylist = function(data) {
    video.playlistUI.resetData();

    for (var i = 0; i < data.playlist.length; i++)
        video.playlistUI.addItem(new SidePlaylistItem(this, data.playlist[i]));
}
  
plugin.VERSION = '0.0.1';

registerPlugin('SidePlaylist', plugin);