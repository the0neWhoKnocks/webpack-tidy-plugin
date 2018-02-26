const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const glob = require('glob');
const rimraf = require('rimraf');
const TidyPlugin = require('./TidyPlugin');

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
  const outputDir = `${ path.resolve(__dirname, '../').replace(/\\/g, '/') }/.jest/__tidy__`;
  let compiler, opts, eventCallbacks, tidyPlugin;

  beforeAll(() => {
    if( !fs.existsSync(outputDir) ) fs.mkdirSync(outputDir);
  });
  afterAll(() => {
    rimraf(outputDir, (err) => {
      if(err) throw err;
    });
  });

  beforeEach(() => {
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

  it('should store passed opts', () => {
    tidyPlugin = new TidyPlugin(opts);

    for( let prop in opts ){
      expect( tidyPlugin[prop] ).toBeDefined();
    }
  });

  it('should set up after-emit listener', () => {
    tidyPlugin = new TidyPlugin(opts);
    tidyPlugin.apply(compiler);

    expect( eventCallbacks['after-emit'] ).toEqual( expect.any(Function) );
  });

  describe('after-emit', () => {
    let afterEmit, compilation, cb, oldHash;

    beforeEach(() => {
      oldHash = randomHash(opts.hashLength);
      compilation = {
        hash: randomHash(opts.hashLength),
      };
      cb = jest.fn();
      tidyPlugin = new TidyPlugin(opts);
      tidyPlugin.apply(compiler);
      afterEmit = eventCallbacks['after-emit'];
    });

    it("shouldn't try to delete anything if no assets were generated", () => {
      jest.doMock('glob', () => jest.genMockFromModule('glob'));
      const glob = require('glob');

      afterEmit(compilation, cb);

      expect( glob.sync ).not.toHaveBeenCalled();
      expect( cb ).toHaveBeenCalled();

      glob.mockRestore();
    });

    it('should set up after-emit listener', () => {
      const oldFileName = `app.${ oldHash }.js`;
      fs.closeSync(fs.openSync(`${ outputDir }/${ oldFileName }`, 'w'));
      const newFileName = `app.${ compilation.hash }.js`;
      const newFile = `${ outputDir }/${ newFileName }`;
      fs.closeSync(fs.openSync(newFile, 'w'));
      const origFiles = glob.sync('./*.js', {
        cwd: outputDir,
      });
      compilation.assets = {
        [`${ outputDir }/${ newFileName }`]: {
          emitted: true,
        },
      };

      // check that temp files are there
      expect( origFiles.length > 1 ).toBe(true);

      afterEmit(compilation, () => {
        // check that only the new file remains
        const remaining = glob.sync('./*.js', {
          cwd: path.resolve(outputDir).replace(/\\/g, '/'),
        });

        expect( remaining.length ).toEqual(1);
        expect( remaining[0] ).toEqual( `./${ newFileName }` );
      });
    });
  });

  // TODO - finish up tests
});
