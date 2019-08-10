const { closeSync, openSync, unlinkSync } = require('fs');
const { basename, resolve } = require('path');
const crypto = require('crypto');
const glob = require('glob');
const mkdirp = require('mkdirp');

const OUTPUT_DIR = 'mockOutput';
const ABS_OUTPUT_DIR = resolve(__dirname, `../${ OUTPUT_DIR }`);
const DEFAULT_FILES = [
  `${ ABS_OUTPUT_DIR }/js/vendor.js`,
  `${ ABS_OUTPUT_DIR }/js/vendor.min.js`,
];

mkdirp.sync(ABS_OUTPUT_DIR);
mkdirp.sync(`${ ABS_OUTPUT_DIR }/css`);
mkdirp.sync(`${ ABS_OUTPUT_DIR }/js`);
closeSync(openSync(`${ ABS_OUTPUT_DIR }/css/lib.css`, 'w'));
DEFAULT_FILES.forEach((file) => { closeSync(openSync(file, 'w')); });

/**
 * Generates a random chunk hash string.
 *
 * @param {number} hashLength - Length of the hash
 * @returns {string}
 */
function randomHash(hashLength){
  const currDate = (new Date()).valueOf().toString();
  const random = Math.random().toString();

  return crypto
    .createHash('sha1')
    .update(currDate + random)
    .digest('hex')
    .slice(0, hashLength);
}

