const fs = require('fs');
const color = require('cli-color');
const glob = require('glob');
const { exec } = require('child_process');

/**
 * A plugin for Webpack that keeps source directories clean during a one-off
 * build and while watching for changes.
 *
 * @param {Object} opts - Configuration options
 */
const TidyPlugin = function({ cleanPaths, hashLength, watching }){
  this.cleanPaths = cleanPaths;
  this.hashLength = hashLength;
  this.watching = watching;
};

TidyPlugin.prototype = {
  /**
   * Tap into WP's event system so we know when to delete files.
   *
   * @param {Object} compiler - The current WP compiler.
   */
  apply: function(compiler){
    // List of event types - https://github.com/webpack/docs/wiki/plugins#the-compiler-instance

    if( this.watching ){
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
              const files = glob.sync(filePattern);

              if( files.length ){
                files.forEach((filePath) => {
                  if( filePath !== fileName ){
                    try {
                      fs.unlinkSync(filePath);
                    }catch( err ) {
                      throw err;
                    }

                    console.log(`${ color.green.inverse(' DELETED ') } ${ filePath }`);
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
    if( this.cleanPaths ){
      // =======================================================================
      // Ensure paths are relative

      // This won't account for paths with spaces, but we only care if any path
      // begins with a `/`.
      const paths = this.cleanPaths.split(' ')
        .map(currPath => currPath.replace(/"|'/g, ''))
        .filter(currPath => currPath && !/^\/.*/.test(currPath) );

      if( !paths.length ) throw Error('No valid paths provided to delete');

      // =======================================================================
      // Delete files

      const cleanCmd = `rm -f ${ this.cleanPaths }`;

      console.log(`${ color.green.inverse(' Clean ') } output dirs`);

      exec(cleanCmd, (err, stdout, stderr) => {
        if(err) throw err;
        if(!cb) throw Error('No callback provided for async event');
        cb();
      });
    }
  },
};

module.exports = TidyPlugin;
