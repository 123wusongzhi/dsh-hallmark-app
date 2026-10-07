"""Verify document traceability/files only. This is NOT a DSH/product test runner."""
from pathlib import Path
import json, csv, hashlib, re
R=Path(__file__).resolve().parents[1]
m=json.loads((R/'validation/audit-model.json').read_text())
assert len(m['requirements'])==32 and len(m['tasks'])==24 and len(m['baseline'])==48
rs={int(x['id'][-3:]) for x in m['requirements']}; ts={int(x['id'][-3:]) for x in m['tasks']}
for r in m['requirements']: assert set(r['tasks'])<=ts and r['tasks']
for t in m['tasks']: assert set(t['deps'])<=ts
adj={int(x['id'][-3:]):x['deps'] for x in m['tasks']}; done=set(); active=set()
def visit(n):
    assert n not in active, ('dependency cycle',n)
    if n in done:return
    active.add(n)
    for q in adj[n]:visit(q)
    active.remove(n);done.add(n)
for n in adj:visit(n)
for g in m['findings']: assert set(g['reqs'])<=rs and set(g['tasks'])<=ts
rows=list(csv.DictReader((R/'validation/traceability_80.csv').open(encoding='utf-8-sig')))
assert len(rows)==80 and len({r['requirementId'] for r in rows})==80
assert all(r['currentRunStatus']=='NOT_RUN' for r in rows)
for d in (R/'templates').glob('*.json'):json.loads(d.read_text())
for f in json.loads((R/'evidence/input-manifest.json').read_text())['files']:
    p=R/f['path'];assert p.is_file();assert hashlib.sha256(p.read_bytes()).hexdigest()==f['sha256']
for p in (R/'docs').glob('*.md'):
    text=p.read_text()
    assert not re.search(r'REQ-(?:08[1-9]|09[0-9])',text), p
    for link in re.findall(r'\]\(([^)]+)\)',text):
        if link.startswith(('http:','https:','#')):continue
        assert (p.parent/link.split('#')[0]).exists(), (p,link)
print(json.dumps({'scope':'DOCUMENT_PACKAGE_ONLY','status':'PASS','requirements':80,'newTasks':24,'auditItems':20,'productTestRuns':0},ensure_ascii=False))
