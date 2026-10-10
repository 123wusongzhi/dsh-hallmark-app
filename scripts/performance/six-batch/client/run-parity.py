import subprocess,os,json,hashlib
from pathlib import Path
env={**os.environ,'NODE_ENV':'production'}
for arm in ['baseline','combined']:
 result=subprocess.run(['node','E-worker.cjs','E-'+arm,'267','regression'],env=env,capture_output=True,text=True,check=True)
 Path('E-'+arm+'-parity.json').write_text(result.stdout)
 subprocess.run(['node','O-'+arm+'.mjs','mode=parity','size=267','page=10','iterations=6','output=O-'+arm+'-parity.json'],env=env,check=True,stdout=open('O-'+arm+'.log','w'))
a=json.load(open('E-baseline-parity.json'));b=json.load(open('E-combined-parity.json'))
checks=[]
for x,y in zip(a['results'],b['results']):
 x.pop('counts');y.pop('counts');assert x==y,x['label'];checks.append(x['label'])
assert len(a['results'])==len(b['results'])
a=json.load(open('O-baseline-parity.json'));b=json.load(open('O-combined-parity.json'))
for key in ['frames','behavior']:assert a[key]==b[key],key
for key in ['frameHashes','requestCount','requests','events','behaviorCount','behaviorHash']:assert a['output'][key]==b['output'][key],key
out={'E':{'cases':len(checks),'labels':checks,'identical':'complete filtered IDs, visible rows, rendered tree, pagination, selection and query callback sequence'},'O':{'frames':len(a['frames']),'behaviorCases':len(a['behavior']),'behaviorHash':a['output']['behaviorHash'],'requests':a['output']['requestCount'],'events':a['output']['events'],'identical':'complete frames and every formatted outcome, scale/currency changes, cache eviction, mutable row, constructor replacement failure and restoration'},'mode':'production React test renderer; not browser layout/paint'}
Path('review-summary.json').write_text(json.dumps(out,indent=2,ensure_ascii=False));print(json.dumps(out,ensure_ascii=False))
