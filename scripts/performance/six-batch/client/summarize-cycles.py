"""Add independent-process ABBA, cold mount, CPU and RSS details to client results."""
import json,statistics,sys
from pathlib import Path
root=Path(sys.argv[1] if len(sys.argv)>1 else '.')
summary=json.loads((root/'coupled-summary.json').read_text())
for case in summary['results']:
    records=[]
    for cycle in range(5):
        for phase,arm in enumerate(['baseline','combined','combined','baseline']):
            p=root/f"coupled-{case['workload']}-{case['size']}-{case['pageSize']}-c{cycle}-p{phase}-{arm}.json"
            row=json.loads(p.read_text())
            whole=[sum(s['ms'] for s in row['samples'] if s['iteration']==i) for i in range(3,15)]
            records.append({'cycle':cycle+1,'phase':phase,'arm':arm,'medianMs':statistics.median(whole),'coldMs':row['coldMs'],'cpuMs':sum(row['totalCpu'].values())/1000,'rssMiB':row['memoryAfterCycles']['rss']/1024**2})
    cycles=[]
    for cycle in range(1,6):
        b=statistics.median(r['medianMs'] for r in records if r['cycle']==cycle and r['arm']=='baseline')
        c=statistics.median(r['medianMs'] for r in records if r['cycle']==cycle and r['arm']=='combined')
        cycles.append({'cycle':cycle,'baselineMs':b,'combinedMs':c,'reductionPct':(1-c/b)*100})
    case['cycles']=cycles
    case['allCyclesImproved']=all(r['reductionPct']>0 for r in cycles)
    case['processes']=records
    case['resourceMedians']={arm:{field:statistics.median(r[field] for r in records if r['arm']==arm) for field in ['coldMs','cpuMs','rssMiB']} for arm in ['baseline','combined']}
summary['method']='Nine client shapes; five ABBA cycles each; 180 independent production-React processes; 15 action cycles (six actions for procurement, thirteen for collection records) with first 3 excluded. Whole-cycle metric is actual action duration sum, not summed percentages. Collection267 is synthetic already-loaded stress beyond current single-page limit; 10-row control is also retained.'
(root/'coupled-detailed-summary.json').write_text(json.dumps(summary,indent=2)+'\n')
for case in summary['results']:
    whole=next(r for r in case['scenarios'] if r['label']=='whole-cycle')
    print(case['workload'],case['size'],case['pageSize'],round(whole['baseline']['processMedianMs'],3),round(whole['combined']['processMedianMs'],3),round(whole['reductionPct'],2),case['allCyclesImproved'])
