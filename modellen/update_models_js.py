"""Werk models.js bij met de .xml-bestanden in deze map en de submappen.

- een nieuw bestand komt achteraan in zijn groep (de groep hoort bij de submap,
  zie GROEP_VAN_MAP); titel = bestandsnaam, sectie = "Opgaven" (in een submap)
- een bestand dat niet meer bestaat, wordt uit models.js gehaald
- de volgorde, titels, groepen en secties in models.js blijven zoals ze zijn:
  pas die met de hand aan in models.js

Starten vanuit de map modellen:  python update_models_js.py
"""

import glob
import os
import re
import shutil

FOLDER_PREFIX = "modellen/"
MODELS_JS = "models.js"

# submap -> groep (eerste keuzelijst in de webapp)
GROEP_VAN_MAP = {
    "": "Examens vwo",
    "b1": "B1 Trillingen en golven",
    "c2": "C2 Energie en arbeid",
    "c3": "C3 Gravitatie",
}

HEADER = """// models.js: de modellen in het keuzemenu. Bijwerken met update_models_js.py
// groep:  eerste keuzelijst (verzameling), in deze volgorde
// sectie: kopje binnen de tweede keuzelijst (mag leeg zijn)
var model_index = [
"""

FIELDS = ("title", "url", "groep", "sectie")


def parse_line(line):
    """{title: "Bungeejumper", url: "modellen/c2/Bungeejumper.xml", groep: "C2", sectie: ""},
    --> {"title": "Bungeejumper", "url": "modellen/c2/Bungeejumper.xml", "groep": "C2", "sectie": ""}
    """
    return dict(re.findall(r'(\w+):\s*"([^"]*)"', line))


assert parse_line('{title: "Bungeejumper", url: "modellen/c2/Bungeejumper.xml", groep: "C2", sectie: ""},\n') == {
    "title": "Bungeejumper",
    "url": "modellen/c2/Bungeejumper.xml",
    "groep": "C2",
    "sectie": "",
}


def maak_eerste_letter_hoofdletter(s):
    return s[0].upper() + s[1:]


def read_models_js(models_js=MODELS_JS):
    modellen = []
    with open(models_js, encoding="utf-8") as f:
        for line in f:
            entry = parse_line(line)
            if "title" in entry and "url" in entry:
                modellen.append(entry)
    return modellen


def write_models_js(modellen, outfile_fn=MODELS_JS):
    print(f"writing to: {outfile_fn}")
    with open(outfile_fn, "w", encoding="utf-8", newline="\n") as outfile:
        outfile.write(HEADER)
        for entry in modellen:
            fields = ", ".join(f'{k}: "{entry.get(k, "")}"' for k in FIELDS)
            outfile.write("\t\t{" + fields + "},\n")
        outfile.write("];\n")


def xml_bestanden():
    """alle .xml-bestanden, als url: modellen/naam.xml of modellen/c2/naam.xml"""
    paden = glob.glob("*.xml") + glob.glob("*/*.xml")
    return [FOLDER_PREFIX + p.replace(os.sep, "/") for p in paden]


def hernoem_spaties(url):
    """bestandsnamen zonder spaties (een url met spaties werkt niet goed in een link)"""
    if " " not in url:
        return url
    oud = url[len(FOLDER_PREFIX):]
    map_, _, fn = oud.rpartition("/")
    nieuw = (map_ + "/" if map_ else "") + maak_eerste_letter_hoofdletter(fn.replace(" ", "_"))
    print(f"rename: {oud} -> {nieuw}")
    shutil.move(oud, nieuw)
    return FOLDER_PREFIX + nieuw


def nieuw_model(url):
    pad = url[len(FOLDER_PREFIX):]
    map_, _, fn = pad.rpartition("/")
    groep = GROEP_VAN_MAP.get(map_, map_.upper() or GROEP_VAN_MAP[""])
    titel = maak_eerste_letter_hoofdletter(fn[:-4].replace("_", " "))
    return {"title": titel, "url": url, "groep": groep, "sectie": "Opgaven" if map_ else ""}


def voeg_toe(modellen, entry):
    """achteraan in zijn groep (of achteraan de lijst, voor een nieuwe groep)"""
    laatste = max((i for i, m in enumerate(modellen) if m.get("groep") == entry["groep"]), default=len(modellen) - 1)
    modellen.insert(laatste + 1, entry)


def main():
    modellen = read_models_js()
    bestanden = set(xml_bestanden())

    for entry in list(modellen):
        if entry["url"] not in bestanden:
            print(f"file not found: {entry['url']}: skipping.")
            modellen.remove(entry)

    bekend = {m["url"] for m in modellen}
    for url in sorted(bestanden - bekend):
        url = hernoem_spaties(url)
        print(f"new file: {url}")
        voeg_toe(modellen, nieuw_model(url))

    write_models_js(modellen)


if __name__ == "__main__":
    main()
