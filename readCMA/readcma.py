"""
readCMA.py

read Coach 6 model bestand
extract modelregels / startwaarden

fileinfo:

header = 'CMA ' (4 bytes hex: 43 4D 41 20)

elke "sectie" start met:
  hex '00 00 00 00 00 00 00 0E 00 00 00 00 ' 12 bytes

    header = "xxNaamyy" waarin xx (1 byte) lengte vd naam (in bytes)
    en yy de lengte van de volgende sectie. (Soms 00 31 xx = lange sectie?)

    voorbeeld = hex "09 4D 6F 64 65 6C 42 6F 64 79 7C"
    09 bytes = "Modelbody" lengte 7C bytes (124 bytes)

    ModelBody ==> modelregels
    ModelInit ==> startwaarden

"""

FILENAME = '09.cma'

if __name__ == '__main__':
    with open(FILENAME, "rb") as f:
        header = f.read(4)
        assert (header == 'CMA '), "Header != Coach 6 .cma activity file!"

        contents = f.read()

        parts = contents.split('\x00\x00\x00\x00\x00\x00\x00\x0E\x00\x00\x00\x00')

        for part in parts:
            if part[1:10] == 'ModelInit':
                modelinit = part[25:-1]
            if part[1:10] == 'ModelBody':
                modelbody = part[25:-1]

    # output bogusXML to stdout
    print "<model>"
    print "<startwaarden>"
    print modelinit
    print "</startwaarden>"
    print "<modelregels>"
    print modelbody
    print "</modelregels>"
    print "</model>"
