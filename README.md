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

#### Windows Defender Exclusion (**Not Applicable to Windows 10 Creators Update)**

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
Note: This installation process is not recommended if you care about the security of the host system as it includes changing file and user permissions.

1. Change user permissions (to stop Linux from prompting user for password when running sudo commands in the terminal).
    + You can follow the instructions below or look [here](https://askubuntu.com/questions/147241/execute-sudo-without-password) for more info.
    + Run `sudo visudo`.
    + Add `username ALL=(ALL) NOPASSWD: ALL` to the very end of the file (replace 'username' with your username).
    + Make sure you did this correctly.
    + No, seriously. Check that you spelt everything correctly. A spelling mistake here could leave you locked out of the system and with no option but to reinstall Linux.
    + Press `ctrl+x`.
    + Press `y`.
    + Press `Enter`.
    + If you see another prompt in the main terminal asking if you are realy super-duper sure you want to apply those changes, you should go back and make sure you did everything correctly.
2. Open the terminal to install the required packages.
    + Run `sudo apt-get install nodejs`.
    + Run `sudo apt-get install npm`.
    + Run `sudo apt-get install git`.
    + [Ubuntu] Run `sudo apt install nodejs-legacy`.
    + [Ubuntu / Ubuntu Mate] Run `sudo apt-get install lxterminal` (running `sudo apt install lxterminal` does the same thing).
3. Run `git clone https://github.com/braydenaimar/Strippit-Gui-Scripts.git` to download the program into your home directory.
4. Run `cd Strippit-Gui-Scripts` to open the directory.
5. Run `npm install` (if you see many error messages, you can just ignore them and proceed to the next step).
6. Change file permissions.
    + Open the file explorer.
    + Open the 'Strippit-Gui-Scripts' folder.
    + Open the 'json_server' folder.
    + Open the 'linux_arm' folder.
    + [Ubuntu] Right click on the executable called 'serial-port-json-server', select 'Properties', select the 'Permissions' tab, and enable 'Allow executing file as a program'.
    + [Ubuntu Mate] Right click on the executable called 'serial-port-json-server', select 'Permissions', and enable 'Allow executing file as a program'.
7. Run `npm start` to launch the app.

If you have issues getting this to work:
1. Try deleting the entire 'Strippit-Gui-Scripts' folder and redo all of the installation steps.
2. Try running `npm install electron-prebuilt` after the last installation step.
