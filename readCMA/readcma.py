"""
readCMA.py

read Coach 6 model bestand
extract modelregels / startwaarden
output modelleertaal/bogusXML

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
from __future__ import print_function
import sys

MAGIC = '\x00\x00\x00\x00\x00\x00\x00\x0E\x00\x00\x00\x00'

DEFAULT_INPUT = '09.cma'
DEFAULT_OUTPUT = 'model.xml'

if __name__ == '__main__':
    if len(sys.argv)==2:
        filename = sys.argv[1]
    else:
        filename = DEFAULT_INPUT

    print ('reading: ', filename)

    with open(filename, 'rb') as f:
        header = f.read(4)
        assert (header == 'CMA '), "Header != Coach 6 .cma activity file!"

        contents = f.read()

        parts = contents.split(MAGIC)

        for part in parts:
            if part[1:10] == 'ModelInit':
                modelinit = part[25:-1]
                print ("found startwaarden:", modelinit)
            if part[1:10] == 'ModelBody':
                modelbody = part[25:-1]
                print ("found modelregels:", modelbody)

    outfilename = DEFAULT_OUTPUT

    with open(outfilename, "w") as out_file:
        print ("\nwriting: ", outfilename)

        # output bogusXML
        print ("<model>", file=out_file)
        print ("<startwaarden>", file=out_file)
        out_file.write(modelinit)
        print ("</startwaarden>", file=out_file)
        print ("<modelregels>", file=out_file)
        out_file.write(modelbody)
        print ("</modelregels>", file=out_file)
        print ("</model>", file=out_file)
