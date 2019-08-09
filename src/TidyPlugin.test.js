const crypto = require('crypto');

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
  let outputDir = '/fake/output/path/';
  let glob, fs, TidyPlugin, compiler, opts, eventCallbacks, tidyPlugin, cb;

  beforeEach(() => {
    // This has to be done to ensure mocks are generated no matter the functions context.
    jest.resetModules();
    jest.doMock('glob', () => jest.genMockFromModule('glob'));
    jest.doMock('fs-extra', () => jest.genMockFromModule('fs-extra'));
    glob = require('glob');
    fs = require('fs-extra');
    TidyPlugin = require('./TidyPlugin');

    // silence logs
    jest.spyOn(global.console, 'log');
    global.console.log.mockImplementation(() => {});

    eventCallbacks = {};
    compiler = {
      options: {
        output: {
          path: outputDir,
        },
        watch: true,
      },
      plugin: (type, cb) => {
        eventCallbacks[type] = cb;
      },
    };
    opts = {
      cleanOutput: true,
      hashLength: 5,
    };
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

  it('should set up "run" listener', () => {
    compiler.options.watch = false;

    tidyPlugin = new TidyPlugin(opts);
    tidyPlugin.apply(compiler);
    tidyPlugin.clean = jest.fn();

    expect( eventCallbacks['run'] ).toEqual( expect.any(Function) );
    eventCallbacks['run']();
    expect( tidyPlugin.clean ).toHaveBeenCalled();
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

      afterEmit(compilation, cb);
      expect( glob.sync ).not.toHaveBeenCalled();
      expect( cb ).toHaveBeenCalled();

      // =======================================================================
      // the only file that exists is the one that was output, so no deletion

      const hash = randomHash(opts.hashLength);
      const fileName = `${ outputDir }/app.${ hash }.js`;
      glob.sync.mockReturnValue([fileName]);
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
      let hash, newFile, newFiles, filesList, deletedFiles;
      
      beforeEach(() => {
        hash = randomHash(opts.hashLength);
        newFile = `app.${ hash }.js`;
        newFiles = [
          newFile,
          `${ newFile }.map`,
        ];
        filesList = [
          'app.1234.js',
          'app.1234.js.map',
          'app.5678.js',
          'app.5678.js.map',
          'randomFile.js',
          ...newFiles,
        ];
        deletedFiles = [];
        compilation.chunks = [{
          files: newFiles,
          hash,
          rendered: true,
        }];
        glob.sync.mockImplementation(
          (fileName) => {
            const regEx = new RegExp(`${ fileName }$`);
            return filesList.filter(
              (file) => (regEx).test(`${ outputDir }${ file }`)
            );
          }
        );
        fs.unlinkSync.mockImplementation((filePath) => {
          if( filesList.includes(filePath) ) deletedFiles.push(filePath);
        });
      });
      
      it('should only delete the old files', () => {
        afterEmit(compilation, () => {
          expect( deletedFiles.length ).toBe(4);
          expect( deletedFiles.includes(newFile) ).toBe(false);
          expect( deletedFiles.includes(`${ newFile }.map`) ).toBe(false);
          filesList.slice(0, 4).forEach((deletedFile) => {
            expect( global.console.log ).toHaveBeenCalledWith(
              `${ TidyPlugin.LOG__DELETED } ${ deletedFile }`
            );
          });
        });
      });
      
      it('should NOT delete files during a dry-run', () => {
        tidyPlugin.opts.dryRun = true;
        afterEmit(compilation, () => {
          expect( deletedFiles.length ).toBe(0);
          filesList.slice(0, 4).forEach((deletedFile) => {
            expect( global.console.log ).toHaveBeenCalledWith(
              `${ TidyPlugin.LOG__DRY_DELETE } ${ deletedFile }`
            );
          });
        });
      });
      
      it("should NOT delete anything if there aren't any matching files found", () => {
        glob.sync.mockReturnValue([]);
        global.console.log.mockReset();

        afterEmit(compilation, () => {
          expect( deletedFiles.length ).toBe(0);
          expect( global.console.log ).not.toHaveBeenCalled();
        });
      });
      
      it('should handle error thrown on deletion failure', () => {
        glob.sync.mockReturnValue(['fakeFileError.js']);
        fs.unlinkSync.mockImplementation(() => { throw new Error('blah'); });

        expect( () => { afterEmit(compilation, cb); } ).toThrow();
      });
    });
  });

  describe('clean', () => {
    let outputDir = '/fake/output/path/';

    beforeEach(() => {
      cb = jest.fn();
      tidyPlugin = new TidyPlugin(opts);
      tidyPlugin.outputPath = outputDir;
    });

    it("shouldn't do anything if not enabled", () => {
      tidyPlugin.opts.cleanOutput = false;
      tidyPlugin.clean(cb);
      expect( cb ).not.toHaveBeenCalled();
    });

    it("should throw an error if a callback wasn't passed for WP", () => {
      expect( () => { tidyPlugin.clean(); } ).toThrow(
        'No callback provided for async event'
      );
    });

    it('should clean the output path', () => {
      let doneCB;
      fs.pathExistsSync.mockReturnValue(true);
      fs.emptyDir.mockImplementation((oPath, cb) => {
        doneCB = cb;
      });

      tidyPlugin.clean(cb);
      doneCB();

      expect(fs.emptyDir).toHaveBeenCalledWith(tidyPlugin.outputPath, doneCB);
      expect( cb ).toHaveBeenCalled();
      expect( () => { doneCB(new Error('fake error')); } ).toThrow();
    });

    it("should act as a pass-through if there's nothing to clean", () => {
      fs.pathExistsSync.mockReturnValue(false);
      tidyPlugin.clean(cb);
      expect( cb ).toHaveBeenCalled();
    });
    
    describe('Dry-Run', () => {
      let files, globCB;
      
      beforeEach(() => {
        files = [
          `${ tidyPlugin.outputPath }file1.jpg`,
          `${ tidyPlugin.outputPath }file2.jpg`,
          `${ tidyPlugin.outputPath }file3.jpg`,
        ];
        fs.pathExistsSync.mockReturnValue(true);
        glob.mockImplementation((_, cb) => { globCB = cb; });
        tidyPlugin.opts.dryRun = true;
      });
      
      it('should throw an errror', () => {
        const err = new Error('Something bad happened');
        
        tidyPlugin.clean(cb);
        
        expect(() => { globCB(err); }).toThrow(`Dry-run failed | ${ err }`);
        expect( cb ).not.toHaveBeenCalled();
      });
      
      it('should NOT delete files', () => {
        tidyPlugin.clean(cb);
        globCB(null, files);
        
        expect( global.console.log ).toHaveBeenCalledWith(
          `${ TidyPlugin.LOG__DRY_CLEAN } output dir`
        );
        expect( global.console.log ).toHaveBeenCalledWith(
          files.map((file) => `- ${ TidyPlugin.LOG__DRY_DELETE } ${ file }`).join('\n')
        );
        expect( cb ).toHaveBeenCalled();
      });
    });
  });
});
