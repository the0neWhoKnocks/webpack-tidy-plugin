const fs = require('fs-extra');
const color = require('cli-color');
const glob = require('glob');

/**
 * A plugin for Webpack that keeps source directories clean during a one-off
 * build and while watching for changes.
 *
 * @param {Object} opts - Configuration options
 */
const TidyPlugin = function({ cleanOutput, hashLength }){
  this.cleanOutput = cleanOutput;
  this.hashLength = hashLength;
};

TidyPlugin.prototype = {
  /**
   * Tap into WP's event system so we know when to delete files.
   *
   * @param {Object} compiler - The current WP compiler.
   */
  apply: function(compiler){
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
            const hash = chunk.hash.slice(0, this.hashLength);

            // account for all files types that were created
            for(let f=0; f<chunk.files.length; f++){
              const fileName = chunk.files[f];
              const filePattern = fileName.replace(hash, '*');
              const files = glob.sync(`${ outputPath }${ filePattern }`);

              if( files.length ){
                files.forEach((filePath) => {
                  if( !filePath.endsWith(fileName) ){
                    try {
                      fs.unlinkSync(filePath);
                    }catch( err ) {
                      throw err;
                    }

                    console.log(`${ color.green.inverse(' DELETED ') } ${ fileName }`);
                  }
                });
              }
            }
          }
        }

        cb();
      });
    }
    else{
      // run is called for one-off build
      compiler.plugin('run', (compiler, cb) => this.clean(cb));
    }
  },

  /**
   * Delets contents of provided file paths. Utilized during the first run of
   * the WebPack build to ensure there aren't any leftover generated files.
   *
   * @param {Function} cb - This is called during `async` events which need to
   * have a callback called in order to proceed.
   */
  clean: function(cb){
    if( this.cleanOutput ){
      if(!cb) throw Error('No callback provided for async event');

      // =======================================================================
      // Validate path

      if( !fs.pathExistsSync(this.outputPath) )
        throw Error(`Can't find the output path for cleaning. "${ this.outputPath }"`);

      // =======================================================================
      // Delete files

      console.log(`${ color.green.inverse(' Clean ') } output dir`);

      fs.emptyDir(this.outputPath, (err) => {
        if(err) throw err;
        cb();
      });
    }
  },
};

module.exports = TidyPlugin;
