# Strippit-Gui-Scripts
A graphical user interface for the Strippit punch press.


The Application
-----
Below a snapshot of the structure of files and folders of the application after installation.

```shell
Strippit-Gui/
├── Strippit-Gui-Scripts/
|	├── css/
|	|	├── fonts/
|   │   |	├── glyphicons-halflings-regular.eot
|   │   |	└── ...
|   |   ├── lib/
|   |   |	├── bootstrap-paper.min.css
|	|	|	├── font-awesome.min.css
|   │   |	└── roboto-font.css
|   |   ├── main.css
|   |   └── ...
|   ├── js/
|	|	├── lib/
|	|	|	├── amplify.core.js
|	|	|	├── gui.js
|	|	|	├── jquery.js
|	|	|	└── require.js
|   │   ├── require-config.js
|   │   ├── main.js
|   │   └── ...
|   ├── icons/
|   |   ├── boards/
|	|	|	├── tinyg.jpg
|	|	|	└── tinygv9.jpg
|	|	|	└── ...
|   |   └── icon.png
|   ├── node_modules/
|   |   └── johnny-five/
|   |       ├── node_modules/
|   |       |   ├── serialport/
|   |       |   |   └── ...
|   |       |   └── ...
|   |       └── ...
|   ├── favicon.ico
|   ├── index.html
|   └── package.json
├── buildTools/
|   ├── 7z/
|   │   ├── 7z.exe
|   │   └── ...
|   ├── ar/
|   │   ├── Resourcer.exe
|   │   └── ...
|   ├── nw/
|   |   ├── node-webkit-v0.8.6-win-ia32
|   |   |   ├── nw.exe
|   |   |   └── ...
├── release/
└── build.bat
```

Installation
-----
Follow these steps to install the Strippit GUI.

1. Install npm
2. Clone this repository to your computer
3. cd into the repository and run `npm install`
4. run `npm start` to launch the app
