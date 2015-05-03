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
   Wetenschappelijke notatie voor floats (1E+9) (gedaan? via openscad.jison)
   SysNat gebruikt de komma "," ipv "." voor floats. Inbouwen?
   SysNat gebruikt 'modelregels en 'startwaarden als soort van keywords
   Logische expressies
   Als Dan (EindAls)
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

// assign value to var
"="                                     return 'ASSIGN'
":="                                    return 'ASSIGN'

// number (floats) form openscad.jison 
[0-9]*"."[0-9]+([Ee][+-]?[0-9]+)?       return 'NUMBER'
[0-9]+"."[0-9]*([Ee][+-]?[0-9]+)?       return 'NUMBER'
[0-9]+([Ee][+-]?[0-9]+)?                return 'NUMBER'

// identifiers
[a-zA-Z]+                               { return 'IDENT'; }

// math
"+"                                     { return '+'; }

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

%left '+'

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
                type: 'Assign',
                arguments: [
                    $1,
                    $3
                ]
            };
        }

  | SHOW expr
    { $$ = {
                type: 'Show',
                arguments: [$2]
            };
        }
  ;

expr
  : IDENT
    { $$ = {
                type: 'Identifier',
                name: yytext
            };
        }

  | NUMBER
    {$$ = {
                type: 'number',
                arguments: [$1]
            };
         }
  | expr '+' expr
    {$$ = {
                type: 'addition',
                arguments: [
                    $1,
                    $3
                ]
          };
        }
    ;
