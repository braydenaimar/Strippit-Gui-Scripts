/* Render Process JavaScript */
/* eslint-disable no-undef */

define([ 'jquery', 'gui', 'amplify', 'mousetrap' ], function ($) {
	console.log('running main.js');
	console.log('global:', global);
	// TODO: require bootstrap javascript

	// TODO: Use module exports for this.
	CSON = require('cson');
	fs = require('fs');
	os = require('os');
	spawn = require('child_process').spawn;

	// The ipc module aLlows for communication between the main and render processes.
	electron = require('electron');
	ipc = electron.ipcRenderer;
	
	// TODO: Clean up the way amplify is imported cuz it is also in module exports.
	publish = amplify.publish;
	subscribe = amplify.subscribe;
	unsubscribe = amplify.unsubscribe;

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

	(function testCode() {
		console.groupCollapsed('OS Module');
		console.log('OS:', hostMeta.os);
		console.log('Platform:', os.platform());
		console.log('Architecture:', os.arch());
		console.log('CPUs:', os.cpus());
		console.log(`Free memory: ${(os.freemem() / 1000000000).toFixed(3)} Gb`); // free memory [bytes]
		console.log(`Total memory: ${(os.totalmem() / 1000000000).toFixed(3)} Gb`); // total memory [bytes]
		console.log(`Home directory: ${os.homedir()}`);
		console.log(`Hostname: ${os.hostname()}`);
		console.log(`Load average: ${os.loadavg()}`);
		console.log('Network interfaces:', os.networkInterfaces());
		console.log(`Up time: ${(os.uptime() / 3600).toFixed(2)} hr`); // uptime [seconds]
		console.log('User info:', os.userInfo());
		console.groupEnd();

		// // single keys
		// Mousetrap.bind('4', function() { console.log('4'); });
		// Mousetrap.bind("?", function() { console.log('show shortcuts!'); });
		// Mousetrap.bind('esc', function() { console.log('escape'); }, 'keyup');
		//
		// // combinations
		// Mousetrap.bind('command+shift+k', function() { console.log('command shift k'); });
		//
		// // map multiple combinations to the same callback
		// Mousetrap.bind(['command+k', 'ctrl+k'], function() {
		//
		//     console.log('command k or control k');
		//
		//     // return false to prevent default browser behavior
		//     // and stop event from bubbling
		//     return false;
		//
		// });
		//
		// // gmail style sequences
		// Mousetrap.bind('g i', function() { console.log('go to inbox'); });
		// Mousetrap.bind('* a', function() { console.log('select all'); });
		//
		// // konami code!
		// Mousetrap.bind('up up down down left right left right b a enter', function() {
		//     console.log('konami code');
		//
		// });

		// console.log(`returned value: ${ 0 || '' || 'helloworld' || 'stuff' }`);

		// const saveBtn = document.getElementById('save-dialog')
		//
		// saveBtn.addEventListener('click', function (event) {
		// 	ipc.send('save-dialog');
		// })
		//
		// ipc.on('saved-file', function (event, path) {
		// 	if (!path) path = 'No path';
		// 	document.getElementById('file-saved').innerHTML = `Path selected: ${path}`;
		// })

		// // Asynchronous file read
		// fs.readFile('input.txt', function (err, data) {
		// 	if (err) {
		//     	return console.error(err);
		// 	}
		// 	console.log(`Asynchronous read: ${data.toString()}`);
		// 	console.log("Going to write into existing file");
		// 	fs.writeFile('input.txt', data.toString() + 'Simply Easy Learning!',  function(err) {
		// 	   if (err) {
		// 	      return console.error(err);
		// 	   }
		//
		// 	   console.log("Data written successfully!");
		// 	   console.log("Let's read newly written data");
		// 	   fs.readFile('input.txt', function (err, data) {
		// 	      if (err) {
		// 	         return console.error(err);
		// 		 }
		// 	      console.log(`Asynchronous read: ${data.toString()}`);
		// 	   });
		// 	});
		// });
		//
		// // Synchronous file read
		// var data = fs.readFileSync('input.txt');
		// console.log("Synchronous read: " + data.toString());
	}());

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
	wgtMap = [ 'statusbar-widget', 'strippit-widget', 'settings-widget', 'connection-widget', 'help-widget' ];
	// wgtMap = ['statusbar-widget', 'settings-widget', 'connection-widget', 'help-widget'];
	// Gets set to true once respective widget publishes '/widget-loaded'.
	// Ex. [ false, false, ..., false ]
	wgtLoaded = [];
	// wgtVisible = 'connection-widget';
	wgtVisible = 'strippit-widget';
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
		'settings-widget': { loadHtml: true, sidebarBtn: true },
		'connection-widget': { loadHtml: true, sidebarBtn: true },
		'help-widget': { loadHtml: true, sidebarBtn: true }
	};

	wgtLen = wgtMap.length;

	for (let i = 0; i < wgtLen; i++) {
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
			if (wgtLoaded.indexOf(false) != -1) {
				const that = this;
				let errorLog = '!! Widget(s) Not Successfully Loaded !!';
				$.each(wgtLoaded, (i, item) => {
					errorLog += (item) ? '' : `\n  ${that.wgtMap[i]} widget`;
				});
				console.error(errorLog);
				alert(errorLog);
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
			if (wgtLoaded.indexOf(false) == -1) {
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

	createWidgetContainer = function (wgt) {
		// append a div container to dom body
		console.log('  Creating widget DOM container');

		const containerHtml = `<div id="${wgt}" class="widget-container hidden"></div>`;
		$('body').append(containerHtml);
	};
	loadHtmlWidget = function (wgt) {
		console.log('  Loading HTML & JS');

		$(`#${wgt}`).load(`html/${wgt}.html`, '', () => {
			requirejs([ wgt ], (ref) => {
				ref.loadHtml = widget[wgt].loadHtml;
				ref.sidebarBtn = widget[wgt].sidebarBtn;

				widget[wgt] = ref;

				ref.initBody();
			});
		});
	};
	loadJsWidget = function (wgt) {
		console.log('  Loading JS');

		requirejs([ wgt ], (ref) => {
			ref.loadHtml = widget[wgt].loadHtml;
			ref.sidebarBtn = widget[wgt].sidebarBtn;
			widget[wgt] = ref;

			ref.initBody();
		});
	};
	createSidebarBtns = function (wgt) {
		console.log('Creating Sidebar Buttons');
		$.each(widget, (widgetIndex, widgetItem) => {
			// Check if the respective widget wants a sidebar button made
			console.log(`  ${widgetIndex}`);
			if (widgetItem.sidebarBtn === undefined || widgetItem.sidebarBtn === null) {
				console.log('    ...jk, not creating sidebar button.');
			} else {
				// var btnHtml = '<span id="btn-' + widgetIndex + '" evt-data="' + widgetIndex + '" class="btn btn-' + widgetItem.ref.btnTheme;
				let btnHtml = `<span id="btn-${widgetIndex}" evt-data="${widgetIndex}" class="btn btn-${widgetItem.btnTheme}`;
				btnHtml += (widgetItem.sidebarBtn) ? '' : ' hidden';
				// btnHtml += '"><div><span class="' + widgetItem.ref.icon + '"></span></div><div>';
				btnHtml += `"><div><span class="${widgetItem.icon}"></span></div><div>`;
				btnHtml += (widgetItem.shortName) ? widgetItem.shortName : widgetItem.name;
				btnHtml += '</div></span>';
				$('#sidebar').append(btnHtml);
			}
		});
	};
	initWidgetVisible = function () {
		// Show the initial widget.
		console.log(`Show wgt: ${wgtVisible}`);
		$(`#${wgtVisible}`).removeClass('hidden');
		// $('#header-widget-label').text(widget[wgtVisible].ref.name); // Set header bar label.
		$('#header-widget-label').text(widget[wgtVisible].name); // Set header bar label.
		// $('#header-widget-icon').addClass(widget[wgtVisible].ref.icon); // Set header bar icon.
		$('#header-widget-icon').addClass(widget[wgtVisible].icon); // Set header bar icon.
		publish(`/${this.ws.id}/widget-visible`, wgtVisible, null);
	};
	makeWidgetVisible = function (wgt) {
		console.log(`Widget visible: ${wgt}`);
		// If wgt is already visible, do nothing.
		if (wgt == wgtVisible) return;
		// console.log("  wgt: " + wgt + "\n  wgtVisible: " + wgtVisible);

		// Hide previously visible widget.
		$(`#${wgtVisible}`).addClass('hidden');
		// $('#header-widget-icon').removeClass(widget[wgtVisible].ref.icon);
		$('#header-widget-icon').removeClass(widget[wgtVisible].icon);

		// Show the requested widget.
		$(`#${wgt}`).removeClass('hidden');
		// $('#header-widget-label').text(widget[wgt].ref.name); // Set header bar label.
		$('#header-widget-label').text(widget[wgt].name); // Set header bar label.
		// $('#header-widget-icon').addClass(widget[wgt].ref.icon); // Set header bar icon.
		$('#header-widget-icon').addClass(widget[wgt].icon); // Set header bar icon.
		publish(`/${this.ws.id}/widget-visible`, wgt, wgtVisible);
		wgtVisible = wgt;
	};
	updateGitRepo = function () {
		// Pulls the latest repository from the master branch on GitHub.

		let terminal = null;

		// Skip the update if host is my laptop or if there is no internet connection.
		if (hostMeta.hostName === 'BRAYDENS-LAPTOP' || !navigator.onLine) {
			return false;
		}

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
	};
	// initSidebarBtnEvts = function() {
		// This has to be called after the sidebar DOM buttons have been created.
		// console.log("Initializing sidebar button click events.");
		// $('#sidebar').on('click', "span.btn", function(evt) {
		// 	// console.log($(this).attr('evt-data'));
		// 	makeWidgetVisible($(this).attr('evt-data'));
		// });
	// };

	// initBody();
});
