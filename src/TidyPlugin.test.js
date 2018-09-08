const crypto = require('crypto');

/**
 * Generates a random hash to simulate WP builds.
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
      hashLength: 8,
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should store passed opts', () => {
    tidyPlugin = new TidyPlugin(opts);

    for( let prop in opts ){
      expect( tidyPlugin[prop] ).toBeDefined();
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

    it('should delete files of the same name but with a non-matching hash', () => {
      const hash = randomHash(opts.hashLength);
      const newFile = `app.${ hash }.js`;
      const newFiles = [
        newFile,
        `${ newFile }.map`,
      ];
      const origFiles = [
        'app.1234.js',
        'app.1234.js.map',
        'app.5678.js',
        'app.5678.js.map',
        ...newFiles,
      ];
      const deletedFiles = [];
      compilation.chunks = [{
        files: newFiles,
        hash,
        rendered: true,
      }];
      glob.sync.mockImplementation(
        (fileName) => origFiles.filter(
          (file) => (new RegExp(`${ fileName }$`)).test(`${ outputDir }${ file }`)
        )
      );
      fs.unlinkSync.mockImplementation((filePath) => {
        if( origFiles.includes(filePath) ) deletedFiles.push(filePath);
      });

      // =======================================================================
      // check that only the new file remains

      afterEmit(compilation, () => {
        expect( deletedFiles.length ).toBe(4);
        expect( deletedFiles.includes(newFile) ).toBe(false);
        expect( deletedFiles.includes(`${ newFile }.map`) ).toBe(false);
      });

      // =======================================================================
      // shouldn't try to delete anything if there aren't any old files

      glob.sync.mockReturnValue([]);

      afterEmit(compilation, () => {
        expect( deletedFiles.length ).toBe(4);
        expect( deletedFiles.includes(newFile) ).toBe(false);
        expect( deletedFiles.includes(`${ newFile }.map`) ).toBe(false);
      });

      // =======================================================================
      // should handle error thrown on deletion failure

      glob.sync.mockReturnValue(['fakeFileError.js']);
      fs.unlinkSync.mockImplementation(
        () => { throw new Error('blah'); }
      );

      expect( () => {
        afterEmit(compilation, cb);
      } ).toThrow();
    });
  });

  describe('clean', () => {
    let outputDir = '/fake/output/path/';

    beforeEach(() => {
      cb = jest.fn();
      tidyPlugin = new TidyPlugin(opts);
      tidyPlugin.cleanOutput = true;
      tidyPlugin.outputPath = outputDir;
    });

    it("shouldn't do anything if not enabled", () => {
      tidyPlugin.cleanOutput = false;
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
  });
});
