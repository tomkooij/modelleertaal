/*
 Modelleertaal grammar in jison

 Parses the language used for "natuurkundig modelleren" (dynamical models in
  high school physics in NL). The language is a subset of "CoachTaal" which
  is a Pascal-derivative with the keywords translated into Dutch.

  CoachTaal (and Pascal) use ':=' as the assign keyword. We also allow '='
   because our textbook and exams use '='

  Note that keywords start with a capital (and are in dutch).
  Statements are not ; terminated
  Comments start with '

  Example:
    Als (a == 0) En Niet(b == Waar) Dan Stop       'modelleertaal

  In Pascal this would be:
    If (a = 0) AND !(b = True) then Halt(0);


 This was originally based on git://github.com/zaach/zii-jsconf2010-talk.git

 TODO:
   Functies (inclusief sin() en cos() )
 */

%lex
%%

\s+                                     /* ignore whitespaces */
\t+                                     /* ignore whitespaces */
"'"[^\n]*                               /* modelleertaal comment */
"/*"(.|\n|\r)*?"*/"                     /* C-style multiline comment */
"//"[^\n]*                              /* C-style comment */
"#"[^\n]*                               /* Python style comment */

"("                                     return '('
")"                                     return ')'

// logical
"=="                                    return '=='
">="                                    return '>='
"<="                                    return '<='
">"                                     return '>'
"<"                                     return '<'
"!"|"Niet"|"niet"                       return 'NOT'
"Waar"|"waar"                           return 'TRUE'
"Onwaar"|"onwaar"|"OnWaar"|"False"      return 'FALSE'

// assign value to var
"="                                     return 'ASSIGN'
":="                                    return 'ASSIGN'

// number (floats) form openscad.jison
[0-9]*"."[0-9]+([Ee][+-]?[0-9]+)?       return 'NUMBER'
[0-9]+"."[0-9]*([Ee][+-]?[0-9]+)?       return 'NUMBER'
[0-9]+([Ee][+-]?[0-9]+)?                return 'NUMBER'


// math
"^"                                     return '^'
"+"                                     return '+'
"-"                                     return '-'
"*"                                     return '*'
"/"                                     return '/'

// flow control
"Als"|"als"                             return 'IF'
"Dan"|"dan"                             return 'THEN'
"EindAls"|"Eindals"|"eindals"           return 'ENDIF'
"Stop"|"stop"                           return 'STOP'

// identifiers
[a-zA-Z]+([a-zA-Z0-9_])?                 return 'IDENT'

<<EOF>>                                 return 'EOF'

/lex

%token IF
%token THEN
%token ENDIF
%token EQUALS

/* operator associations and precedence */
%left '+' '-'
%left '*' '/'
%left '^'
%right NOT
%left UMINUS


%left '=='
%left '<='
%left '<'
%left '>='
%left '>'
%left IF

%%

program
  : stmt_list EOF
    { return($1); }
  ;

stmt_list
  : stmt
    { $$ = [$1]; }
  | stmt_list stmt
    { $1.push($2); $$ = $1; }
  ;

stmt

  : IDENT ASSIGN expr
    { $$ = {
                type: 'Assignment',
                left: $1,
                right: $3

            };
        }

  | IF condition THEN stmt_list ENDIF
    { $$ = {
                type: 'If',
                cond: $2,
                then: $4
            };
        }
  | STOP
     {$$ = {
                 type: 'Stop',
                 value: $1
            };
        }
  ;

condition
  : expr
     {$$ = $1;}
  ;

expr
  : IDENT
    { $$ = {
                type: 'Variable',
                name: yytext
            };
        }

 | expr '==' expr
   {$$ = {
               type: 'Logical',
               operator: '==',
               left: $1,
               right: $3
       };
   }

 | expr '>' expr
  {$$ = {
              type: 'Logical',
              operator: '>',
              left: $1,
              right: $3
      };
  }
  | expr '>=' expr
    {$$ = {
                type: 'Logical',
                operator: '>=',
                left: $1,
                right: $3
        };
    }
  | expr '<' expr
   {$$ = {
               type: 'Logical',
               operator: '<',
               left: $1,
               right: $3
       };
   }
  | expr '<=' expr
      {$$ = {
                  type: 'Logical',
                  operator: '<=',
                  left: $1,
                  right: $3
          };
      }

 | expr '^' expr
      {$$ = {
                 type: 'Binary',
                 operator: '^',
                 left: $1,
                 right: $3
           };
         }
  | expr '+' expr
    {$$ = {
                type: 'Binary',
                operator: '+',
                left: $1,
                right: $3
          };
        }
  | expr '-' expr
     {$$ = {
                 type: 'Binary',
                 operator: '-',
                 left: $1,
                 right: $3
           };
         }
  | expr '*' expr
     {$$ = {
                 type: 'Binary',
                 operator: '*',
                 left: $1,
                 right: $3
           };
         }
  | expr '/' expr
   {$$ = {
               type: 'Binary',
               operator: '/',
               left: $1,
               right: $3
         };
       }

  | '-' expr %prec UMINUS
      {$$ = {
                  type: 'Unary',
                  operator: '-',
                  right: $2
            };
          }
  | NOT expr %prec NOT
    {$$ = {
                type: 'Unary',
                operator: 'NOT',
                right: $2
          };
        }
  }

  /* parentheses are handled in the parser */
  | '(' expr ')'
      {$$ = $2;}

  | NUMBER
      {$$ = {
                  type: 'Number',
                  value: $1
              };
           }
  | TRUE /* There must be a better way... */
      {$$ = {
                type: 'True',
                value: $1
            };
         }
  | FALSE
      {$$ = {
                type: 'False',
                value: $1
            };
         }

  ;
