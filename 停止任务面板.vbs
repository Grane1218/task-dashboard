Option Explicit
Dim shell
Set shell = CreateObject("WScript.Shell")

' Stop the task dashboard dev server (the process listening on port 5173)
shell.Run "powershell -NoProfile -WindowStyle Hidden -Command ""Get-NetTCPConnection -LocalPort 5173 -State Listen | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { taskkill /F /T /PID $_ *> $null }""", 0, True