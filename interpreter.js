/*
    Interpreter for Modelleertaal (modelregels)
    Simple dynamical models for highschool Physics in NL

    The language is described in modelleertaal.jison

    usage:
      npm install path_to/jison
      node interpreter.js
*/


// CommonJS
var fs = require("fs");
var jison = require("jison");

// input sourcode:
var modelregels = fs.readFileSync("modelregels.txt", "utf8")
var startwaarden = fs.readFileSync("startwaarden.txt", "utf8")

// parser compiled on execution by jison.js
var bnf = fs.readFileSync("modelleertaal.jison", "utf8");
var parser = new jison.Parser(bnf);


// for some reason the jison example uses print()
// this is a lame implemenations to allow:
// print(string) and print("var = ", variable)
function print(string1, string2) {
    if (arguments.length == 1) {
        //console.log(string1)
    } else {
        //console.log(string1, string2)
    }
}



function main () {
    print('*** input ***');
    print(startwaarden);
    print(modelregels);

    var startwaarden_ast = parser.parse(startwaarden);
    var modelregels_ast = parser.parse(modelregels);

    print('*** AST modelregels ***');
    print(JSON.stringify(modelregels_ast, undefined, 4));

    print('')
    var t1 = Date.now();

    interpreter(startwaarden_ast, modelregels_ast);

    var t2 = Date.now();
    console.log("Time: " + (t2 - t1) + "ms");
}

function interpreter(startwaarden_ast, modelregels_ast) {

    /* Interpret AST tree
        :param: startwaarden_ast = array of json ast. Startwaarden to be loaded into namespace
        :param: modelregels_ast = array of json asts. Modelregels to be executed many times
    */


    function parseNode(node) {
        /* parseNode is a recursive function that parses an item
            of the JSON AST. Calls itself to traverse through nodes.

            :param: node = (part of) JSON tree
        */

        // add an extra space to identation for recursive each call
        identation = identation+'  ';

        print(identation+'parseNode: ', node.type);

        switch(node.type) {

            case 'Assignment':
            {
                print(identation+'Assigment recursion');
                var value = parseNode(node.right);
                namespace.Variables[node.left] = value;
                return value;

            }

            case 'Variable':
            {
                print(identation+'Variable recursion');

                if (namespace.Variables.hasOwnProperty(node.name)) {
                    return namespace.Variables[node.name];
                }

                if (namespace.Startwaarden.hasOwnProperty(node.name)) {
                    return namespace.Startwaarden[node.name];
                }

                throw new SyntaxError('Unknown identifier');
            }

            case 'Binary':
            {
                print(identation+'Binary operator recursion');
                print(identation+'Operator = ', node.operator);
                var left = parseNode(node.left);
                var right = parseNode(node.right);
                switch (node.operator) {
                    case '+':
                        return left + right;
                    case '-':
                        return left - right;
                    case '*':
                        return left * right;
                    case '/':
                        return left / right;
                    case '^':
                        return Math.pow(left, right);
                    default:
                        throw new SyntaxError('Unknown binary operator ' + node.operator);
                    }
            }

            case 'Unary':
            {
                print(identation+'Unary operator recursion');
                print(identation+'Operator = ', node.operator);
                var right = parseNode(node.right);
                switch (node.operator) {
                    case '+':
                        return right;
                    case '-':
                        return -right;

                    default:
                        throw new SyntaxError('Unknown unary operator ' + node.operator);
                    }
            }

            case 'Logical':
            {
                print(identation+'Logical operator recursion');
                print(identation+'Operator = ', node.operator);
                var right = parseNode(node.right);
                var left = parseNode(node.left);
                switch (node.operator) {
                    case '==':
                        if (left == right) {
                            return true;
                        } else {
                            return false;
                        }

                    default:
                        throw new SyntaxError('Unknown logical operator ' + node.operator);
                    }
            }

            case 'Flowcontrol':
            {
                print(identation+'Flowcontrol operator recursion');
                print(identation+'Operator = ', node.operator);
                switch (node.operator) {
                    case 'if': {
                        var left = parseNode(node.left);
                        print(identation+'result of if = ', left)
                        if (left) {
                            // execute the tree between then .. endif
                            var right = evaluate(node.right) // this is an AST!
                            return right
                            }
                        return null
                        }
                    default:
                        throw new SyntaxError('Unknown flow control statement' + node.operator);
                    }
            }

            case 'Number':
            {
                print(identation+'return value (Number) =', parseFloat(node.value));
                return parseFloat(node.value);
            }
        } /* switch (node.type) */
    };


    Namespace = function () {
    var  Functions;

        Functions = {
            abs: Math.abs,
            acos: Math.acos,
            asin: Math.asin,
            atan: Math.atan,
            ceil: Math.ceil,
            cos: Math.cos,
            exp: Math.exp,
            floor: Math.floor,
            ln: Math.ln,
            random: Math.random,
            sin: Math.sin,
            sqrt: Math.sqrt,
            tan: Math.tan
        };

        return {
            Startwaarden: {},
            Functions: Functions,
            Variables: {}
        };
    };

    function evaluate(ast) {
    /* Evaluate (part of) AST tree
        :param: ast = array of json asts

    called by interpret() of recursive by itself
    */
        print("*** start evaluate()")
        for (var i = 0; i < ast.length; i++) {
            identation = ''; // string used for identation (debugging)

            print("AST item = ",ast[i])
            var value = parseNode(ast[i]);
            print("item evaluates to ", value);
        }
    };

    var namespace = new Namespace();

    // evaluate startwaarden. Move Variables into Startwaarden
    evaluate(startwaarden_ast);
    namespace.Startwaarden = namespace.Variables;
    namespace.Variables = {};

    for (i=0; i < 1e6; i++) {
        evaluate(modelregels_ast);
    }

    console.log("*** variables at end of execution = ", namespace)

};


main();
