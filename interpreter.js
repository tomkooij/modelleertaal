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

    print('*** evaluating the AST ***')
    evaluate(ast);

}

function evaluate(ast) {
    function parseNode(node) {
        print('* parseNode: ', node.type);
        print(node);
        // dit is een poging om door de AST te wandelen, maar werkt niet!
        if (node.type == 'Assignment') {
        print('** entering Assigment recursion');
            right = parseNode(node.right);
            print('return value (Assignment) = ', right)
            return right
        }
        if (node.type == 'Addition') {
        print('** entering Addition recursion');
            left = parseNode(node.left);
            right = parseNode(node.right);
            sum = left + right;
            print('return value (Assignment) = ', sum)
            return sum;
        }
        if (node.type == 'Number') {
            var value = parseFloat(node.value)
            print('return value (Number) = ', value)
            return value;
        }
    };

    var value = parseNode(ast[0]);
    print("AST evaluates to ", value);
    return value;
};





main();
