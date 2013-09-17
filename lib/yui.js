/*
 * Copyright (c) 2013, Yahoo! Inc.  All rights reserved.
 * Copyrights licensed under the New BSD License.
 * See the accompanying LICENSE file for terms.
 */

/*jslint node:true, nomen: true */

/**
The `express-yui` middleware provides the foundation and some basic
features to attach information into the `res.locals` object
that could be used to boot `YUI` in the client runtime.

@module express-yui
**/

'use strict';

var expstate = require('express-state'),
    middleware = require('./middleware'),

    // sub-modules
    cdn     = require('./cdn'),
    seed    = require('./seed'),
    origin  = require('./origin'),
    groups  = require('./groups'),
    shifter = require('./shifter'),
    loader  = require('./loader'),
    server  = require('./server'),
    view    = require('./view'),

    // utilities
    utils = require('./utils'),
    debug = require('debug')('express:yui');

/**
The `express-yui` extension provides the foundation and some basic
features to attach information into the `res.locals` object
that could be used to boot `YUI` in the client runtime.

When the `"seed"` sub-module is used, it will automatically
mix itself into `app.yui.expose()`, and it exposes a local variable
in a form of an array of object with the information to
build the script tag or tags that forms the seed:

The following is an example of how these features can be used:

    var express = require('express'),
        expyui = require('express-yui'),
        app = express();

    expyui.extend(app);
    // Set some basic configs
    app.yui.applyConfig({
        fetchCSS: false
    });
    // Call expose middleware when a route match.
    app.get('/index.html', expyui.expose(), anotherRoute);

In the example above, the `state` of the app will be serialized
per request, and can be used in the template to set up the client
side to run YUI with the same configuration used on the server side.
Here is an example of a handlebars template:

    <script>
    {{{state}}}
    app.yui.use('node', function (Y) {
        Y.one('#content').setContent('<p>Ready!</p>');
    });
    </script>

In this particular case, `state` will hold all the
appropiated settings generated by `expose` middleware.

@class yui
@static
@constructor
@uses *express, *express-expose, utils, cdn, seed, origin, groups, shifter, loader, server, view
*/
function ExpressYUIExtension(app) {
    var YUI;

    this._app = app;
    this._config = {};

    try {
        YUI = require('yui' + (utils.debugMode ? '/debug' : ''));
    } catch (e) {
        throw new Error('Error trying to require("yui"). ' +
            '`express`, `express-yui` and `yui` are peerDependencies.');
    }

    this.YUI  = YUI.YUI;
    this.version = YUI.YUI.version;
    this.path = YUI.path();
    debug('Using yui@' + this.version + ' from [' + this.path + '] in ' +
            (utils.debugMode ? 'debug' : 'production') + ' mode.');

    // default configuration based on version and assuming default CDN
    this._config = {
        version: this.version,
        base: "http://yui.yahooapis.com/" + this.version + "/",
        comboBase: "http://yui.yahooapis.com/combo?",
        comboSep: "&",
        root: this.version + "/",
        filter: (utils.debugMode ? 'debug' : 'min'),
        combine: !utils.debugMode
    };
}

ExpressYUIExtension.prototype = {

    /**
    Turns on debug mode for YUI Loader by setting
    `debug=true`, `logLevel="debug"`, `combine=false` and `filter="debug"`
    into the static configuration.

        app.yui.debugMode();

    @method debugMode
    @public
    @deprecated in favor of `expressYUI.debug()`
    @param {Object} config optional object to overrule
    specific settings when in debug mode.

        @param {boolean} config.combine default to `false`
        @param {boolean} config.debug default to `true`
        @param {string}  config.logLevel default to `"debug"`
        @param {string}  config.filter default to `"debug"`

    @chainable
    **/
    debugMode: function (config) {

        console.warn('`app.yui.debugMode()` is now deprecated, ' +
                ' use `expressYUI.debug()` middleware instead.');

        // storing static config
        this.config({
            combine: false,
            debug: true,
            filter: 'debug',
            logLevel: 'debug',
            useBrowserConsole: true
        }, config);

        return this;
    },

    /**
    Extends the static configuration with the supplier
    object(s). You can use it like this:

        // Disable CSS computations
        app.yui.applyConfig({
            fetchCSS: false
        });

    @method applyConfig
    @public
    @param {Object*} supplier objects to be mixed with the
    static configuration. All available settings
    [from the YUI API Docs](http://yuilibrary.com/yui/docs/api/classes/config.html).
    can be used here.
    @chainable
    **/
    applyConfig: function () {
        this.config.apply(this, Array.prototype.slice.call(arguments));
        return this;
    },

    /**
    Extends the static configuration with the supplier object(s)
    or returns the current static configuration reference. This
    configuration is static, and attached to the server object.
    Once you call `yui.expose()` middleware for the first time,
    this configuration becomes inmutable.

    @method config
    @protected
    @param {Object*} supplier Optional supplier objects
    that, if passed, will be mix with the static configuration.
    @return {object} static configuration
    **/
    config: function () {

        var args = Array.prototype.slice.call(arguments);

        // Mix in current `arguments` into `this._config`
        if (args.length) {
            args.unshift(this._config);
            utils.extend.apply(utils, args);
        }

        return this._config;
    }

};

utils.extend(ExpressYUIExtension.prototype, cdn, seed, origin, groups, shifter, loader, server, view);

// exposing middleware as members of the constructor
// exposing `augment` and `extend` methods to hook into a custom express or express app
module.exports = utils.extend(ExpressYUIExtension, middleware, {

    /**
    Deprecated method to augment an express application instance with `express-yui` functionalities.

    @method augment
    @deprecated
    @static
    @public
    @param {Object} app express app instance to be extended with the `yui` member.
    @return {object} express app instance
    **/
    augment: function (app) {

        console.warn('`expyui.augment(app)` is now deprecated, ' +
                ' use `expyui.extend(app)` instead.');

        return this.extend(app);
    },

    /**
    Extends an express application instance with `express-yui` functionalities.

    @method extend
    @static
    @public
    @param {Object} app express app instance to be extended with the `yui` member.
    @return {object} express app instance
    **/
    extend: function (app) {

        if (app['@yui']) { return app; }

        // Brand.
        Object.defineProperty(app, '@yui', {value: true});
        // expose requirements.
        expstate.extend(app);
        // adding the `yui` member.
        app.yui = new ExpressYUIExtension(app);

        return app;
    }

});