# Strippit-Gui-Scripts
A graphical user interface for the Strippit punch press.


Installation
-----
Follow these steps to install the Strippit GUI.

### Windows

1. Clone this repository to your computer.
2. Install nodejs from www.nodejs.org/en.
3. Launch the Node.js command prompt.
4. `cd` into the repository (ex. `cd Documents/Strippit-Gui-Scripts`)
5. Run `npm install`.
5. Run `npm start` to launch the app.

Windows Firewall may pop-up with a security alert but you just need to click `Allow Access`.

If you are having issues, you may need to add the program to the list of exclusions for Windows Defender.

#### Windows Defender Exclusion

1. Select `Start` and `Settings` to open the settings window.
2. Select `Update & Security`.
3. Select `Windows Defender` in the sidebar menu on the left.
4. Under 'Exclusions' select `Add an exclusion`.
5. Under 'Folders' select `Exclude a folder`.
6. Navigate to and select to the 'Strippit-Gui-Scripts' folder that you cloned from GitHub.
7. Select `Exclude this folder`.
8. Under 'Processes' select `Exclude a process`.
9. Navigate to and open the 'Strippit-Gui-Scripts' folder.
10. Open 'json_server' -> 'windows_x64'.
11. Select the `serial-port-json-server.exe` file (Note, depending on your computer, this file may show as `serial-port-json-server` with a file type of 'Application').
12. Select `Exclude this file`.

File Tree
-----
Below a snapshot of the structure of files and folders of the application after installation on Windows.

```
Strippit-Gui-Scripts/
├── js/
|   ├── lib/
|   |   ├── amplify.core.js
|   |   ├── gui.js
|   |   ├── jquery.js
|   |   └── require.js
│   ├── require-config.js
│   ├── main.js
│   ├── strippit-widget.js
│   ├── settings-widget.js
│   ├── connection-widget.js
|   └── help-widget.js
├── css/
|   ├── fonts/
│   |   ├── fontawesome-webfont.eot
│   |   ├── glyphicons-halflings-regular.eot
│   |   └── ...
|   ├── lib/
|   |   ├── bootstrap-paper.min.css
|   |   ├── font-awesome.min.css
│   |   └── roboto-font.css
|   ├── main.css
│   ├── strippit-widget.css
│   ├── settings-widget.css
│   ├── connection-widget.css
|   └── help-widget.css
├── html/
│   ├── strippit-widget.html
│   ├── settings-widget.html
│   ├── connection-widget.html
|   └── help-widget.html
├── icons/
|   ├── boards/
|   |   ├── tinyg.jpg
|   |   └── tinygv9.jpg
|   |   └── ...
|   └── icon.png
├── json-server/
|   ├── windows_x64/
|   |   ├── arduino/
|   |   |   └── ...
|   |   ├── drivers/windows/
|   |   |   └── TinyGv2.inf
|   |   ├── sample-cert.pem
|   |   ├── sample-key.pem
|   |   └── serial-port-json-server.exe
|   └── linux_arm/
|       ├── arduino/
|       |   └── ...
|       ├── sample-cert.pem
|       ├── sample-key.pem
|       └── serial-port-json-server.exe
├── node_modules/
|   ├── cson/
|   |   └── ...
|   └── electron/
|       └── ...
├── icon.ico
├── index.js
├── main.html
└── package.json
```
