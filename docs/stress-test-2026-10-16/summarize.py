"""Summarize saved JUnit evidence without dependencies or secrets."""

import json
from collections import Counter
from pathlib import Path
from xml.etree import ElementTree

folder = Path(__file__).resolve().parent
results = {}
for name in ("pytest.xml", "stress.xml", "p7-isolated.xml", "session-isolated.xml", "queue-order.xml"):
    path = folder / name
    if not path.exists():
        continue
    root = ElementTree.parse(path).getroot()
    suite = root.find("testsuite")
    cases = list(root.iter("testcase"))
    failures = []
    for case in cases:
        for kind in ("failure", "error"):
            item = case.find(kind)
            if item is not None:
                failures.append({"test": case.attrib["classname"] + "::" + case.attrib["name"],
                                 "kind": kind, "message": item.attrib.get("message"), "detail": item.text})
    results[name] = {"totals": suite.attrib,
                     "by_module": dict(sorted(Counter(c.attrib["classname"] for c in cases).items())),
                     "failures": failures}
print(json.dumps(results, indent=2))
