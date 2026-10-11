import {writeFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
const start=performance.now(),cpu=process.cpuUsage();
const fetchOriginal=globalThis.fetch;
globalThis.fetch=(input,...args)=>{const url=new URL(typeof input==='string'||input instanceof URL?input:input.url);if(!['127.0.0.1','localhost','[::1]'].includes(url.hostname))throw Error('BENCH_NETWORK_OUTSIDE_LOOPBACK: '+url.origin);return fetchOriginal(input,...args);};
process.once('exit',code=>{if(process.env.BENCH_METRICS_PATH)writeFileSync(process.env.BENCH_METRICS_PATH,JSON.stringify({exitCode:code,node:process.version,execPath:process.execPath,platform:process.platform,arch:process.arch,processWallMs:performance.now()-start,processCpu:process.cpuUsage(cpu),maxRssKB:process.resourceUsage().maxRSS,memoryAtExit:process.memoryUsage(),scope:'Whole process including setup/import/oracle; task-local metrics are in scenario output. maxRSS is cumulative high-water.'},null,2)+'\n');});
