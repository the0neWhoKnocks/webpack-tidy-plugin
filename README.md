# Webpack Tidy Plugin

[![Build Status](https://travis-ci.org/the0neWhoKnocks/webpack-tidy-plugin.svg?branch=master)](https://travis-ci.org/the0neWhoKnocks/webpack-tidy-plugin)
[![codecov](https://codecov.io/gh/the0neWhoKnocks/webpack-tidy-plugin/branch/master/graph/badge.svg)](https://codecov.io/gh/the0neWhoKnocks/webpack-tidy-plugin)
[![npm version](https://badge.fury.io/js/%40noxx%2Fwebpack-tidy-plugin.svg?cb=1)](https://badge.fury.io/js/%40noxx%2Fwebpack-tidy-plugin)

**TL;DR** - Keeps your output directories tidy when outputting files in watch-mode.

![wp-tidy-plugin-01](https://user-images.githubusercontent.com/344140/36881882-82d68602-1d85-11e8-8989-170c5b3f1ed9.gif)

Imagine you have a project utilizing a node server that serves assets from a
specific directory - **_and_** you want to use Webpack to rebuild bundles quickly
but don't want to have those assets served via the Webpack server. Well, you'll
most likely have WP output a manifest with the generated files, and the server
will read from that to load the most current hashed bundle.

The catch to the above setup, is that you'll end up with a folder full of
generated files while in watch mode, or when you run a one-off build (say for
production) you may have some straggling files from a previous dev session.

This plugin will ensure that there's only ever one version of the current bundle
in your output directories.

---

## Install

```sh
yarn add -D @noxx/webpack-tidy-plugin
# or
npm i -D @noxx/webpack-tidy-plugin
```

---

## Configuration

You can see how everything's hooked up in the [webpack.config.js file](./example/webpack.config.js).

```js
plugins: [
  new TidyPlugin({
    cleanPaths: './public/js/* ./public/css/*',
    hashLength,
    watching: true,
  }),
],
```

| Prop         | Type      | Description |
| ------------ | --------- | ----------- |
| `cleanPaths` | `String`  | A string containing one or multiple (space separated) patterns for the `rm -f` command to run during a one-off build. |
| `hashLength` | `Number`  | The length of the hash in the bundle name. |
| `watching`   | `Boolean` | Whether or not Webpack is watching for changes. |

---

## Notes

- This only works when using the `watch` option for `webpack`, _not_
while using the `webpack-dev-server`. This is due to the dev-server not
emitting actual files, but rather keeping them in memory.

- This plugin utilizes `glob`, so it's dependent on matching path structures. By
that, I mean if you configure the plugin with `cleanPaths: './dist/js/*'`, then
the `filename` in `output` should start with `./dist/js` so that it can
accurately locate and match files.

Note that in the below example, I'm not using `path` in the `output`. The full
path should be in `filename`, otherwise the proper data isn't passed along to
the `emit` event.

```js
// conf.js (at root)
const conf = {
  paths: {
    OUTPUT: './dist',
  },
};

// =======================================

// webpack.config.js
const appConfig = require('./conf');
const TidyPlugin = require('@noxx/webpack-tidy-plugin');

const conf = {
  // ...
  output: {
    // make path relative
    filename: `${ appConfig.paths.OUTPUT }/js/[name]_[hash:8].js`,
  },
  plugins: [
    new TidyPlugin({
      // make path relative
      cleanPaths: `${ appConfig.paths.OUTPUT }/js/*`,
      hashLength,
      watching: process.env.NODE_ENV === 'development',
    }),
  ],
};
```
