# Webpack Tidy Plugin

[![Build Status](https://travis-ci.org/the0neWhoKnocks/webpack-tidy-plugin.svg?branch=master)](https://travis-ci.org/the0neWhoKnocks/webpack-tidy-plugin)
[![codecov](https://codecov.io/gh/the0neWhoKnocks/webpack-tidy-plugin/branch/master/graph/badge.svg)](https://codecov.io/gh/the0neWhoKnocks/webpack-tidy-plugin)
[![npm version](https://badge.fury.io/js/%40noxx%2Fwebpack-tidy-plugin.svg?cb=1)](https://badge.fury.io/js/%40noxx%2Fwebpack-tidy-plugin)

**TL;DR** - Keeps your output directories tidy when outputting files in
watch-mode (doesn't work when using Webpack's Dev Server).

![wp-tidy-plugin-01](https://user-images.githubusercontent.com/344140/36881882-82d68602-1d85-11e8-8989-170c5b3f1ed9.gif)

Imagine you have a project utilizing a node server that serves assets from a
specific directory - **_and_** you want to use Webpack to rebuild bundles quickly
but don't want to have those assets served via the Webpack server. Well, you'll
most likely have WP output a manifest with the generated files, and the server
will read from that to load the most current hashed bundle.

The catch to the above setup, is that you'll end up with a folder full of
generated files while in watch mode, or when you run a one-off build (say for
production) you may have some straggling files from a previous Dev session.

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

| Prop         | Type      | Default | Description |
| ------------ | --------- | ------- | ----------- |
| `dryRun` | `Boolean` | `false` | Will not delete files, just displays info about what could be deleted. |
| `hashLength` | `Number` | `5` | The length of the hash in the bundle name. |

```js
plugins: [
  new TidyPlugin({
    dryRun: true,
    hashLength: 8,
  }),
],
```

I have a couple [example files](./example) that demonstrate common setups.
- [webpack.config.js](./example/webpack.config.js) utilizes `path`, `publicPath`,
  and `filename` in the `output` section. This setup assumes there'll ever only
  be one `output` directory.
- [webpack.config-nopath.js](./example/webpack.config-nopath.js) allows for a
  more custom `output` setup. You'll notice that there's just a `filename`
  specified with the output path included. Then the `ExtractTextPlugin` pulls
  any styles from the `js` files and dumps them in a `css` path.

---

## Notes

- This only works when using the `watch` option for `webpack`, _not_
while using the `webpack-dev-server`. This is due to the dev-server not
emitting actual files, but rather keeping them in memory.
