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

  In Pascal:
    If (a = 0) AND !(b = True) then Halt(0);

  Real world example (SysNat model 9):
    'model 9 parachutesprong
    'modelregels
    Fwr = k * v^2
    Fres = Fzw - Fwr
    a = Fres/m
    dv = a * dt
    v = v + dv
    dy = v * dt
    y = y + dy
    h = h0 - y
    t = t + dt
    als h < 400 dan k = 0.6 * (400 - h) eindals
    als h < 350 dan k = 30 eindals
 */

%lex
%options case-insensitive

%%

\s+                                     /* ignore whitespaces */
\t+                                     /* ignore whitespaces */
"'"[^\n]*                               /* modelleertaal comment */
"/*"(.|\n|\r)*?"*/"                     /* C-style multiline comment */
"//"[^\n]*                              /* C-style comment */
"#"[^\n]*                               /* Python style comment */

"("                                     return '('
")"                                     return ')'

"pi"                                    return 'PI'
"π"                                     return 'PI'

// logical
"=="                                    return '=='
">="                                    return '>='
"<="                                    return '<='
">"                                     return '>'
"<"                                     return '<'

"!"|niet                                return 'NOT'
onwaar                                  return 'FALSE'
waar                                     return 'TRUE'

// assign value to var
"="                                     return 'ASSIGN'
":="                                    return 'ASSIGN'

// number (floats) form openscad.jison
[0-9]*["."","][0-9]+([Ee][+-]?[0-9]+)?       return 'NUMBER'
[0-9]+["."","][0-9]*([Ee][+-]?[0-9]+)?       return 'NUMBER'
[0-9]+([Ee][+-]?[0-9]+)?                return 'NUMBER'


// math
"^"                                     return '^'
"+"                                     return '+'
"-"                                     return '-'
"*"                                     return '*'
"/"                                     return '/'

// flow control
eindals                                 return 'ENDIF'
als                                     return 'IF'
dan                                     return 'THEN'
stop                                    return 'STOP'
anders                                  return 'ELSE'

// identifiers
[a-zA-Z\x7f-\uffff][a-zA-Z\x7f-\uffff0-9_"\]""\|"{}"["]*                return 'IDENT'

// blank item, to be filled in by user. Throw custom error on this
"..."                                   return 'BLANK'
"…"                                     return 'BLANK'

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
%right UMINUS


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
  | IF condition THEN stmt_list ELSE stmt_list ENDIF
    { $$ = {
              type: 'IfElse',
              cond: $2,
              then: $4,
              elsestmt: $6
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

direct_declarator
  : IDENT
      { $$ = {
                  type: 'Variable',
                  name: yytext
              };
          }

  | IDENT '(' expr ')'
      {$$ = {
              type: 'Function',
              func: $1,
              expr: $3
      };
  }
  ;

expr
  : direct_declarator
    {$$ = $1;}

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

  | '-' expr
            {$$ = {
                  type: 'Unary',
                  operator: '-',
                  right: $2
            };
          }
  | '+' expr
            {$$ = {
                  type: 'Unary',
                  operator: '+',
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

  | PI
      {$$ = {
              type: 'Number',
              value: "3.14159265359"
          };
       }

  | BLANK
      {$$ = {
              type: 'Blank',
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
