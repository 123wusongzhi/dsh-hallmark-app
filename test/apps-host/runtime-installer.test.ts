import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {existsSync,mkdirSync,mkdtempSync,readFileSync,readdirSync,rmSync,statSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateRuntimeLaunchManifest,type RuntimeLaunchManifest} from '../../packages/plugin-apps/src/runtime-launcher.ts';

const installer=fileURLToPath(new URL('../../scripts/install-desktop-apps.ps1',import.meta.url));
const windows={skip:process.platform!=='win32'};
const powershell=join(process.env.SystemRoot??'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
type Parameters=Record<string,string|boolean>;
interface Scenario {name:string;parameters:Parameters;backupDirectory:string;writer?:{ManageRuntime?:boolean;ValidateOnly?:boolean}}
interface Result {name:string;hasManifest:boolean;manifest:RuntimeLaunchManifest|null;error:string|null}

// ParseFile reads the installer as data. ONLY the two named FunctionDefinitionAst extents
// are dot-sourced: no installer entry point, official CLI, profile, or Runtime is run.
const harness=String.raw`param([string]$InstallerPath, [string]$ScenariosPath, [string]$ResultsPath)
$ErrorActionPreference = 'Stop'
$WarningPreference = 'SilentlyContinue'
$tokens = $null
$parseErrors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile($InstallerPath, [ref]$tokens, [ref]$parseErrors)
if ($parseErrors.Count -ne 0) { throw 'Installer must parse before extracting functions.' }
foreach ($name in @('New-RuntimeLaunchManifest', 'Write-RuntimeLaunchManifest')) {
  $definitions = @($ast.FindAll({ param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq $name }, $false))
  if ($definitions.Count -ne 1) { throw ('Expected exactly one function: ' + $name) }
  . ([ScriptBlock]::Create($definitions[0].Extent.Text))
}
$results = @()
foreach ($scenario in ([IO.File]::ReadAllText($ScenariosPath) | ConvertFrom-Json)) {
  $parameters = @{}
  foreach ($property in $scenario.parameters.PSObject.Properties) { $parameters[$property.Name] = $property.Value }
  $manifest = $null
  $failure = $null
  try {
    $manifest = New-RuntimeLaunchManifest @parameters
    # Normalize PowerShell AutomationNull (no pipeline output) for JSON assertions.
    if ($null -eq $manifest) { $manifest = $null }
    $writeParameters = @{ ManageRuntime = [bool]$parameters.ManageRuntime; ValidateOnly = [bool]$parameters.ValidateOnly; RuntimeLaunch = $manifest; BackupDirectory = $scenario.backupDirectory }
    if ($scenario.writer) {
      foreach ($property in $scenario.writer.PSObject.Properties) { $writeParameters[$property.Name] = $property.Value }
    }
    Write-RuntimeLaunchManifest @writeParameters | Out-Null
  } catch { $failure = $_.Exception.Message }
  $results += [ordered]@{ name = $scenario.name; hasManifest = $null -ne $manifest; manifest = $manifest; error = $failure }
}
[IO.File]::WriteAllText($ResultsPath, (ConvertTo-Json -InputObject @($results) -Depth 12), (New-Object Text.UTF8Encoding($false)))
`;

function fixture(){
  const root=mkdtempSync(join(tmpdir(),'runtime-installer-'));
  const installed=join(root,'fake installed package'),data=join(root,'fake data \u6d4b\u8bd5'),cwd=join(root,'fake working directory'),backup=join(root,'fake rollback');
  const node=join(root,'fake bin','node.exe'),entry=join(installed,'lib','runtime.js'),connections=join(data,'connections.json'),token=join(root,'operator-source.json'),serviceKey=join(data,'service-key');
  for(const directory of [join(installed,'lib'),data,cwd,backup,join(root,'fake bin')])mkdirSync(directory,{recursive:true});
  // Empty files suffice for existence validation. No credential content is read,
  // no router environment variable is set, and fake node.exe is never executed.
  for(const file of [node,entry,connections,token,serviceKey])writeFileSync(file,'');
  const parameters:Parameters={ManageRuntime:true,InstalledDirectory:installed,RuntimeNodeExecutable:node,RuntimeDataDirectory:data,RuntimeWorkingDirectory:cwd,RuntimeConnectionsFile:connections,RuntimeServiceUrl:'http://127.0.0.1:4181/',RuntimeOperatorTokenFile:token,RuntimeOperatorTokenJson:true,RuntimeRouterKeyEnvironment:'DSH_TEST_ROUTER_SOURCE'};
  const manifestPath=join(data,'runtime-launch.json'),previousPath=join(backup,'runtime-launch.previous.json');
  let sequence=0;
  return {root,installed,data,cwd,backup,node,entry,connections,token,serviceKey,parameters,manifestPath,previousPath,
    run(scenarios:Scenario[]):Result[]{
      const batch=join(root,`harness-${sequence++}`);mkdirSync(batch);
      const script=join(batch,'harness.ps1'),input=join(batch,'scenarios.json'),output=join(batch,'results.json');
      writeFileSync(script,harness);writeFileSync(input,JSON.stringify(scenarios));
      const child=spawnSync(powershell,['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',script,'-InstallerPath',installer,'-ScenariosPath',input,'-ResultsPath',output],{
        cwd:root,encoding:'utf8',timeout:30_000,windowsHide:true,
        env:{SystemRoot:process.env.SystemRoot,WINDIR:process.env.WINDIR,TEMP:root,TMP:root,HOME:root,USERPROFILE:root,APPDATA:root,LOCALAPPDATA:root},
      });
      assert.ifError(child.error);assert.equal(child.status,0,`Isolated function harness failed: ${child.stderr}`);
      assert.equal(child.stdout,'','Harness must not emit credential contents or manifest values');
      return JSON.parse(readFileSync(output,'utf8')) as Result[];
    },
    scenario(name:string,overrides:Parameters={},writer?:Scenario['writer']):Scenario{return {name,parameters:{...parameters,...overrides},backupDirectory:backup,...(writer?{writer}:{})};},
    validate(raw:unknown){return validateRuntimeLaunchManifest(raw,{serviceUrl:'http://127.0.0.1:4181',dataDirectory:data,entry});},
    close(){rmSync(root,{recursive:true,force:true,maxRetries:10,retryDelay:25});assert.equal(existsSync(root),false);},
  };
}
function noWrites(f:ReturnType<typeof fixture>){assert.equal(existsSync(f.manifestPath),false);assert.equal(existsSync(f.previousPath),false);assert.deepEqual(readdirSync(f.backup),[]);assert.deepEqual(readdirSync(f.data).sort(),['connections.json','service-key']);}
function assertManifest(f:ReturnType<typeof fixture>,result:Result){
  assert.equal(result.error,null);assert.equal(result.hasManifest,true);assert.ok(result.manifest);
  const bytes=readFileSync(f.manifestPath);
  assert.notDeepEqual([...bytes.subarray(0,3)],[0xef,0xbb,0xbf],'Manifest must be BOM-less UTF-8');
  const disk=JSON.parse(bytes.toString('utf8')) as RuntimeLaunchManifest;
  assert.deepEqual(disk,result.manifest);const validated=f.validate(disk);
  assert.equal(validated.nodeExecutable,resolve(f.node));assert.equal(validated.cwd,resolve(f.cwd));
  assert.equal(validated.env.APPS_DATA_DIR,resolve(f.data));assert.equal(validated.env.APPS_CONNECTIONS_FILE,resolve(f.connections));assert.equal(validated.env.APPS_PORT,'4181');
  assert.equal(validated.serviceUrl,'http://127.0.0.1:4181');
  assert.deepEqual(validated.credentials,[{name:'HALLMARK_OPERATOR_TOKEN',fromFile:resolve(f.token),jsonField:'token'},{name:'openrouter',fromEnv:'DSH_TEST_ROUTER_SOURCE'}]);
  assert.deepEqual(Object.keys(disk.env).sort(),['APPS_CONNECTIONS_FILE','APPS_DATA_DIR','APPS_PORT']);
  assert.equal(statSync(f.node).size,0);assert.equal(statSync(f.token).size,0);assert.equal(statSync(f.serviceKey).size,0);
  assert.deepEqual(readdirSync(f.data).sort(),['connections.json','runtime-launch.json','service-key']);
  assert.deepEqual(readdirSync(f.backup),[]);return bytes;
}

for(const style of ['backslash','slash'] as const){
  test(`extracted installer functions accept absolute Windows ${style} paths and write validator-compatible BOM-less UTF-8`,windows,()=>{
    const f=fixture();try{
      const scenario=f.scenario(style);
      for(const name of ['InstalledDirectory','RuntimeNodeExecutable','RuntimeDataDirectory','RuntimeWorkingDirectory','RuntimeConnectionsFile','RuntimeOperatorTokenFile']){
        const value=String(scenario.parameters[name]);scenario.parameters[name]=style==='slash'?value.replaceAll('\\','/'):value.replaceAll('/','\\');
      }
      assertManifest(f,f.run([scenario])[0]);assert.equal(existsSync(f.previousPath),false);
    }finally{f.close();}
  });
}

for(const [form,value] of [['relative','relative\\file'],['drive-relative','C:relative\\file'],['backslash-root-relative','\\relative\\file'],['slash-root-relative','/relative/file']]){
  test(`extracted constructor rejects ${form} paths for every launch path input without writing`,windows,()=>{
    const f=fixture();try{
      const scenarios=['InstalledDirectory','RuntimeNodeExecutable','RuntimeDataDirectory','RuntimeWorkingDirectory','RuntimeConnectionsFile','RuntimeOperatorTokenFile'].map(name=>f.scenario(name,{[name]:value}));
      for(const result of f.run(scenarios)){assert.equal(result.error,'Runtime launch paths must be absolute.',result.name);assert.equal(result.hasManifest,false,result.name);}noWrites(f);
    }finally{f.close();}
  });
}

test('ManageRuntime defaults off and explicit false returns no manifest and does not validate or write paths',windows,()=>{
  const f=fixture();try{
    const omitted=f.scenario('omitted');delete omitted.parameters.ManageRuntime;
    const results=f.run([omitted,f.scenario('false',{ManageRuntime:false,RuntimeNodeExecutable:'relative'})]);
    for(const result of results){assert.equal(result.error,null);assert.equal(result.hasManifest,false);assert.equal(result.manifest,null);}noWrites(f);
  }finally{f.close();}
});

test('ValidateOnly validates inputs but returns no manifest and writes no files',windows,()=>{
  const f=fixture();try{
    const [result,invalid]=f.run([f.scenario('validate',{ValidateOnly:true}),f.scenario('invalid-validate',{ValidateOnly:true,RuntimeNodeExecutable:'C:relative'})]);
    assert.equal(result.error,null);assert.equal(result.hasManifest,false);assert.equal(invalid.error,'Runtime launch paths must be absolute.');noWrites(f);
  }finally{f.close();}
});

test('each missing required parameter skips generation and persistence rather than emitting a partial manifest',windows,()=>{
  const f=fixture();try{
    const required=['InstalledDirectory','RuntimeNodeExecutable','RuntimeDataDirectory','RuntimeWorkingDirectory','RuntimeServiceUrl','RuntimeOperatorTokenFile','RuntimeRouterKeyEnvironment'];
    for(const result of f.run(required.map(name=>f.scenario(name,{[name]:''})))){assert.equal(result.error,null,result.name);assert.equal(result.hasManifest,false,result.name);}noWrites(f);
  }finally{f.close();}
});

test('writer independently honors opt-in, ValidateOnly, and null manifest guards',windows,()=>{
  const f=fixture();try{
    const results=f.run([f.scenario('writer-off',{}, {ManageRuntime:false}),f.scenario('writer-validate',{}, {ValidateOnly:true}),f.scenario('null',{RuntimeServiceUrl:''})]);
    for(const result of results)assert.equal(result.error,null);assert.equal(results[0].hasManifest,true);assert.equal(results[1].hasManifest,true);assert.equal(results[2].hasManifest,false);noWrites(f);
  }finally{f.close();}
});

test('overwrite backs up the exact prior manifest and leaves it untouched for disabled or validation-only calls',windows,()=>{
  const f=fixture();try{
    const original=Buffer.from('\ufeff{"previous":"fixture metadata"}\r\n','utf8');writeFileSync(f.manifestPath,original);
    const [off,validate]=f.run([f.scenario('off',{ManageRuntime:false}),f.scenario('validate',{ValidateOnly:true})]);
    assert.equal(off.hasManifest,false);assert.equal(validate.hasManifest,false);assert.deepEqual(readFileSync(f.manifestPath),original);assert.equal(existsSync(f.previousPath),false);
    const [result]=f.run([f.scenario('replace',{RuntimeOperatorTokenJson:false,RuntimeConnectionsFile:''})]);
    assert.equal(result.error,null);assert.equal(result.hasManifest,true);assert.deepEqual(readFileSync(f.previousPath),original);
    const bytes=readFileSync(f.manifestPath);assert.notDeepEqual([...bytes.subarray(0,3)],[0xef,0xbb,0xbf]);
    const manifest=f.validate(JSON.parse(bytes.toString('utf8')));assert.deepEqual(manifest.credentials[0],{name:'HALLMARK_OPERATOR_TOKEN',fromFile:resolve(f.token)});
    assert.equal(manifest.env.APPS_CONNECTIONS_FILE,resolve(f.connections));assert.deepEqual(readdirSync(f.backup),['runtime-launch.previous.json']);
    assert.deepEqual(readdirSync(f.data).sort(),['connections.json','runtime-launch.json','service-key']);
  }finally{f.close();}
});

test('writer refuses a missing installed Runtime entry before backup or persistence',windows,()=>{
  const f=fixture();try{
    rmSync(f.entry);const previous='{"previous":"keep"}';writeFileSync(f.manifestPath,previous);
    const [result]=f.run([f.scenario('missing-entry')]);assert.equal(result.error,'Installed Runtime entry is missing.');assert.equal(result.hasManifest,true);
    assert.equal(readFileSync(f.manifestPath,'utf8'),previous);assert.deepEqual(readdirSync(f.backup),[]);assert.deepEqual(readdirSync(f.data).sort(),['connections.json','runtime-launch.json','service-key']);
  }finally{f.close();}
});

test('constructor refuses absent required fake files without reading credentials or creating a manifest',windows,()=>{
  const f=fixture();try{
    rmSync(f.serviceKey);const [result]=f.run([f.scenario('missing-service-key')]);assert.equal(result.error,'A required Runtime launch file is missing.');assert.equal(result.hasManifest,false);
    assert.equal(existsSync(f.manifestPath),false);assert.equal(existsSync(f.previousPath),false);assert.deepEqual(readdirSync(f.backup),[]);
  }finally{f.close();}
});

test('constructor rejects non-node executables, non-loopback URLs, invalid ports, and credential environment injection',windows,()=>{
  const f=fixture();try{
    const electron=join(f.root,'electron.exe');writeFileSync(electron,'');
    const invalid:Parameters[]=[{RuntimeNodeExecutable:electron},{RuntimeServiceUrl:'http://localhost:4181'},{RuntimeServiceUrl:'https://127.0.0.1:4181'},{RuntimeServiceUrl:'http://127.0.0.1:0'},{RuntimeServiceUrl:'http://127.0.0.1:65536'},{RuntimeServiceUrl:'http://127.0.0.1:4181/?inline=forbidden'},{RuntimeRouterKeyEnvironment:'bad-name'}];
    for(const result of f.run(invalid.map((overrides,index)=>f.scenario(`invalid-${index}`,overrides)))){assert.ok(result.error,result.name);assert.equal(result.hasManifest,false,result.name);}noWrites(f);
  }finally{f.close();}
});
