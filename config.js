var config = {};

exports.load = function(path) {
    try {
        var tmp = require(path);
        Object.assign(config, tmp);
        return true;
    } catch (e) {
        console.log(e);
        return false;
    }
}

exports.get = function(prop) {
    return config[prop];
}

exports.set = function(prop, val) {
    config[prop] = val;
}