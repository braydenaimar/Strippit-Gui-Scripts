/**
 *   __  __       _             _                  ____            _       _
 *  |  \/  | __ _(_)_ __       | | __ ___   ____ _/ ___|  ___ _ __(_)_ __ | |_
 *  | |\/| |/ _` | | '_ \   _  | |/ _` \ \ / / _` \___ \ / __| '__| | '_ \| __|
 *  | |  | | (_| | | | | | | |_| | (_| |\ V / (_| |___) | (__| |  | | |_) | |_
 *  |_|  |_|\__,_|_|_| |_|  \___/ \__,_| \_/ \__,_|____/ \___|_|  |_| .__/ \__|
 *                                                                  |_|
 *
 *  @author Brayden Aimar
 */

/* global ws:true, wgtMap:true, wgtLoaded:true, wgtVisible:true, widget:true, initBody:true, widgetLoadCheck:true, createWidgetContainer:true, loadHtmlWidget:true, loadJsWidget:true, createSidebarBtns:true, initWidgetVisible:true, makeWidgetVisible:true, updateGitRepo:true */  // eslint-disable-line no-unused-vars

define([ 'jquery', 'gui', 'amplify', 'mousetrap' ], ($) => {

	/* eslint-disable no-console*/

	console.log('running main.js');
	console.log('global:', global);
	CSON = require('cson');
	fsCSON = require('fs-cson');
	fs = require('fs');
	os = require('os');
	({ spawn } = require('child_process'));

	// The ipc module aLlows for communication between the main and render processes.
	electron = require('electron');
	({ ipcRenderer: ipc } = electron);

	({ publish, subscribe, unsubscribe } = amplify);

	const developerHosts = [ 'BRAYDENS-LENOVO' ];  // List of developer host devices
	inDebugMode = developerHosts.includes(os.hostname());

	DEBUG_ENABLED = true;  // Enable debugging mode
	debug = {};

	if (DEBUG_ENABLED && inDebugMode && (typeof console != 'undefined')) { // If debug mode is enabled
		const keys = Object.keys(console);

		for (let i = 0; i < keys.length; i++) {

			const key = keys[i];

			if (key === 'memory')
				debug[key] = console[key];

			else if (key === 'error')
				debug[key] = ((...args) => { throw new Error(...args); });

			else
				debug[key] = console[key].bind(console);

		}

	} else {

		const keys = Object.keys(console);
		const banned = [ 'log', 'info', 'table' ];  // Console log methods that will be ignored

		for (let i = 0; i < keys.length; i++) {

			const key = keys[i];

			if (banned.includes(key))  // If not allowed
				debug[key] = () => false;

			else if (key === 'memory')
				debug[key] = console[key];

			else
				debug[key] = console[key].bind(console);

		}

	}

	/* eslint-enable no-console*/

	// Press Ctrl-Shift-I to launch development tools.
	Mousetrap.bind('ctrl+shift+i', () => ipc.send('open-dev-tools'));

	// Press Ctrl-Shift-R to reload the program.
	Mousetrap.bind('ctrl+shift+r', () => location.reload(true));

	// Keyboard shortcuts for use throughout the program.
	Mousetrap.bind('ctrl+pageup', () => publish('keyboard-shortcut', 'ctrl+pageup'));      // Connection Widget: Show device log to the left
	Mousetrap.bind('ctrl+pagedown', () => publish('keyboard-shortcut', 'ctrl+pagedown'));  // Connection Widget: Show device log to the right
	Mousetrap.bind('ctrl+o', () => publish('keyboard-shortcut', 'ctrl+o'));  // Load Widget: Open a file
	Mousetrap.bind('ctrl+s', () => publish('keyboard-shortcut', 'ctrl+s'));  // Load Widget: Save a file

	// Store information about the system.
	hostMeta = {
		os: null,
		platform: os.platform(),
		architecture: os.arch(),
		cpus: os.cpus(),
		freeMemory: os.freemem(),
		totalMemory: os.totalmem(),
		homeDirectory: os.homedir(),
		hostName: os.hostname(),
		networkInterfaces: os.networkInterfaces(),
		upTime: (os.uptime() / (60 * 60)).toFixed(2),
		userInfo: os.userInfo()
	};

	if (navigator.appVersion.includes('Win')) {
		hostMeta.os = 'Windows';

	} else if (navigator.appVersion.includes('Mac')) {
		hostMeta.os = 'Mac';

	} else if (navigator.appVersion.includes('X11')) {
		hostMeta.os = 'Unix';

	} else if (navigator.appVersion.includes('Linux')) {
		hostMeta.os = 'Linux';

	} else if (navigator.appVersion.includes('SunOs')) {
		hostMeta.os = 'Solaris';

	}

	if (navigator.onLine) {

		console.log('Connected to the internet.');

	}

	console.log(hostMeta);


	// IDEA: Declare all of these as const and take them out of the 'ws' object.
	ws = {
		id: 'main',
		name: 'CNC Interface',
		desc: 'Setting the ground-work for the future of modern CNC user interface software.',
		publish: {
			'/all-widgets-loaded': 'This gets called once all widgets have ran their initBody() functions. Widgets can wait for this signal to know when  to start doing work, preventing missed publish calls if some widgets take longer to load than others.',
			'/widget-resize': '',
			'/widget-visible': 'Gets published after a new widget has been made visible.'
		},
		subscribe: {
			'/widget-loaded': '',
			'/all-widgets-loaded': 'The init scripts wait for this to know when to make the widgets visible to prevent visual flash on loading.',
			'/make-widget-visible': ''
		}
	};

	// TODO: Load the widgets as modules in module exports.
	// Stores the length of the widget object.
	wgtLen = null;
	// Same as respective widget's id, filename, reference object, and DOM container.
	wgtMap = [ 'statusbar-widget', 'strippit-widget', 'connection-widget' ];
	// wgtMap = [ 'statusbar-widget', 'strippit-widget', 'settings-widget', 'connection-widget', 'help-widget' ];
	// Gets set to true once respective widget publishes '/widget-loaded'.
	// Ex. [ false, false, ..., false ]
	wgtLoaded = [];
	wgtVisible = 'strippit-widget';
	// wgtVisible = 'connection-widget';
	// Stores startup info and scope references for each widget
	// IDEA: Take each of the widget refs and move them outside of the widget object.
	// IDEA: Build each port's object during the program execution.
	// IDEA: Call the widgets modules instead of widgets.
	widget = {
		// loadHtml: Specifies if the respective widget has dom elements that need to be loaded [true/false].
		// visible: Specifies if the respective widget should be visible on startup, its current visibility status, and if it's visibility can be changed
		//   (null = n/a, false = not visible on startup, true = visible on startup).
		// sidebarBtn: Specifies how the button should be created (true: make & show button, false: make & hide button, null/undefined: no button)
		// IDEA: Move loadHtml and sidebarBtn flags into each respective widget and only have the widget's objects stored here.
		'statusbar-widget': { loadHtml: false, sidebarBtn: null },
		'strippit-widget': { loadHtml: true, sidebarBtn: true },
		// 'settings-widget': { loadHtml: true, sidebarBtn: true },
		'connection-widget': { loadHtml: true, sidebarBtn: true }
		// 'help-widget': { loadHtml: true, sidebarBtn: true }
	};

	for (let i = 0; i < wgtMap.length; i++) {

		this.wgtLoaded.push(false);

	}

	console.groupCollapsed(`${ws.name} Setup`);

	initBody = function () {

		console.group(`${ws.id}.initBody()`);

		$(window).resize(() => {

			// console.log("Resize window");
			// publish('/' + this.ws.id + '/window-resize');
			// TODO: Fix resize. Widgets do not resize with the window. only the first subscriber to the '/main/window-resize' line gets their callback called.
			publish('/main/window-resize');

		});

		widgetLoadCheck = setTimeout(function () {

			console.log('widgetLoadCheck timeout function running');

			if (wgtLoaded.includes(false)) {

				const that = this;
				let errorLog = '!! Widget(s) Not Successfully Loaded !!';

				$.each(wgtLoaded, (i, item) => {

					errorLog += (item) ? '' : `\n  ${that.wgtMap[i]} widget`;

				});

				console.error(errorLog);

				alert(errorLog);

				ipc.send('open-dev-tools');

			} else {

				console.log('  check non-resultant');

			}

		}, 2000);

		// This gets published at the end of each widget's initBody() function.
		subscribe(`/${this.ws.id}/widget-loaded`, this, function (wgt) {

			console.groupEnd();
			// If this is the first time being called, set timer to check that all widgets are loaded within a given timeframe. If any widgets have not loaded after that time has elapsed, create an alert and log event listing the widget(s) that did not load.
			// if (wgtLoaded.indexOf(true) == -1) {
			// }
			wgtLoaded[wgtMap.indexOf(wgt)] = true;

			// If all of the widgets are loaded.
			if (!wgtLoaded.includes(false)) {

				createSidebarBtns();
				// initSidebarBtnEvts();
				initWidgetVisible();

				console.groupEnd();
				// Publish before making dom visible so that the widgets can start communicating with eachother and getting their shit together.
				publish(`/${this.ws.id}/all-widgets-loaded`);
				ipc.send('all-widgets-loaded');
				clearTimeout(widgetLoadCheck);

			}

		});

		subscribe(`/${this.ws.id}/all-widgets-loaded`, this, updateGitRepo.bind(this));

		// Tells widgets that visibility has been changed so they can stop/resume dom updates if required
		subscribe(`/${this.ws.id}/make-widget-visible`, this, makeWidgetVisible.bind(this));

		// Entry point for loading all widgets
		// Load each widget in the order they appear in the widget object
		$.each(widget, (wgt, wgtItem) => {

			console.log(`Loading ${wgt}`);

			if (wgtItem.loadHtml) {

				createWidgetContainer(wgt);
				loadHtmlWidget(wgt);

			} else {

				loadJsWidget(wgt);

			}

		});

		console.log('Initializing sidebar button click events.');

		$('#sidebar').on('click', 'span.btn', function (evt) {

			makeWidgetVisible($(this).attr('evt-data'));

		});

		console.groupEnd(); // Main Setup

	};

	createWidgetContainer = function createWidgetContainer(wgt) {
		// append a div container to dom body
		console.log('  Creating widget DOM container');

		const containerHtml = `<div id="${wgt}" class="widget-container hidden"></div>`;
		$('body').append(containerHtml);

	};

	loadHtmlWidget = function (wgt) {

		console.log('  Loading HTML & JS');

		$(`#${wgt}`).load(`html/${wgt}.html`, '', () => {

			requirejs([ wgt ], (ref) => {

				const temp = ref;
				temp.loadHtml = widget[wgt].loadHtml;
				temp.sidebarBtn = widget[wgt].sidebarBtn;

				widget[wgt] = temp;

				ref.initBody();

			});

		});

	};

	loadJsWidget = function (wgt) {

		console.log('  Loading JS');

		requirejs([ wgt ], (ref) => {

			const temp = ref;
			temp.loadHtml = widget[wgt].loadHtml;
			temp.sidebarBtn = widget[wgt].sidebarBtn;
			widget[wgt] = temp;

			ref.initBody();

		});

	};

	createSidebarBtns = function (wgt) {

		console.log('Creating Sidebar Buttons');
		$.each(widget, (widgetIndex, widgetItem) => {
			// Check if the respective widget wants a sidebar button made
			debug.log(`  ${widgetIndex}`);
			if (!widgetItem.sidebarBtn) {
				debug.log('    ...jk, not creating sidebar button.');
			}
			else if (widgetItem.icon.includes('material-icons')) {
				let btnHtml = `<span id="btn-${widgetIndex}" evt-data="${widgetIndex}" class="btn btn-${widgetItem.btnTheme}`;
				btnHtml += (widgetItem.sidebarBtn) ? '' : ' hidden';
				btnHtml += `"><div><span class="material-icons">${widgetItem.icon.split(' ')[1]}</span></div><div>`;
				btnHtml += (widgetItem.shortName) ? widgetItem.shortName : widgetItem.name;
				btnHtml += '</div></span>';

				$('#sidebar').append(btnHtml);
			}
			else {
				let btnHtml = `<span id="btn-${widgetIndex}" evt-data="${widgetIndex}" class="btn btn-${widgetItem.btnTheme}`;
				btnHtml += (widgetItem.sidebarBtn) ? '' : ' hidden';
				btnHtml += `"><div><span class="${widgetItem.icon}"></span></div><div>`;
				btnHtml += (widgetItem.shortName) ? widgetItem.shortName : widgetItem.name;
				btnHtml += '</div></span>';

				$('#sidebar').append(btnHtml);
			}

			if (widgetIndex === wgtVisible && widgetItem.sidebarBtn) {
				$(`#btn-${widgetIndex}`).removeClass('btn-default');
				$(`#btn-${widgetIndex}`).addClass('btn-primary');
			}
		});
	};

	initWidgetVisible = function () {

		// Show the initial widget.
		$(`#${wgtVisible}`).removeClass('hidden');

		$('#header-widget-label').text(widget[wgtVisible].name); // Set header bar label.
		// $('#header-widget-icon').addClass(widget[wgtVisible].icon); // Set header bar icon.

		publish(`/${this.ws.id}/widget-visible`, wgtVisible, null);

	};

	makeWidgetVisible = function (wgt) {

		console.log(`Widget visible: ${wgt}`);
		// If wgt is already visible, do nothing.
		if (wgt === wgtVisible) return;
		// console.log("  wgt: " + wgt + "\n  wgtVisible: " + wgtVisible);

		$(`#btn-${wgt}`).removeClass('btn-default');
		$(`#btn-${wgt}`).addClass('btn-primary');

		$(`#btn-${wgtVisible}`).removeClass('btn-primary');
		$(`#btn-${wgtVisible}`).addClass('btn-default');

		// Hide previously visible widget.
		$(`#${wgtVisible}`).addClass('hidden');
		// $('#header-widget-icon').removeClass(widget[wgtVisible].icon);

		// Show the requested widget.
		$(`#${wgt}`).removeClass('hidden');

		$('#header-widget-label').text(widget[wgt].name); // Set header bar label.
		// $('#header-widget-icon').addClass(widget[wgt].icon); // Set header bar icon.

		publish(`/${this.ws.id}/widget-visible`, wgt, wgtVisible);
		wgtVisible = wgt;

	};

	updateGitRepo = function () {
		// Pulls the latest repository from the master branch on GitHub.

		let terminal = null;

		// Skip the update if host is my laptop or if there is no internet connection.
		if (hostMeta.hostName === 'BRAYDENS-LENOVO' || !navigator.onLine) return false;

		console.log('Pulling latest repo from GitHub.');

		terminal = spawn('git pull', [], { shell: true });

		terminal.stdout.on('data', (data) => {

			const msg = `${data}`;
			const msgBuffer = msg.split('\n');

			for (let i = 0; i < msgBuffer.length; i++) {

				if (msgBuffer[i]) console.log(`Git pull stdout: ${msgBuffer[i]}`);

				// If a newer repository was found, reload the GUI so the new scripts are used.
				if (msgBuffer[i].includes('Updating')) {

					console.log('Repository was updated.');

					// Reload the program to make use of any new updates.
					location.reload(true);

				}

			}

		});

		terminal.stderr.on('data', (data) => {

			const msg = `${data}`;
			const msgBuffer = msg.split('\n');

			for (let i = 0; i < msgBuffer.length; i++) {

				if (msgBuffer[i]) console.log(`Git pull stderr: ${msgBuffer[i]}`);

			}

		});

		terminal.on('close', (code) => {

			console.log(`Git pull.\nChild precess exited with the code: ${code}.`);

		});

		return true;
	};

});
