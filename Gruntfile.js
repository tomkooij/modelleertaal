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

      // run the mocha tests via Node.js
      mochaTest: {
          test: {
            options: {
              reporter: 'spec'
            },
            src: ['test/**/*.js']
          }
      },
      jison: {
          my_parser : {
              files: { 'modelleertaal.js': 'modelleertaal.jison' }
            }
      }
    });
  /// Load plug-ins
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-mocha-test');
  grunt.loadNpmTasks('grunt-jison');

  // define tasks
  grunt.registerTask('build', [
    'jison',
  ]);

  grunt.registerTask('test', [
    'jshint',
    'mochaTest',
  ]);
  grunt.registerTask('default', [
    'build',
    'test',
  ]);
};
