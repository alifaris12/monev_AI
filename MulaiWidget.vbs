Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "E:\WIdget"
WshShell.Run """E:\WIdget\node_modules\electron\dist\electron.exe"" .", 0, False
