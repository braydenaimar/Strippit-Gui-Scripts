# Strippit-Gui-Scripts
A graphical user interface for the Strippit punch press.


Installation
-----
Follow these steps to install the Strippit GUI.

### Windows

1. Install nodejs from www.nodejs.org/en.
1. Download Git for windows from https://git-for-windows.github.io/.
2. Open Windows Command Prompt by going to the start menu and searching 'Command Prompt'.
3. Run `cd Documents` then `git init` to initialize Git in your 'Documents' folder.
4. Run `git clone https://github.com/braydenaimar/Strippit-Gui-Scripts.git` to download the program into your 'Documents' folder.
4. Run `cd Strippit-Gui-Scripts` to open the file.
5. Run `npm install`.
5. Run `npm start` to launch the app.

##### This is what command prompt should look like after completing the above steps.
```
C:\Users\YourName>cd Documents

C:\Users\YourName\Documents>git init
Initialized empty Git repository in C:/Users/YourName/Documents/.git/

C:\Users\YourName\Documents>git clone https://github.com/braydenaimar/Strippit-Gui-Scripts.git
Cloning into 'Strippit-Gui-Scripts'...
~some more output~

C:\Users\YourName\Documents>cd Strippit-Gui-Scripts

C:\Users\YourName\Documents\Strippit-Gui-Scripts>npm install
~a whack load of output~
~note that it is normal to see some warning and error-like messages~

C:\Users\YourName\Documents\Strippit-Gui-Scripts>npm start

```

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

To clone a different branch run `git clone -b <branch> https://github.com/braydenaimar/Strippit-Gui-Scripts.git`.

To switch between branches run `git checkout <branch>`.

### Linux

1. Install nodejs by running `sudo apt-get install nodejs`.
2. Run `sudo apt-get install npm`.
3. Run `sudo apt-get install git`.
4. Run `git clone https://github.com/braydenaimar/Strippit-Gui-Scripts.git` to download the program into your home directory.
5. Run `cd Strippit-Gui-Scripts` to open the directory.
6. Run `npm install`.
7. Navigate to '/json_server/linux_arm' right click on 'serial-port-json-server' and select 'Permissions', enable everyone to execute the file.
8. Run `npm start` to launch the app.

#### Ubuntu Mate
You will also need to run `sudo apt-get install lxterminal`.

Go to 'serial-port-json-server', right click and select 'Permissions', select 'Allow executing file as program'.

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
|   └── connection-widget.js
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
|   └── connection-widget.css
├── html/
│   ├── strippit-widget.html
|   └── connection-widget.html
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
