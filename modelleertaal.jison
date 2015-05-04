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
    Als (a = '0') En Niet(b = Waar) Dan Stop       'modelleertaal

  In Pascal this would be:
    If (a = '0') AND !(b = True) then Halt(0);


 This was originally based on git://github.com/zaach/zii-jsconf2010-talk.git

 TODO:
   geen ; nodig
   Numerieke expressies
   Functies (inclusief sin() en cos() )
   Logische expressies
   Als Dan EindAls
   Stop
 */

%lex
%%

\s+                                     /* ignore whitespaces */
\t+                                     /* ignore whitespaces */
"'"[^\n]*                               /* modelleertaal comment */
"/*"(.|\n)*?"*/"                        /* C-style comment */
"//"[^\n]*                              /* C-style comment */
"#"[^\n]*                               /* Python style comment */

"("                                     return '('
")"                                     return ')'

// assign value to var
"="                                     return 'ASSIGN'
":="                                    return 'ASSIGN'

// number (floats) form openscad.jison
[0-9]*"."[0-9]+([Ee][+-]?[0-9]+)?       return 'NUMBER'
[0-9]+"."[0-9]*([Ee][+-]?[0-9]+)?       return 'NUMBER'
[0-9]+([Ee][+-]?[0-9]+)?                return 'NUMBER'

// identifiers
[a-zA-Z]+                               return 'IDENT'

// math
"+"                                     return '+'
"-"                                     return '-'
"*"                                     return '*'
"/"                                     return '/'

// flow control
"Als"                                   return 'IF'
"Dan"                                   return 'THEN'
"EindAls"                               return 'ENDIF'

// termination
";"                                     return ';'

"\'modelregels"                         return 'STARTMODEL' /* SysNat */
"\'startwaarden"                        return 'INITALCONDITIONS' /* SysNat */

<<EOF>>                                 return 'EOF'

/lex

/* operator associations and precedence */
%left '+' '-'
%left '*' '/'
%left '^'
%right '!'
%right '%'
%left UMINUS

%%

program
  : stmt_list EOF
    { return($1); }
  ;

stmt_list
  : stmt ';'
    { $$ = [$1]; }
  | stmt_list stmt ';'
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

  ;

expr
  : IDENT
    { $$ = {
                type: 'Variable',
                name: yytext
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

  /* parentheses (in math) are handled in the parser */
  | '(' expr ')'
      {$$ = $2;}

  | NUMBER
      {$$ = {
                  type: 'Number',
                  value: $1
              };
           }
    ;