describe('TidyPlugin', () => {
  let fs, TidyPlugin, compiler, opts, eventCallbacks, tidyPlugin, cb;

  beforeEach(() => {
    // This has to be done to ensure mocks are generated no matter the functions context.
    jest.resetModules();
    // jest.doMock('glob', () => jest.genMockFromModule('glob'));
    jest.doMock('fs-extra', () => jest.genMockFromModule('fs-extra'));
    // glob = require('glob');
    fs = require('fs-extra');
    TidyPlugin = require('./TidyPlugin');

    // silence logs
    jest.spyOn(global.console, 'log');
    // global.console.log.mockImplementation(() => {});

    eventCallbacks = {};
    compiler = {
      options: {
        output: {
          path: OUTPUT_DIR,
        },
        watch: true,
      },
      plugin: (type, cb) => {
        eventCallbacks[type] = cb;
      },
    };
    opts = { hashLength: 5 };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should store passed opts', () => {
    tidyPlugin = new TidyPlugin(opts);

    for( let prop in opts ){
      expect( tidyPlugin.opts[prop] ).toBeDefined();
    }
  });
  
  it('should allow for overriding default opts', () => {
    opts.dryRun = true;
    tidyPlugin = new TidyPlugin(opts);

    for( let prop in opts ){
      expect( tidyPlugin.opts[prop] ).toBe( opts[prop] );
    }
  });

  it('should throw an error if no output path was found', () => {
    compiler.options.output.path = undefined;

    tidyPlugin = new TidyPlugin(opts);

    expect(() => { tidyPlugin.apply(compiler); }).toThrow(
      'No output path found in the Webpack config.'
    );
  });

  it('should throw an error if the output path is the root filesystem', () => {
    compiler.options.output.path = '/';

    tidyPlugin = new TidyPlugin(opts);

    expect(() => { tidyPlugin.apply(compiler); }).toThrow(
      'Root is not a valid output path.'
    );
  });

  it("should append a slash to the output path if one isn't present", () => {
    compiler.options.output.path = '/some/path/';
    tidyPlugin = new TidyPlugin(opts);
    tidyPlugin.apply(compiler);
    expect(tidyPlugin.outputPath.endsWith('/')).toBe(true);
    
    compiler.options.output.path = '/some/path';
    tidyPlugin = new TidyPlugin(opts);
    tidyPlugin.apply(compiler);
    expect(tidyPlugin.outputPath.endsWith('/')).toBe(true);
  });

  it('should set up "after-emit" listener', () => {
    tidyPlugin = new TidyPlugin(opts);
    tidyPlugin.apply(compiler);

    expect( eventCallbacks['after-emit'] ).toEqual( expect.any(Function) );
  });

  describe('after-emit', () => {
    let afterEmit, compilation;

    beforeEach(() => {
      compilation = {
        chunks: [],
      };
      cb = jest.fn();
      tidyPlugin = new TidyPlugin(opts);
      tidyPlugin.apply(compiler);
      afterEmit = eventCallbacks['after-emit'];
    });

    it("shouldn't try to delete anything if no assets were generated", () => {
      // =======================================================================
      // no files rendered from WP
      compilation.chunks = [{
        rendered: false,
      }];
      jest.spyOn(glob, 'sync');

      afterEmit(compilation, cb);
      expect( glob.sync ).not.toHaveBeenCalled();
      expect( cb ).toHaveBeenCalled();
      
      glob.sync.mockRestore();

      // =======================================================================
      // the only file that exists is the one that was output, so no deletion

      const hash = randomHash(opts.hashLength);
      const fileName = `${ OUTPUT_DIR }/app.${ hash }.js`;
      compilation.chunks = [{
        files: [fileName],
        hash,
        rendered: true,
      }];

      fs.unlinkSync.mockReset();
      afterEmit(compilation, cb);
      expect( fs.unlinkSync ).not.toHaveBeenCalled();
    });
    
    describe('Delete files of the same name but with a non-matching hash', () => {
      let hash, newFile, newFiles, oldFiles, filesList, deletedFiles;
      
      beforeEach(() => {
        hash = randomHash(opts.hashLength);
        newFile = `app.${ hash }`;
        newFiles = [
          `${ newFile }.js`,
          `${ newFile }.js.map`,
          `css/${ newFile }.css`,
        ];
        oldFiles = [
          'app.1234.js',
          'app.1234.js.map',
          'app.5678.js',
          'app.5678.js.map',
          'css/app.1234.css',
          'randomFile.js',
        ];
        filesList = [
          ...oldFiles,
          ...newFiles,
        ];
        deletedFiles = [];
        compilation.chunks = [{
          files: newFiles,
          hash,
          rendered: true,
        }];
        
        filesList.forEach((file) => {
          closeSync(openSync(`${ ABS_OUTPUT_DIR }/${ file }`, 'w'));
        });
        
        fs.unlinkSync.mockImplementation((filePath) => {
          if(!deletedFiles.includes(filePath)) deletedFiles.push(filePath);
        });
      });
      
      afterEach(() => {
        filesList.forEach((file) => {
          unlinkSync(`${ ABS_OUTPUT_DIR }/${ file }`);
        });
      });
      
      it('should only delete the old files', () => {
        afterEmit(compilation, () => {
          // NOTE - The last file `randomFile` doesn't match patterns of
          // generated files so it'll be ignored.
          expect( deletedFiles.length ).toBe(oldFiles.length - 1);
          expect( deletedFiles.includes(`${ newFile }.js`) ).toBe(false);
          expect( deletedFiles.includes(`${ newFile }.js.map`) ).toBe(false);
          expect( deletedFiles.includes(`${ newFile }.css`) ).toBe(false);
          oldFiles.slice(0, oldFiles.length - 1).forEach((deletedFile) => {
            expect( global.console.log ).toHaveBeenCalledWith(
              `${ TidyPlugin.LOG__DELETED } ${ basename(deletedFile) }`
            );
          });
        });
      });
      
      it('should NOT delete files during a dry-run', () => {
        tidyPlugin.opts.dryRun = true;
        afterEmit(compilation, () => {
          expect( deletedFiles.length ).toBe(0);
          oldFiles.slice(0, oldFiles.length - 1).forEach((deletedFile) => {
            expect( global.console.log ).toHaveBeenCalledWith(
              `${ TidyPlugin.LOG__DRY_DELETE } ${ basename(deletedFile) }`
            );
          });
        });
      });
      
      it("should NOT delete anything if there aren't any matching files found", () => {
        filesList.forEach((file) => {
          unlinkSync(`${ ABS_OUTPUT_DIR }/${ file }`);
        });
        filesList = [];
        global.console.log.mockReset();

        afterEmit(compilation, () => {
          expect( deletedFiles.length ).toBe(0);
          expect( global.console.log ).not.toHaveBeenCalled();
        });
      });
      
      it('should handle error thrown on deletion failure', () => {
        fs.unlinkSync.mockImplementation(() => { throw new Error('blah'); });

        expect( () => { afterEmit(compilation, cb); } ).toThrow();
      });
    });
  });
});
