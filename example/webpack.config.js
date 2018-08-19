const { resolve } = require('path');
const yargs = require('yargs');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
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
  module: {
    rules: [
      {
        test: /\.styl$/,
        use: ExtractTextPlugin.extract({
          fallback: 'style-loader',
          use: ['css-loader', 'stylus-loader'],
        }),
      },
    ],
  },
  plugins: [
    new TidyPlugin({
      cleanOutput: true,
      hashLength,
    }),
    new ExtractTextPlugin(`./public/css/[name].[chunkhash:${ hashLength }].css`),
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
