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

    compiler.plugin('after-emit', (compilation, cb) => {
      for(let i=0; i<compilation.chunks.length; i++){
        const chunk = compilation.chunks[i];

        // if file was rendered, find it's older counterpart and kill it
        if( chunk.rendered ){
          const hash = chunk.hash.slice(0, this.opts.hashLength);
          // account for all files types that were created
          for(let f=0; f<chunk.files.length; f++){
            const fileName = chunk.files[f];
            const filePattern = `${ fileName.replace(hash, '*') }?(.map)`;
            const files = glob.sync(`${ outputPath }${ filePattern }`);

            if( files.length ){
              files.forEach((filePath) => {
                if(
                  !filePath.endsWith(fileName)
                  && !filePath.endsWith(`${ fileName }.map`)
                ){
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
}

TidyPlugin.LOG__DELETED = color.green.inverse(' DELETED ');
TidyPlugin.LOG__DRY_DELETE = color.bold.black.inverse(' [DR] DELETED ');

module.exports = TidyPlugin;