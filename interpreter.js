// myparser.js
var fs = require("fs");
var jison = require("jison");

var bnf = fs.readFileSync("modelleertaal.jison", "utf8");
var parser = new jison.Parser(bnf);

module.exports = parser;

// the original grammar.js include is below:
// var parser = require('./grammar').parser;

var program = fs.readFileSync("model.txt", "utf8")

// for some reason the jison example uses print()
//  I can't find it in my CommonJS. Define it.
function print(string) {
    console.log(string);
}


function main () {

    print('*** input ***');
    print(program);

    var ast = parser.parse(program);

    print('*** AST ***');
    print(ast);

    evaluate(ast);

    //source = codegen(ast);
    //print('*** generated source');
    //print(source);
}

var evaluate = function (parseTree) {
  var parseNode = function (node) {
      print('* parseNode!');
      print(node);
  };
  var output = "";
  for (var i = 0; i < parseTree.length; i++) {
    var value = parseNode(parseTree[i]);
    if (typeof value !== "undefined") output += value + "\n";
  }
  return output;
};




main();
