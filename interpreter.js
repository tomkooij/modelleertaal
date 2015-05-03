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
// this is a lame implemenations to allow:
// print(string) and print("var = ", variable)
function print(string1, string2) {
    if (arguments.length == 1) {
        console.log(string1)
    } else { console.log(string1, string2) }
}


function main () {

    print('*** input ***');
    print(program);

    var ast = parser.parse(program);

    print('*** AST ***');
    print(ast);

    print('')
    evaluate(ast);

}

function evaluate(ast) {
    function parseNode(node) {
        // add an extra space to identation for recursive each call
        identation = identation+'  ';

        print(identation+'parseNode: ', node.type);
        // dit is een poging om door de AST te wandelen, maar werkt niet!
        if (node.type == 'Assignment') {
        print(identation+'Assigment recursion');
            var right = parseNode(node.right);
            print(identation+'return value (Assignment) = ', right)
            return right
        }
        if (node.type == 'Addition') {
        print(identation+'Addition recursion');
            var left = parseNode(node.left);
            var right = parseNode(node.right);
            sum = left + right;
            print(identation+'return value (Addition) = ', sum)
            return sum;
        }
        if (node.type == 'Multiplication') {
        print(identation+'Multiplication recursion');
            var left = parseNode(node.left);
            var right = parseNode(node.right);
            result = left * right;
            print(identation+'return value (Multiplication) = ', result)
            return result;
        }
        if (node.type == 'Number') {
            print(identation+'return value (Number) =', parseFloat(node.value));
            return parseFloat(node.value);
        }
    };



    print("***** Start evaluation of AST *** ")
    for (var i = 0; i < ast.length; i++) {
        identation = ''; // string used for identation (debugging)
        print("AST item = ",ast[i])
        print("*** start evaluate()")
        var value = parseNode(ast[i]); }
        print("item evaluates to ", value);

};





main();
