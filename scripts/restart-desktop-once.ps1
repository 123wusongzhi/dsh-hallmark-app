# User explicitly requested this one-shot DSH restart. No business/backend/profile edits.
$ErrorActionPreference='Stop'
$oldId=9464
$exe='C:\Users\wubil\AppData\Local\Programs\DeepSeek Harness\DeepSeek Harness.exe'
$log='E:\project\deepseek_h\dsh-hallmark-app\artifacts\desktop-restart.jsonl'
function LogEvent($event) { $event.at=[datetime]::UtcNow.ToString('o'); ($event|ConvertTo-Json -Compress)|Add-Content -LiteralPath $log -Encoding utf8 }
try {
 $old=Get-CimInstance Win32_Process -Filter "ProcessId = $oldId"
 if($null -eq $old -or $old.ExecutablePath -ine $exe -or $old.CommandLine -match '--type=') { throw 'Desktop identity changed; refusing restart' }
 Add-Type -AssemblyName UIAutomationClient
 Add-Type -AssemblyName UIAutomationTypes
 LogEvent @{event='waiting-for-official-quit';oldPid=$oldId}
 $deadline=[datetime]::UtcNow.AddSeconds(150)
 while(Get-Process -Id $oldId -ErrorAction SilentlyContinue) {
  if([datetime]::UtcNow -gt $deadline) { throw 'Official quit did not finish; not force-killing or opening a duplicate' }
  # Confirm only DSH's native quit dialog, already expressly authorized by the user.
  $windows=[System.Windows.Automation.AutomationElement]::RootElement.FindAll([System.Windows.Automation.TreeScope]::Children,[System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::ProcessIdProperty,$oldId))
  foreach($window in $windows) {
   if($window.Current.Name -notmatch '^退出 DeepSeek Harness|^Quit DeepSeek Harness') { continue }
   $button=$window.FindFirst([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.AndCondition]::new([System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::ControlTypeProperty,[System.Windows.Automation.ControlType]::Button),[System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::NameProperty,'退出')))
   if($null -ne $button) { $button.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke(); LogEvent @{event='authorized-native-quit-confirmed';oldPid=$oldId} }
  }
  Start-Sleep -Milliseconds 500
 }
 LogEvent @{event='old-desktop-exited';oldPid=$oldId}
 $new=Start-Process -FilePath $exe -PassThru
 LogEvent @{event='desktop-relaunched';pid=$new.Id;exe=$exe}
} catch { LogEvent @{event='restart-failed';message=$_.Exception.Message}; exit 1 }
