Option Explicit
Dim shell, fso, projectDir, nodeModules, waitCmd
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Derive the project directory from this script's own location
projectDir = fso.GetParentFolderName(WScript.ScriptFullName)
shell.CurrentDirectory = projectDir

' Ensure dependencies are installed (silent, hidden)
nodeModules = fso.BuildPath(projectDir, "node_modules")
If Not fso.FolderExists(nodeModules) Then
    shell.Run "cmd /c npm install --no-audit --no-fund", 0, True
End If

' Start the Vite dev server in the background (hidden, no console window)
shell.Run "cmd /c npm run dev", 0, False

' Wait until the server is up, then open the browser
waitCmd = "powershell -NoProfile -WindowStyle Hidden -Command ""for($i=0;$i -lt 60;$i++){if(Test-NetConnection -ComputerName localhost -Port 5173 -InformationLevel Quiet){break};Start-Sleep -Milliseconds 500};Start-Process 'http://localhost:5173'"""
shell.Run waitCmd, 0, True