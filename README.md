# Webpack Tidy Plugin

[![Build Status](https://travis-ci.org/the0neWhoKnocks/webpack-tidy-plugin.svg?branch=master)](https://travis-ci.org/the0neWhoKnocks/webpack-tidy-plugin)
[![Coverage Status](https://coveralls.io/repos/github/the0neWhoKnocks/webpack-tidy-plugin/badge.svg?branch=master)](https://coveralls.io/github/the0neWhoKnocks/webpack-tidy-plugin?branch=master)

**TL;DR** - Keeps your output directories tidy when outputting files in watch-mode.

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
    watching: flags.dev,
  }),
],
```

| Prop         | Type      | Description |
| ------------ | --------- | ----------- |
| `cleanPaths` | `String`  | A string containing one or multiple (space separated) patterns for the `rm -f` command to run during a one-off build. |
| `hashLength` | `Number`  | The length of the hash in the bundle name. |
| `watching`   | `Boolean` | Whether or not Webpack is watching for changes. |
