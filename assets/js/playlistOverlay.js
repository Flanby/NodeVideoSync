const Component = videojs.getComponent('Component');

const dom = videojs.dom || videojs;
const registerPlugin = videojs.registerPlugin || videojs.plugin;

class SidePlaylist extends Component {
    constructor(player, options) {
        super(player, options);
        this.items = [];
        this.currentItem = -1;
    }

    setCurrentVideo(nc) {
        if (nc < 0 || nc > this.items.length)
            return;
        if (this.currentItem != -1)
            this.items[this.currentItem].el().classList.remove("current");
        this.items[this.currentItem = nc].el().classList.add("current");
    }

    createEl() {
        var el = dom.createEl("div", {className: "vjs-side-playlist-overlay"}),
            content = dom.createEl("div", {className: "vjs-side-playlist-content"}),
            titleContainer = dom.createEl("div", {className: "vjs-side-playlist-title-container"}),
            menuBar = dom.createEl("div", {className: "vjs-side-playlist-menu-bar"}),
            title = dom.createEl("h2", {});

        
        title.appendChild(new SidePlaylistButton(this.player_, {icon: "arrow-right", title: "Hide Playlist", clickCallback: () => this.hide()}).el());
        title.appendChild(document.createTextNode("Playlist"));
        
        menuBar.appendChild(new SidePlaylistButton(this.player_, {icon: "backward", title: "Previous", clickEvent: "SidePlaylist.prev"}).el());
        menuBar.appendChild(new SidePlaylistButton(this.player_, {icon: "forward", title: "Next", clickEvent: "SidePlaylist.next"}).el());
        menuBar.appendChild(new SidePlaylistButton(this.player_, {icon: "upload", title: "Upload Video", clickEvent: "SidePlaylist.upload"}).el());
        menuBar.appendChild(new SidePlaylistButton(this.player_, {icon: "plus", title: "Add Video", clickEvent: "SidePlaylist.add"}).el());
        
        titleContainer.appendChild(title);
        titleContainer.appendChild(dom.createEl("div", {className: "separator"}));
        titleContainer.appendChild(menuBar);
        
        this.listContainer = dom.createEl("div", {className: "vjs-side-playlist-container"});

        content.appendChild(titleContainer);
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

    removeVid(id) {
        for (var i = 0; i < this.items.length; i++)
            if (this.items[i].id == id) {
                var tmp = [];

                for (var j = this.items.length - 1; i < j; j--)
                    tmp.push(this.items.pop());

                this.listContainer.removeChild(this.items.pop().el());
                this.items = this.items.concat(tmp.reverse());

                this.player_.SidePlaylist().trigger("SidePlaylist.rm", {videoId: id});

                break ;
            }
    }

    resetData() {
        while (this.items.length) {
            var tmp = this.items.pop();
            this.listContainer.removeChild(tmp.el());
            tmp.dispose();
        }
    }

    show() {
        this.player_.SidePlaylist().trigger("SidePlaylist.show");
        this.el_.style.width = "450px";
    }

    hide() {
        this.player_.SidePlaylist().trigger("SidePlaylist.hide");
        this.el_.style.width = "0px";
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
    }

    buildCSSClass() {
        return "vjs-side-playlist-item";
    }

    createEl() {
        var el = super.createEl(),
            textContaineur = dom.createEl("div", {className: "text-containeur"});
        el.dataset.id =  this.options_.id;


        var thumb = "/public/img/vid.png";
        if (this.options_.thumb.match(/^(\/\/|https?:\/\/)/i) != null)
            thumb = this.options_.thumb;
        else if (this.options_.thumb.length > 0)
            thumb = "/public/img/thumb/" + this.options_.thumb;
        var thumHolder = dom.createEl("div", {className: "thumb-containeur"});
        thumHolder.appendChild(dom.createEl("img", {}, {src: thumb, alt: "thumbnail"}));
        if (this.options_.duration != "")
            thumHolder.appendChild(dom.createEl("span", {className: "time", innerText: this.options_.duration}))


        textContaineur.appendChild(dom.createEl("span", {innerText: this.options_.name, className: "title"}));
        textContaineur.appendChild(dom.createEl("br"));
        textContaineur.appendChild(dom.createEl("span", {innerText: this.options_.user, className: "contributor"}));

        el.appendChild(thumHolder);
        el.appendChild(textContaineur);

        var self = this;
        el.appendChild(new SidePlaylistButton(this.player_, {icon: "times", CSSClass: "vjs-side-playlist-remove", clickCallback: function(event) {
            event.stopPropagation();
            self.player_.SidePlaylist().removeVid(self.options_.id);
        }}).el());

        return el;
    }

    handleClick(e) {
        this.player_.SidePlaylist().trigger("SidePlaylist.playVid", {videoId: this.id});
    }
}

Component.registerComponent('SidePlaylistItem', SidePlaylistItem);


const Button = videojs.getComponent('Button');
class SidePlaylistButton extends Button {
    constructor(player, options) {
        super(player, options);
    }

    createEl() {
        if (typeof this.options_.title == "string")
            this.controlText_ = this.options_.title;
        var el = super.createEl();
        el.appendChild(dom.createEl("i", {className: "fa fa-"+(typeof this.options_.icon == "string" ? this.options_.icon : "question-square")}));
        return el;
    }

    buildCSSClass() {
        return typeof this.options_.CSSClass == "string" ? this.options_.CSSClass : ""; 
    }

    handleClick(e) {
        if (typeof this.options_.clickEvent == "string" && this.options_.clickEvent.length != 0)
            this.player_.SidePlaylist().trigger(this.options_.clickEvent);
        else if (typeof this.options_.clickEvent == "object")
            this.player_.SidePlaylist().trigger(this.options_.clickEvent.name, this.options_.clickEvent.data);

        if (typeof this.options_.clickCallback == "function")
            this.options_.clickCallback(e);
    }
}

Component.registerComponent('SidePlaylistButton', SidePlaylistButton);


const Plugin = videojs.getPlugin('plugin');
class SidePlaylistPlugin extends Plugin {
    constructor(player, options) {
        super(player, options);

        player.addChild('SidePlaylistButton', {icon: "bars", title: "Show Playlist", CSSClass: "vjs-side-playlist-button", clickCallback: () => this.playlistUI.show()});
        this.playlistUI = player.addChild('SidePlaylist', {});
    }

    setPlaylist(data) {
        this.playlistUI.resetData();

        for (var i = 0; i < data.playlist.length; i++)
            this.playlistUI.addItem(new SidePlaylistItem(this.player, data.playlist[i]));

        this.playlistUI.setCurrentVideo(data.offset);
    }

    removeVid(id) {
        this.playlistUI.removeVid(id);
    }
}
SidePlaylistPlugin.prototype.VERSION = '0.0.1';

registerPlugin('SidePlaylist', SidePlaylistPlugin);