import subprocess,os,json
from pathlib import Path
env={**os.environ,'NODE_ENV':'production','TZ':'UTC'}
subprocess.run(['node','verify-review.mjs'],check=True,env=env)
for arm in ['baseline','combined']:
 result=subprocess.run(['node','E-worker.cjs','E-'+arm,'267','regression'],env=env,capture_output=True,text=True,check=True)
 Path('E-'+arm+'-parity.json').write_text(result.stdout)
a=json.load(open('E-baseline-parity.json'));b=json.load(open('E-combined-parity.json'))
checks=[]
assert len(a['results'])==len(b['results'])
for x,y in zip(a['results'],b['results']):
 x.pop('counts');y.pop('counts');assert x==y,x['label'];checks.append(x['label'])
outputs=[]
for workload in ['platform','application-default','application-explicit']:
 for arm in ['baseline','combined']:
  dest=f'O-{workload}-{arm}-parity.json'
  with open(f'O-{workload}-{arm}.log','w') as log:
   subprocess.run(['node','O-'+arm+'.mjs','mode=parity','size=267','page=10','iterations=6',f'workload={workload}',f'output={dest}'],env=env,check=True,stdout=log)
 a=json.load(open(f'O-{workload}-baseline-parity.json'));b=json.load(open(f'O-{workload}-combined-parity.json'))
 for key in ['frames','behavior','providerResults']:assert a[key]==b[key],(workload,key)
 for key in ['fixture','frameHashes','requestCount','requests','events','behaviorCount','behaviorHash']:assert a['output'][key]==b['output'][key],(workload,key)
 outputs.append({'workload':workload,'fixture':a['output']['fixture'],'frames':len(a['frames']),'behaviorCases':len(a['behavior']),'behaviorHash':a['output']['behaviorHash'],'requests':a['output']['requestCount'],'events':a['output']['events'],'providerStages':[stage['name'] for stage in a['providerResults']],'identical':'complete frames, provider payloads, formatted outcomes and callback/request sequences'})
for arm in ['baseline','combined']:
 subprocess.run(['node',f'coupled-{arm}.mjs','mode=parity','size=267','page=10','iterations=2','workload=collection-loaded',f'output=collection-{arm}-parity.json'],env=env,check=True)
a=json.load(open('collection-baseline-parity.json'));b=json.load(open('collection-combined-parity.json'))
for key in ['fixture','actionLabels','fullFrames','frames','requests','events']:assert a[key]==b[key],('collection-loaded',key)
out={'E':{'cases':len(checks),'labels':checks,'identical':'complete filtered IDs, visible rows, rendered tree, pagination, selection and query callback sequence'},'O':outputs,'collection':{'fixture':a['fixture'],'frames':len(a['fullFrames']),'actionsPerCycle':len(a['actionLabels']),'requests':len(a['requests']),'identical':'complete coupled host trees with candidate70 record/store filtering and listedIn status lines'},'mode':'production React test renderer; not browser layout/paint'}
Path('review-summary.json').write_text(json.dumps(out,indent=2,ensure_ascii=False));print(json.dumps(out,ensure_ascii=False))
