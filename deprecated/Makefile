all: build test

build: modelleertaal.js

modelleertaal.js: modelleertaal.jison
	jison modelleertaal.jison

.PHONY: test
test:
	jshint evaluator.js
	jshint run.js
	mocha
