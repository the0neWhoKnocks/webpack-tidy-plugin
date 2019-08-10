const { resolve } = require('path');
const yargs = require('yargs');
const webpack = require('webpack');
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

const hashLength = 8;
const conf = {
  context: resolve(__dirname, '../'),
  entry: {
    'app': [
      './src/app',
    ],
    'vendor': [
      'hyperapp',
      'regenerator-runtime/runtime',
      'svg.js',
    ],
  },
  output: {
    filename: `./public/js/[name].[chunkhash:${ hashLength }].js`,
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
      dryRun: true,
      hashLength,
    }),
    new ExtractTextPlugin(`./public/css/[name].[chunkhash:${ hashLength }].css`),
    new webpack.optimize.CommonsChunkPlugin({
      name: 'vendor',
      minChunks: Infinity,
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
  resolve: {
    // ensure any symlinked paths resolve to current repo
    symlinks: false,
  },
  stats: {
    chunks: false,
    colors: true,
    modules: false,
  },
  watch: flags.dev,
};

module.exports = conf;
