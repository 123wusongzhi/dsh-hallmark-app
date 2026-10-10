import argparse,json,subprocess,pathlib,statistics,time
p=argparse.ArgumentParser();p.add_argument('--old',required=True);p.add_argument('--new',required=True);p.add_argument('--label',required=True);p.add_argument('--sizes',nargs='+',default=['tiny','medium']);p.add_argument('--cycles',type=int,default=5);a=p.parse_args()
here=pathlib.Path(__file__).resolve().parent;out=here/'timing'/a.label;out.mkdir(parents=True,exist_ok=True)
rows=[]
for size in a.sizes:
 for cycle in range(1,a.cycles+1):
  results=[]
  for slot,variant in enumerate(['old','new','new','old'],1):
   filename=out/f'{size}-c{cycle}-s{slot}-{variant}.json'
   command=['node',str(here/'runtime-collection-harness.mjs'),f'root={getattr(a,variant)}','mode=timing',f'size={size}','warmup=5','iterations=15',f'output={filename}']
   subprocess.run(command,check=True,cwd=here)
   row=json.loads(filename.read_text());row.update(cycle=cycle,slot=slot,variant=variant);rows.append(row);results.append(row)
  assert len({r['dataDigest'] for r in results})==1
  old=[r for r in results if r['variant']=='old'];new=[r for r in results if r['variant']=='new']
  print(json.dumps({'size':size,'cycle':cycle,'wallRatio':statistics.mean(r['wallMedian'] for r in new)/statistics.mean(r['wallMedian'] for r in old),'cpuRatio':statistics.mean(r['cpuMedian'] for r in new)/statistics.mean(r['cpuMedian'] for r in old)}),flush=True)
summary={}
for size in a.sizes:
 subset=[r for r in rows if r['size']==size];old=[r for r in subset if r['variant']=='old'];new=[r for r in subset if r['variant']=='new'];cycles=[]
 for cycle in range(1,a.cycles+1):
  o=[r for r in old if r['cycle']==cycle];n=[r for r in new if r['cycle']==cycle]
  cycles.append({'cycle':cycle,**{key:statistics.mean(r[key] for r in n)/statistics.mean(r[key] for r in o) for key in ['wallMedian','cpuMedian']}})
 summary[size]={'old':{k:statistics.median(r[k] for r in old) for k in ['wallMedian','cpuMedian','maxRss']},'new':{k:statistics.median(r[k] for r in new) for k in ['wallMedian','cpuMedian','maxRss']},'pairedMedianRatio':{k:statistics.median(r[k] for r in cycles) for k in ['wallMedian','cpuMedian']},'cycles':cycles,'allDataDigestsEqual':len({r['dataDigest'] for r in subset})==1,'processes':len(subset),'dimensions':subset[0]['dimensions']}
(out/'summary.json').write_text(json.dumps(summary,indent=2));print(json.dumps(summary,indent=2))
