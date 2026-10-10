import json,subprocess,statistics,time,os
from pathlib import Path
start=time.time();env={**os.environ,'NODE_ENV':'production'};summary=[]
for size,page in [(10,10),(76,10),(267,10),(1000,10),(267,20)]:
 groups={'baseline':[],'combined':[]}
 for cycle in range(5):
  for phase,arm in enumerate(['baseline','combined','combined','baseline']):
   dest=f'coupled-{size}-{page}-c{cycle}-p{phase}-{arm}.json'
   subprocess.run(['node',f'coupled-{arm}.mjs',f'size={size}',f'page={page}','iterations=15',f'output={dest}'],env=env,check=True,capture_output=True)
   groups[arm].append(json.load(open(dest)))
 reference=groups['baseline'][0]
 for rows in groups.values():
  for row in rows:
   for key in ['frames','requests','events']:assert row[key]==reference[key],(size,key)
 item={'size':size,'pageSize':page,'processesPerArm':10,'warmCyclesPerProcess':12,'peakRssBytes':{arm:max(r['memoryAfterCycles']['rss'] for r in rows) for arm,rows in groups.items()},'scenarios':[]}
 for label in ['search-miss','search-sku','search-all','search-clear','sort-price','edit-display','whole-cycle']:
  result={'label':label}
  for arm,rows in groups.items():
   data=[]
   for row in rows:
    values=[s['ms'] for s in row['samples'] if s['iteration']>=3 and s['label']==label] if label!='whole-cycle' else [sum(s['ms'] for s in row['samples'] if s['iteration']==i) for i in range(3,15)]
    data.append(values)
   flat=sorted(v for values in data for v in values)
   result[arm]={'processMedianMs':statistics.median(statistics.median(values) for values in data),'allMedianMs':statistics.median(flat),'p95Ms':flat[int(len(flat)*.95)-1],'samples':len(flat),'cpuMsMedian':statistics.median(sum(s['cpuMs'] for s in row['samples'] if s['iteration']==i and (label=='whole-cycle' or s['label']==label)) for row in rows for i in range(3,15))}
  result['reductionPct']=(1-result['combined']['processMedianMs']/result['baseline']['processMedianMs'])*100;item['scenarios'].append(result)
 summary.append(item);Path('coupled-summary.json').write_text(json.dumps({'elapsedSeconds':time.time()-start,'results':summary},indent=2));print(json.dumps(item),flush=True)
