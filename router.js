var url = require('url');

var routes = {
    static: {},
    dynamic: {},
    spe: {
        "404": function (req, res) {
            res.writeHead(404, {'Content-Type': 'text/plain'});
            res.end('Welcome to the void...');
        }
    }
};

function addStaticRoute(request, name, callback) {
    if (routes.static.hasOwnProperty(request) === false)
        routes.static[request] = {};

    if (routes.static[request].hasOwnProperty(name) === true)
	    console.warn("Overwriting the route : \"%s:%s\" !", request, name);
    routes.static[request][name] = callback;
}

function addDynamicRoute(request, name, callback) {
    var type = {none: "[^/]", int: "[0-9]", str: "[A-Za-z0-9_]", path:"."};
    if (routes.dynamic.hasOwnProperty(request) === false)
        routes.dynamic[request] = {};

    if (routes.dynamic[request].hasOwnProperty(name) === true)
        console.warn("Overwriting the route : \"%s:%s\" !", type, name);
    
    var search = null, regex = name, paramsList = [];
    while ((search = /\{[A-Za-z_]+( *,[ A-Za-z0-9=]*)*\}/.exec(regex)) !== null) {
        var params = search[0].replace(/ |{|}/g, "").split(","),
            options = {
                name: params.reverse().pop(),
                type: "none",
                minlen: null,
                maxlen: null
            };

        params.reverse().forEach(function(elem) {
            if (elem.length == 0)
                return;
            var param = elem.toLowerCase().split("=");

            if (param.length != 2)
                return console.warn("Routes Params Error: invalid arg \"%s\" in route \"%s\" ", elem, name);

            if (param[0] == "type") {
                if (["int", "str", "path"].indexOf(param[1]) == -1)
                    return console.warn("Routes Params Error: invalid type \"%s\" in route \"%s\" ", param[1], name);
                options.type = param[1];
            }
            else if (["length", "minlen", "maxlen"].indexOf(param[0]) != -1) {
                if (!/^[0-9]+$/.test(param[1]))
                    return console.warn("Routes Params Error: invalid length \"%s\" in route \"%s\" ", param[1], name);

                if (param[0] == "length")
                    options.minlen = options.maxlen = parseInt(param[1]);
                else
                    options[param[0]] = parseInt(param[1]);
            }
            else
                return console.warn("Routes Params Error: unknown arg \"%s\" in route \"%s\" ", param[0], name);

        });

        paramsList.push(options);
        regex = regex.replace(search[0], "("+type[options.type]+(options.minlen === null && options.maxlen === null ? "+" : options.minlen !== null ? options.maxlen !== null ? options.maxlen == options.minlen ? "{"+options.minlen+"}" : "{"+options.minlen+", "+options.maxlen+"}" : "{"+options.minlen+",}" : "{1, "+options.maxlen+"}")+")");

    }
    
    routes.dynamic[request][name] = { 
        regex: new RegExp("^"+regex+"$"),
        params: paramsList,
        callback: callback
    };
}

exports.add = function(request, name, callback) {
    if (/\{[A-Za-z_]+[, A-Za-z0-9=]*\}/.test(name))
        addDynamicRoute(request, name, callback);
    else
        addStaticRoute(request, name, callback);
}

exports.exec = function(req, res) {
    var urldata = url.parse(req.url, true), name = urldata.pathname;
    req.query = urldata.query;
    
    //console.log("Request route : \""+req.method+"\":\""+name+"\"");
    
    if (routes.static.hasOwnProperty(req.method) === true && routes.static[req.method].hasOwnProperty(name) === true)
        return routes.static[req.method][name](req, res);
    
    if (routes.dynamic.hasOwnProperty(req.method)) {
        var keys = Object.keys(routes.dynamic[req.method]);
        for (var i = 0; i < keys.length; i++)
            if (routes.dynamic[req.method][keys[i]].regex.test(name)) {
                if (routes.dynamic[req.method][keys[i]].params.length > 0) {
                    var search = routes.dynamic[req.method][keys[i]].regex.exec(name);

                    req.urlParams = {};
                    for (var j = 1; j < search.length; j++)
                        req.urlParams[routes.dynamic[req.method][keys[i]].params[j-1].name] = search[j];
                }

                return routes.dynamic[req.method][keys[i]].callback(req, res);
            }
    }

    return routes.spe["404"](req, res);
}

exports.rm = function(type, name) {
    if (routes.static.hasOwnProperty(type) === true && routes.static[type].hasOwnProperty(name) === true)
        return delete routes.static[type][name];
    else if (routes.dynamic.hasOwnProperty(type) === true && routes.dynamic[type].hasOwnProperty(name) === true)
        return delete routes.dynamic[type][name];
    return true;
}

exports.list = function() {
    return Object.keys(routes.static).concat(Object.keys(routes.dynamic));
}

exports.debug = function() {
    console.log(routes);
}