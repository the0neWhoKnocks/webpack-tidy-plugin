const fs = require('fs-extra');
const { basename } = require('path');
const color = require('cli-color');
const glob = require('glob');

class TidyPlugin {
  /**
   * A plugin for Webpack that keeps source directories clean during a one-off
   * build and while watching for changes.
   *
   * @param {object} opts - Configuration options
   */
  constructor(opts) {
    this.opts = {
      cleanOutput: false,
      dryRun: false,
      hashLength: 5,
      ...opts,
    };
  }
  
  /**
   * Tap into WP's event system so we know when to delete files.
   *
   * @param {object} compiler - The current WP compiler.
   */
  apply(compiler) {
    // List of event types - https://github.com/webpack/docs/wiki/plugins#the-compiler-instance

    // compiler.outputFileSystem - may be useful in determining what can run on
    // a specific OS.

    let outputPath = compiler.options.output.path;

    if(!outputPath) throw Error('No output path found in the Webpack config.');
    if(outputPath === '/') throw Error('Root is not a valid output path.');
    if(!outputPath.endsWith('/')) outputPath += '/';

    this.outputPath = outputPath;

    if( compiler.options.watch ){
      compiler.plugin('after-emit', (compilation, cb) => {
        for(let i=0; i<compilation.chunks.length; i++){
          const chunk = compilation.chunks[i];

          // if file was rendered, find it's older counterpart and kill it
          if( chunk.rendered ){
            const hash = chunk.hash.slice(0, this.opts.hashLength);

            // account for all files types that were created
            for(let f=0; f<chunk.files.length; f++){
              const fileName = chunk.files[f];
              const filePattern = fileName.replace(hash, '*');
              const files = glob.sync(`${ outputPath }${ filePattern }`);

              if( files.length ){
                files.forEach((filePath) => {
                  if( !filePath.endsWith(fileName) ){
                    if( this.opts.dryRun ){
                      console.log(`${ TidyPlugin.LOG__DRY_DELETE } ${ basename(filePath) }`);
                    }
                    else {
                      fs.unlinkSync(filePath);
                      console.log(`${ TidyPlugin.LOG__DELETED } ${ basename(filePath) }`);
                    }
                  }
                });
              }
            }
          }
        }

        cb();
      });
    }
    else {
      // run is called for one-off build
      compiler.plugin('run', (compiler, cb) => this.clean(cb));
    }
  }

  /**
   * Deletes contents of provided file paths. Utilized during the first run of
   * the WebPack build to ensure there aren't any leftover generated files.
   *
   * @param {Function} cb - This is called during `async` events which need to
   * have a callback called in order to proceed.
   */
  clean(cb) {
    if( this.opts.cleanOutput ){
      if(!cb) throw Error('No callback provided for async event');

      if( fs.pathExistsSync(this.outputPath) ) {
        console.log(`${ this.opts.dryRun ? TidyPlugin.LOG__DRY_CLEAN : TidyPlugin.LOG__CLEAN } output dir`);
        
        if( this.opts.dryRun ){
          glob(`${ this.outputPath }/**`, (err, files) => {
            if (err) throw Error(`Dry-run failed | ${ err }`);
            console.log( files.map((file) => `- ${ TidyPlugin.LOG__DRY_DELETE } ${ file }`).join('\n') );
            cb();
          });
        }
        else {
          fs.emptyDir(this.outputPath, (err) => {
            if(err) throw err;
            cb();
          });
        }
      }
      else cb();
    }
  }
}

TidyPlugin.LOG__CLEAN = color.green.inverse(' CLEAN ');
TidyPlugin.LOG__DELETED = color.green.inverse(' DELETED ');
TidyPlugin.LOG__DRY_CLEAN = color.bold.black.inverse(' CLEAN ');
TidyPlugin.LOG__DRY_DELETE = color.bold.black.inverse(' DELETE ');

module.exports = TidyPlugin;