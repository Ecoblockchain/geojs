// Defines a test server for running jasmine unit tests
// with coverage support.

// share configuration with the main webpack builder
var webpack_config = require('./webpack.config');

module.exports = function (config) {
  config.set({
    files: [
      'tests/cases/**/*.js'
    ],
    browsers: [
      'PhantomJS'
    ],
    reporters: [
      'progress',
      'kjhtml'
    ],
    preprocessors: {
      'tests/cases/**/*.js': ['webpack', 'sourcemap']
    },
    frameworks: [
      'jasmine'
    ],
    webpack: {
      cache: true,
      devtool: 'inline-source-map',
      module: {
        loaders: webpack_config.module.loaders
      },
      resolve: webpack_config.resolve
    }
  });
};
