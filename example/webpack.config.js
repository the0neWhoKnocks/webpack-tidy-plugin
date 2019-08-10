const { resolve } = require('path');
const yargs = require('yargs');
const WebpackAssetsManifest = require('webpack-assets-manifest');
const TidyPlugin = require('@noxx/webpack-tidy-plugin');

// =============================================================================

yargs
  .option('d', {
    alias: 'dev',
    desc: 'Runs in Dev mode',
    type: 'boolean',
  })
  .argv;

const flags = yargs.parse();

// =============================================================================

const PUBLIC_PATH = '/js/';
const hashLength = 8;
const conf = {
  entry: {
    'app': [
      './src/app',
    ],
    'vendor': [
      'regenerator-runtime/runtime',
    ],
  },
  output: {
    path: `${ resolve(__dirname, './public') }${ PUBLIC_PATH }`,
    publicPath: PUBLIC_PATH,
    filename: `[name]_[chunkhash:${ hashLength }].js`,
  },
  plugins: [
    new TidyPlugin({
      dryRun: true,
      hashLength,
    }),
    new WebpackAssetsManifest({
      customize: (key, val) => {
        return {
          key,
          value: val.replace('public/', ''),
        };
      },
      output: './public/manifest.json',
      publicPath: '/',
      writeToDisk: true,
    }),
  ],
  stats: {
    modules: false,
  },
  watch: flags.dev,
};

module.exports = conf;
