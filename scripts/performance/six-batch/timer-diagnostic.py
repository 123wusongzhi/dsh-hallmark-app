# Reproduction only: no production source or original test is modified.
from pathlib import Path
import subprocess,sys,json,hashlib
root=Path(sys.argv[1]).resolve();out=Path(sys.argv[2]).resolve();out.mkdir(parents=True,exist_ok=True)
original=root/'test/apps-components/bridge.test.ts';copy=root/'test/apps-components/bridge-six-diagnostic.ts'
s=original.read_text();old='t.mock.timers.tick(150000);await rejected;';assert s.count(old)==1
try:
 copy.write_text(s.replace(old,'t.mock.timers.tick(750000);await rejected;'))
 result=subprocess.run(['node','--test','--test-timeout=20000','--test-name-pattern=business component submission survives',str(copy)],cwd=root,text=True,capture_output=True,timeout=25)
 (out/'timer-diagnostic.log').write_text(result.stdout+result.stderr)
 (out/'timer-diagnostic.json').write_text(json.dumps({'exitCode':result.returncode,'originalSha256':hashlib.sha256(original.read_bytes()).hexdigest(),'diagnosticSha256':hashlib.sha256(copy.read_bytes()).hexdigest(),'change':'Second mocked timer advance 150000 -> 750000; total mocked elapsed 900001 ms. No production edit. Not an original-suite pass.'},indent=2)+'\n')
finally: copy.unlink(missing_ok=True)
