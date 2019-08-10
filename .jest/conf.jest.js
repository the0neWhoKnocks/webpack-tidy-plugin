const path = require('path');

const conf = {
  automock: false,
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.{js}',
  ],
  coverageReporters: [
    'html',
    'json',
    'lcov',
    'text-summary',
  ],
  coverageThreshold: {
    global: {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
  },
  moduleFileExtensions: [ 'js' ],
  rootDir: path.resolve(__dirname, '../'),
  roots: ['src'],
  testEnvironment: 'node',
};

module.exports = conf;
