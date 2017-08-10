/* Main Process JavaScript */

// This script is the first to be ran and loads the HTML file that then loads the appropriate JS and CSS files.

const electron = require('electron');
const os = require('os');
// const ipcMain = require('electron').ipcMain;

const { app, BrowserWindow, ipcMain } = electron;

console.log('running index.js');
console.log(`Host Device: '${os.hostname()}'`);

app.on('browser-window-created', (e, window) => {

	window.setMenu(null);

});

app.on('ready', () => {

	let win = null;

	// If running this on braydens laptop, open it in development mode.
	if (os.hostname() === 'BRAYDENS-LENOVO') {

		console.log('Opening in development mode.');
		console.log('electron', electron);

		win = new BrowserWindow({
			// show: false,
			width: 940,
			height: 550,
			// fullscreen: true,
			// kiosk: true,
			// frame: false,
			// backgroundColor: '#eaedf4',
			backgroundThrottling: false,
			// webPreferences: {
			// 	nodeIntegration: false
			// }
			icon: `${__dirname}/icon.ico`
		});

	} else {

		console.log('Opening in deployment mode.');

		win = new BrowserWindow({
			// show: false,
			// width: 1650,
			// height: 950,
			// fullscreen: true,
			// frame: true,
			kiosk: true,
			// frame: false,
			// backgroundColor: '#eaedf4',
			backgroundThrottling: false,
			// webPreferences: {
			// 	nodeIntegration: false
			// }
			icon: `${__dirname}/icon.ico`
		});

	}

	win.loadURL(`file://${__dirname}/main.html`);

	if (os.hostname() === 'BRAYDENS-LENOVO') win.webContents.openDevTools();

	win.webContents.on('did-finish-load', () => {

		console.log('Got \'did-finish-load\' event.');

	});

	// Called after all widgets initBody() functions and after initial visibility has been set and sidebar buttons have been created.
	ipcMain.on('all-widgets-loaded', () => {

		win.show();
		win.focus();

		console.log('Got ipcMain event: \'all-widgets-loaded\'.\n  ...showing window.');

	});

	ipcMain.on('focus-window', () => {

		win.focus();

	});

	ipcMain.on('open-dev-tools', () => {

		win.webContents.openDevTools();
		win.focus();

		console.log('Got ipcMain event: \'open-dev-tools\'.');

	});

	win.on('close', () => {

		win = null;

	});

});
