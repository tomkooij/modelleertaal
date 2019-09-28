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
          '!js/*',
          '!scripts/*'
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
      },

      // dit moet equivalent zijn aan:
      //   browserify SCRIPT.js -d -s SCRIPT_js -o /dist/SCRIPT_browserfied.js

      browserify: {
 			 build: {
 				files: {
 					'scripts/modelleertaal-app.browser.js': ['modelleertaal-app.js']
 				},
 				options: {
 					browserifyOptions: {
 						standalone: 'modelleertaalapp_js',
            //transform: ['browserify-shim'],
          },
        }
 			},

 		},

    });

  /// Load plug-ins
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-mocha-test');
  grunt.loadNpmTasks('grunt-jison');
  grunt.loadNpmTasks('grunt-browserify');

  // define tasks
  grunt.registerTask('build', [
    'jison',
    'browserify'
  ]);

  grunt.registerTask('test', [
    'jshint',
    'mochaTest',
  ]);
  grunt.registerTask('devtest', [
    'build',
    'mochaTest',
  ]);
  grunt.registerTask('default', [
    'build',
    'test',
  ]);
};
