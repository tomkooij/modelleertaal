// installed using this guide:
// https://blog.codecentric.de/en/2014/02/cross-platform-javascript/

'use strict';

module.exports = function(grunt) {

  grunt.initConfig({
      pkg: grunt.file.readJSON('package.json'),

      jshint: {
        files: [
          '*.js',
          '!modelleertaal.js',
          '!*_browserified.js',
          '!jquery*',
          '!Gruntfile.js',
          '!node_modules/**/*',
        ]

      },
    });
  /// Load plug-ins
  grunt.loadNpmTasks('grunt-contrib-jshint');

  // define tasks
  grunt.registerTask('default', [
    'jshint',
  ]);
};
