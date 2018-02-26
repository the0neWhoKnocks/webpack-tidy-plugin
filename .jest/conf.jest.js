const path = require('path');

const conf = {
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.{js}',
    '!**/coverage/**',
  ],
  coverageReporters: [
    'html',
    'text-summary',
  ],
  // TODO - uncomment once tests are done
  // coverageThreshold: {
  //   global: {
  //     branches: 100,
  //     functions: 100,
  //     lines: 100,
  //     statements: 100,
  //   },
  // },
  moduleFileExtensions: [ 'js' ],
  rootDir: path.resolve(__dirname, '../'),
  roots: ['src'],
  testEnvironment: 'node',
};

module.exports = conf;
