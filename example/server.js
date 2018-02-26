/* eslint-disable require-jsdoc */

const fs = require('fs');
const path = require('path');
const express = require('express');
const color = require('cli-color');
const browserSync = require('browser-sync');
const opn = require('opn');
const portscanner = require('portscanner');
const yargs = require('yargs');
const bodyParser = require('body-parser');

const appConfig = require('./conf.app.js');
const endpoints = require('./src/endpoints.js');
const indexTemplate = require('./public/index.js');

// =============================================================================

yargs
  .option('d', {
    alias: 'dev',
    desc: 'Runs the server in Dev mode',
    type: 'boolean',
  })
  .option('c', {
    alias: 'cmd',
    choices: ['init'],
    desc: 'What function to run on the server (only CLI)',
  })
  .help()
  .argv;

const flags = yargs.parse();

// =============================================================================

const OS = (() => {
  const platform = process.platform;

  if( /^win/.test(platform) ) return 'WINDOWS';
  else if( /^darwin/.test(platform) ) return 'OSX';
  else if( /^linux/.test(platform) ) return 'LINUX';
  else return platform;
})();
const CHROME = (() => {
  switch(OS){
    case 'WINDOWS': return 'chrome';
    case 'OSX': return 'google chrome';
    case 'LINUX': return 'google-chrome';
  }
})();
const app = {
  init: function(){
    this.expressInst = express();
    this.server = require('http').createServer(this.expressInst);
    // doc root is `public`
    this.expressInst.use(express.static(appConfig.paths.PUBLIC));
    // allows for reading POST data
    this.expressInst.use(bodyParser.json()); // to support JSON-encoded bodies
    this.expressInst.use(bodyParser.urlencoded({ // to support URL-encoded bodies
      extended: true,
    }));

    // bind server routes
    this.setupRoutes();
    this.addServerListeners();
  },

  setupRoutes: function(){
    const _self = this;

    this.expressInst.get('/', (req, res) => {
      // strip off Express params from endpoints for frontend
      const feEndpoints = {
        get: {},
        post: {},
      };

      Object.keys(endpoints).forEach(type => {
        Object.keys(endpoints[type]).forEach(ep => {
          feEndpoints[type][ep] = endpoints[type][ep].path.replace(/\/:\w+/g, '');
        });
      });

      // always get the freshest version of the manifest in dev
      const manifestPath = path.resolve(__dirname, './public/manifest.json');
      const manifest = ( flags.dev )
        ? JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
        : require(manifestPath);

      res.send(indexTemplate({
        appData: {
          endpoints: feEndpoints,
        },
        appURL: _self.appURL,
        body: {
          scripts: [
            manifest['vendor.js'],
            manifest['app.js'],
            'https://fake.com/path/to/cdn/asset.js',
          ],
        },
        dev: flags.dev,
        head: {
          styles: [
            manifest['app.css'],
          ],
          title: appConfig.app.title,
        },
      }));
    });
  },

  addServerListeners: function(){
    const _self = this;

    // Dynamically sets an open port, if the default is in use.
    portscanner.checkPortStatus(appConfig.PORT, '127.0.0.1', (error, status) => {
      // Status is 'open' if currently in use or 'closed' if available
      switch(status){
        case 'open' : // port isn't available, so find one that is
          portscanner.findAPortNotInUse(appConfig.PORT, appConfig.PORT+20, '127.0.0.1', (error, openPort) => {
            console.log(`${ color.yellow.bold('[PORT]') } ${ appConfig.PORT } in use, using ${ openPort }`);

            appConfig.PORT = openPort;

            _self.startServer();
          });
          break;

        default :
          _self.startServer();
      }
    });
  },

  openBrowser: function(data){
    // let the user know the server is up and ready
    let msg = `${ color.green.bold.inverse(' SERVER ') } Running at ${ color.blue.bold(data.url) }`;

    if( flags.dev ) msg += `\n${ color.green.bold.inverse(' WATCHING ') } For changes`;

    console.log(`${ msg } \n`);

    if( flags.dev ){
      opn(data.url, {
        app: [CHROME, '--incognito'],
        wait: false, // no need to wait for app to close
      });
    }
  },

  startServer: function(){
    const _self = this;

    this.server.listen(appConfig.PORT, () => {
      _self.appURL = 'http://localhost:'+ appConfig.PORT +'/';

      browserSync.init({
        browser: CHROME,
        files: [ // watch these files
          `${ appConfig.paths.PUBLIC }/manifest.json`,
        ],
        logLevel: 'silent', // prevent snippet message
        notify: false, // don't show the BS message in the browser
        port: appConfig.PORT,
        url: _self.appURL,
      }, _self.openBrowser.bind(_self, {
        url: _self.appURL,
      }));
    });
  },
};

module.exports = app;
// CLI won't have parent
if( !module.parent && flags.cmd ){
  if( app[flags.cmd] ) app[flags.cmd]();
}
