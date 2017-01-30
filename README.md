# Strippit-Gui-Scripts
A graphical user interface for the Strippit punch press.


Installation
-----
Follow these steps to install the Strippit GUI.

### Windows

1. Install npm.
2. Clone this repository to your computer.
3. Download the SPJS.
4. Put the `json_server` directory inside the repository.
5. `cd` into the repository and run `npm install`.
6. Run `npm start` to launch the app.

Windows Firewall may pop-up with a security alert but you just need to click `Allow Access`.


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
