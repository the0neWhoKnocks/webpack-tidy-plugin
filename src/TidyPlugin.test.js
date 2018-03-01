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
  let outputDir = './fake/output/path';
  let glob, fs, TidyPlugin, compiler, opts, eventCallbacks, tidyPlugin, cb,
    childProcess;

  beforeEach(() => {
    // This has to be done to ensure mocks are generated no matter the functions context.
    jest.resetModules();
    jest.doMock('glob', () => jest.genMockFromModule('glob'));
    jest.doMock('fs', () => jest.genMockFromModule('fs'));
    jest.doMock('child_process', () => jest.genMockFromModule('child_process'));
    glob = require('glob');
    fs = require('fs');
    childProcess = require('child_process');
    TidyPlugin = require('./TidyPlugin');

    eventCallbacks = {};
    compiler = {
      plugin: (type, cb) => {
        eventCallbacks[type] = cb;
      },
    };
    opts = {
      cleanPaths: './public/js/* ./public/css/*',
      hashLength: 8,
      watching: true,
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

  it('should set up "after-emit" listener', () => {
    tidyPlugin = new TidyPlugin(opts);
    tidyPlugin.apply(compiler);

    expect( eventCallbacks['after-emit'] ).toEqual( expect.any(Function) );
  });

  it('should set up "run" listener', () => {
    opts.watching = false;

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
        hash: randomHash(opts.hashLength),
      };
      cb = jest.fn();
      tidyPlugin = new TidyPlugin(opts);
      tidyPlugin.apply(compiler);
      afterEmit = eventCallbacks['after-emit'];
    });

    it("shouldn't try to delete anything if no assets were generated", () => {
      // =======================================================================
      // no files emitted from WP

      compilation.assets = {
        [`${ outputDir }/app.${ compilation.hash }.js`]: {
          emitted: false,
        },
      };

      afterEmit(compilation, cb);
      expect( glob.sync ).not.toHaveBeenCalled();
      expect( cb ).toHaveBeenCalled();

      // =======================================================================
      // the only file that exists is the one that was output, so no deletion

      const fileName = `${ outputDir }/app.${ compilation.hash }.js`;
      glob.sync.mockReturnValue([fileName]);
      compilation.assets = {
        [fileName]: {
          emitted: true,
        },
      };

      fs.unlinkSync.mockReset();
      afterEmit(compilation, cb);
      expect( fs.unlinkSync ).not.toHaveBeenCalled();
    });

    it('should set up after-emit listener', () => {
      const newFile = `${ outputDir }/app.${ compilation.hash }.js`;
      const origFiles = [
        `${ outputDir }/app.1234.js`,
        `${ outputDir }/app.5678.js`,
        newFile,
      ];
      const deletedFiles = [];
      compilation.assets = {
        [`${ newFile }`]: {
          emitted: true,
        },
      };
      glob.sync.mockReturnValue(origFiles);
      fs.unlinkSync.mockImplementation((filePath) => {
        const fileNdx = origFiles.indexOf(filePath);
        if( fileNdx > -1 ) deletedFiles.push(filePath);
      });

      // =======================================================================
      // check that only the new file remains

      afterEmit(compilation, () => {
        expect( deletedFiles.length ).toBe(2);
        expect( deletedFiles.indexOf(newFile) ).toBe(-1);
      });

      // =======================================================================
      // shouldn't try to delete anything if there aren't any old files

      glob.sync.mockReturnValue([]);

      afterEmit(compilation, () => {
        expect( deletedFiles.length ).toBe(2);
        expect( deletedFiles.indexOf(newFile) ).toBe(-1);
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
    beforeEach(() => {
      cb = jest.fn();
      tidyPlugin = new TidyPlugin(opts);
    });

    it("shouldn't do anything if no paths were provided", () => {
      tidyPlugin.cleanPaths = undefined;
      tidyPlugin.clean(cb);
      expect( cb ).not.toHaveBeenCalled();
    });

    it("should throw error if paths aren't valid", () => {
      tidyPlugin.cleanPaths = '   ';
      expect( () => { tidyPlugin.clean(cb); } ).toThrow();

      tidyPlugin.cleanPaths = '/fu/bar /root/bad/path';
      expect( () => { tidyPlugin.clean(cb); } ).toThrow();
    });

    it('should remove files for specified paths', () => {
      const badPath = '/root/bad/path/';
      const goodPath = './fu/bar/';
      let execCB;
      tidyPlugin.cleanPaths = `${ badPath } ${ goodPath }`;
      childProcess.exec.mockImplementation((cmd, eCB) => {
        execCB = eCB;
      });

      tidyPlugin.clean(cb);
      execCB();
      expect( cb ).toHaveBeenCalled();
      expect( () => { execCB(new Error('fake error')); } ).toThrow();

      tidyPlugin.clean();
      expect( () => { execCB(); } ).toThrow();
    });
  });
});
