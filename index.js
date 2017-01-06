/* Main Process JavaScript */

// This script is the first to be ran and loads the HTML file that then loads the appropriate JS and CSS files.

const electron = require('electron')
const {app, BrowserWindow, ipcMain, ipcRenderer} = electron
// const ipcMain = require('electron').ipcMain;
const os = require('os')

console.log("running index.js")
console.log("electron", electron)

app.on('browser-window-created',function (e, window) {
	window.setMenu(null)
})

app.on('ready', () => {
	let win = new BrowserWindow({
		// show: false,
		width: 1650,
		height: 950,
		// fullscreen: true,
		// kiosk: true,
		// frame: false,
		// backgroundColor: '#eaedf4',
		backgroundThrottling: false,
		// webPreferences: {
		// 	nodeIntegration: false
		// }
		icon: __dirname + '/icon.ico'
	})

	win.loadURL(`file://${__dirname}/main.html`)
	win.webContents.openDevTools()

	win.webContents.on('did-finish-load', function () {
		console.log('Got \'did-finish-load\' event.')
	})

	// Called after all widgets initBody() functions and after initial visibility has been set and sidebar buttons have been created.
	ipcMain.on('all-widgets-loaded', function() {
		win.show()
		console.log("Got ipcMain event: 'all-widgets-loaded'.\n  ...showing window.")
	})

	ipcMain.on('open-dev-tools', function() {
		win.webContents.openDevTools()
		console.log("Got ipcMain event: 'open-dev-tools'.")
	})

	win.on('close', function () {
		// amplify.publish('/connection-widget/spjs-send', 'exit');
		win = null
	})
})
