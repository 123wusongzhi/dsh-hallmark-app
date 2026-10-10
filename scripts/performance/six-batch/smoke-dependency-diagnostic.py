from pathlib import Path
import subprocess,sys,json,hashlib
root=Path(sys.argv[1]).resolve();out=Path(sys.argv[2]).resolve();out.mkdir(parents=True,exist_ok=True)
original=root/'scripts/smoke-apps-bundle.mjs';copy=root/'scripts/smoke-apps-six-diagnostic.mjs'
s=original.read_text().replace('mkdir, rm}', 'mkdir, rm, symlink}')
anchor="execFileSync('tar',['-xf',archive,'-C',candidateDirectory]);"
assert s.count(anchor)==1
s=s.replace(anchor,anchor+"\nawait symlink(join(repository,'node_modules'),join(candidateDirectory,'package/node_modules'),'dir');")
s=s.replace('generated-runtime-smoke.json','generated-runtime-smoke-dependency-diagnostic.json')
try:
 copy.write_text(s)
 result=subprocess.run(['node',str(copy)],cwd=root,text=True,capture_output=True,timeout=35)
 (out/'smoke-dependency-diagnostic.log').write_text(result.stdout+result.stderr)
 (out/'smoke-dependency-diagnostic.json').write_text(json.dumps({'exitCode':result.returncode,'originalSha256':hashlib.sha256(original.read_bytes()).hexdigest(),'diagnosticSha256':hashlib.sha256(copy.read_bytes()).hexdigest(),'change':'Link this arm frozen root node_modules into freshly extracted package. Original undeclared-zod failure retained; not an original smoke pass.'},indent=2)+'\n')
 print(root.name,result.returncode)
finally: copy.unlink(missing_ok=True)
