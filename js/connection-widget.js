/* Connection Widget JavaScript */

define(['jquery'], function ($) {
return {
	id: "connection-widget",
	name: "Terminal",
	shortName: "Terminal",
	btnTheme: "warning",
	icon: "fa fa-usb",
	desc: "The connection widget handles the automated-based process of connecting to the JSON server and the controller hardware board via a websocket. It also handles the sending and receiving of data to and from the controller board via the websocket connection. The data to be sent is received via pub/sub events. The received data from the SPJS and connected ports is broadcasted in publish calls.",
	publish: {},
	subscribe: {
		'/spjs-send [cmd]': "Sends message directly to SPJS. Do not use this for sending data to specific ports, for that use '/port-send', '/port-sendnobuf', or '/port-sendjson'.",
		'/port-send [port] [cmd]': "Sends message to connected port on the SPJS as 'send [port] [cmd]'.",
		'/port-sendnobuf [port] [cmd]': "Sends message to connected port on the SPJS as 'sendnobuf [port] [cmd]'.",
		'/port-sendjson [port] [cmd] [id]': "Sends message to connected port on the SPJS as 'sendjson { P: [port], D: {[ Data: [cmd], Id: [id] ], [ Data: [cmdn], Id: [id]n ]} }'.",
		'/port-sendjson [port] [ [cmd], [cmd1], ..., [cmdn] ] [id]': "Sends message to specified port on the SPJS as 'sendjson { P: [port], D: {[ Data: [cmd], Id: [id]-0 ], [ Data: [cmdn], Id: [id]-1 ]} }'."
	},
	foreignPublish: {
		'/main/widget-loaded': "",
		'/statusbar-widget/add': ""
	},
	foreignSubscribe: {
		'/main/all-widgets-loaded': "",
		'/main/window-resize': "",
		'/main/widget-visible': ""
	},

	// TODO: Reference Dom elements via the domCache object.
	// dom: {
	// 	'consoleLogPanel': $(),
	// 	'consoleLogInput': $(),
	// 	'portListPanel': $()
	// }

	// The widgetDom array stores the info needed to resize the widget elements.
	// Ex. [['container element', 'element to get size of', 'element to get size of', 'element to change size of']],
	widgetDom: [
		['.widget-container', ' .splist-panel', ' .console-log-panel'],
		[' .console-log-panel', ' .panel-heading', ' .panel-footer', ' .panel-body'],
		[' .console-log-panel .panel-body', ' .console-log-output']
	],
	// widgetDom: [],
	// widgetVisible stores the visible or hidden state of the widget.
	widgetVisible: false,

	// Stores information required to connect to and communicate with the SPJS WebSocket.
	// IDEA: Restructure the shit outta this stuff.
	SPJS: {
		// Stores the WebSocket connection to the Serial Port JSON Server.
		go: null,
		// Stores the WebSocket connection to the GPIO JSON Server.
		gpio: null,
		// Stores the WebSocket object.
		ws: null,
		// Stores the current state of the WebSocket to prevent unnecessary DOM updates.
		wsState: null,
		// Stores the SPJS software version.
		version: null,
		commands: [],
		hostname: null,
		// Stores information on each available port in the SPJS.
		// Ex. { COM5: {...}, COM7: {...}, COM9: {...}, COM10: {...} }
		portList: {},
		// If there are no differences in the portListDiffs => undefined.
		// Ex. { added: [ "COM5", "COM7", "COM9", "COM10" ], opened: [ "COM5", "COM10" ] }
		// Ex. Port: added / removed / opened / closed / feedrate
		// Ex. SPJS: [ no list -> list / list -> no list ]
		portListDiffs: {},
		// The portMeta object stores the meta data for the each port on the SPJS.
		// Ex. [{ metaIndex: null, Name: null, Friendly: null, Baud: null, Buffer: null, muteRelatedPort: null, portMuted: null }]
		portMeta: {},
		// The openPorts object stores the names of the ports that are open.
		// Ex. ["COM5", "COM10"]
		openPorts: [],
		launchGpioServerOnLinux: true,
		// Sets the time (msec) that the program will wait between attempting to connect to the WebSocket.
		// If wsPollReconnect has a value of 'null', no auto reconnection attempts will be made.
		// NOTE: Loaded by cson file.
		wsReconnectDelay: 2000,
		// Sets if a new spjs is launched after an exit command is issued to the current spjs. If false, a new spjs may be launched based on the setting of wsReconnectDelay.
		wsReconnectOnExitCmd: true,
		// Sets the time (msec) that the program will wait between getting the port list when there are no available ports.
		// If requestListDelay has a value of 'null', no automatic list requests will be sent.
		// Use a value greater than approx 500ms to ensure the stability of the program.
		// NOTE: Loaded by cson file.
		requestListDelay: null,
		// requestListDelay: 10000,
		// NOTE: Loaded by cson file.
		exitUntrustedSpjs: true,
		// Keep track of how many commands are in the SPJS queue.
		queueCount: 0,
		pauseOnQueueCount: 1000,
		resumeOnQueueCount: 700,
		maxLinesAtATime: 100
	},

	// TODO: Restructure the deviceMeta object.
	newdeviceMeta: {},
	// NOTE: Loaded by cson file.
	// TODO: Change this from an array to an object and create a meta called 'default' rather than using the empty string for Vid/Pids convention.
	deviceMeta: [
		{ Friendly: 'TinyG G2 Native',
			Baud: 115200,
			Buffer: 'tinygg2',
			useReceivedFriendly: false,
			autoConnectPort: true,
			portMuted: false,
			VidPids: [
				{ Vid: '1D50', Pid: '606D' }
			]
		},
		{ Friendly: 'TinyG G2 Native [Virtual]',
			Baud: 115200,
			Buffer: 'tinygg2',
			useReceivedFriendly: false,
			autoConnectPort: false,
			portMuted: true,
			VidPids: [
				{ Vid: '1D50', Pid: '606D' }
			]
		},
		{ Friendly: 'TinyG G2 Programming',
			Baud: 115200,
			Buffer: 'tinygg2',
			useReceivedFriendly: false,
			autoConnectPort: false,
			portMuted: true,
			VidPids: [
				{ Vid: '2341', Pid: '003D' }
			]
		},
		{ Friendly: 'TinyG v8',
			Baud: 115200,
			Buffer: 'tinyg',
			useReceivedFriendly: false,
			autoConnectPort: true,
			portMuted: false,
			VidPids: [
				{ Vid: '0403', Pid: '6015' }
			]
		},
		// { Friendly: 'Tinyg v9', Baud: 115200, Buffer: 'tinygg2', VidPids: [{ Vid: '', Pid: '' }] },
		// { Friendly: 'FTDI or TinyG',
		// 	Baud: 115200,
		// 	Buffer: 'tinyg',
		// 	useReceivedFriendly: true,
		// 	autoConnectPort: false,
		// 	portMuted: false,
		// 	VidPids: [
		// 		// { Vid: '0403', Pid: '6015' }
		// 		{ Vid: '', Pid: '' }
		// 	]
		// },
		{ Friendly: 'Arduino Uno',
			Baud: 9600,
			Buffer: 'default',
			useReceivedFriendly: false,
			autoConnectPort: false,
			portMuted: false,
			VidPids: [
				{ Vid: '2341', Pid: '0043' },
				{ Vid: '2341', Pid: '0001' },
				{ Vid: '2A03', Pid: '0043' }
			]
		},
		{ Friendly: 'Arduino Duemilanove',
			Baud: 9600,
			Buffer: 'default',
			useReceivedFriendly: false,
			autoConnectPort: false,
			portMuted: false,
			VidPids: [
				{ Vid: '0403', Pid: '6001' }
			]
		},
		{ Friendly: 'Arduino Yun',
			Baud: 9600,
			Buffer: 'default',
			useReceivedFriendly: true,
			autoConnectPort: false,
			portMuted: false,
			VidPids: [
				{ Vid: '2341', Pid: '0041' },
				{ Vid: '2341', Pid: '8041' },
				{ Vid: '2A03', Pid: '0041' },
				{ Vid: '2A03', Pid: '8041' }
			]
		},
		{ Friendly: 'Bossa Program Port',
			Baud: 115200,
			Buffer: 'tinyg',
			useReceivedFriendly: false,
			autoConnectPort: false,
			portMuted: false,
			VidPids: [
				{ Vid: '03EB', Pid: '6124' }
			]
		},
		{ Friendly: 'TI MSP430',
			Baud: 115200,
			Buffer: 'default',
			useReceivedFriendly: true,
			autoConnectPort: false,
			portMuted: false,
			lineEnding: 'CRLF',
			VidPids: [
				{ Vid: '2047', Pid: '0013' }
			]
		},
		{ Friendly: 'Device Not Recognized',
			Baud: 9600,
			Buffer: 'default',
			useReceivedFriendly: true,
			autoConnectPort: false,
			portMuted: false,
			VidPids: [
				{ Vid: '', Pid: '' }
			]
		}
	],
	// If VidPids does not match portVid and portPid, assume serial device is a TinyG v8 board.
	// NOTE: Loaded by cson file.
	// TODO: Deprecate this cuz the default deviceMeta is the one with Vid/Pids as an empty string.
	defaultMetaIndex: 3,

	// Specify Friendly, Buffer, Baud, SerialNumber.
	// The first matching script will be ran. So put default scripts last.
	// NOTE: Loaded by cson file.
	initScripts: [],

	// Stores the label and description for each status code for the tinyG controller.
	// Built on program load from the 'TinyG_Status_Codes.cson' file.
	tinygStatusMeta: {},

	// Use this to receive raw port data for a port before we get a port's 'open' message. This data gets transfered over to the port's dataRecvBuffer and this buffer is cleared once the port is officially opened.
	// Ex. { COM5: "...", COM10: "..." }
	tempDataRecvBuffer: {},
	// The dataRecvBuffer object is used to buffer raw port data as it is received so that it can be parsed into complete and individual lines of data.
	// Ex. { COM5: "...", COM10: "..." }
	// IDEA: Move the dataRecvBuffer object into each port's object.
	dataRecvBuffer: {},

	// New data gets pushed onto the buffer and shift out items to send.
	dataSendBuffer: {},

	// IDEA: Restructure the shit outta this stuff.
	consoleLog: {
		// The activeLog string stores the name of the currently open console log.
		activeLog: 'SPJS',
		// The openLogs object stores the names of the console logs that are open. Ports are sorted smallest -> largest port number with the SPJS log at the end of the list.
		// Ex. ["COM7", "COM10", "SPJS"]
		openLogs: [ 'SPJS' ],
		// Specifies the maximum number of lines to be displayed in the console log.
		// NOTE: Loaded by cson file.
		maxLineLimit: 500,
		// Specifies the minimum number of lines to be displayed in the console log.
		// NOTE: Loaded by cson file.
		minLineLimit: 250,
		// Sets the time limit (ms) that an active command in the console log can prevent other commands of the same type from being set.
		// NOTE: Loaded by cson file.
		staleCmdLimit: 30000,
		// Sets the number of digits that will be displayed by default. If the line number exceeds this, the number of digits used will be increased.
		// NOTE: Loaded by cson file.
		minLineNumberDigits: 3,
		// FIXME: Set the removeLogOnClose flag to false to prevent a port's log from being closed when the port is closed so that issues can be more easily troubleshooted.
		removeLogOnClose: true,
		// The maximum age of an unverified command that will be set to status error in the log when the SPJS closes (milliseconds).
		// Set to null for no limit.
		// errorCmdOnSpjsCloseMaxAge: 5000,
		errorCmdOnSpjsCloseMaxAge: null,
		// The maximum age of a command in the Spjs that can be assigned the status 'sent'.
		sentSpjsCmdMaxAge: 10000,
		// Sets if the time to verify a given command is added beside the command in the console log as a comment.
		// NOTE: Loaded by cson file.
		commentTimeToVerify: true,
		// Add a comment to every command to show it's id. Very useful for debugging.
		commentCmdId: true,
		// Set the default line ending to be used for messages sent to ports on the SPJS. This is over-ridden by lineEnding inside each port's respective deviceMeta object.
		//  NONE: No line ending characters are added to port messages.
		//  CR: Add a carriage-return character '\r'.
		//  LF: Add a line-feed character '\n'.
		//  CRLF: Add a carriage-return and line-feed character '\r\n'.
		defaultLineEnding: 'LF',
		// Stores the different line endings.
		lineEndings: {
			NONE: '',
			CR: '\\r',
			LF: '\\n',
			CRLF: '\\r\\n'
		},
		SPJS: {
			// The logData object stores all the messages and commands added to the console log.
			// A message would be { msg: '', type: '', line: '' }
			// A command would be { msg: '', type: '', line: '', id: '', meta: '', status: '', time: '', comment: '' }
			logData: [],
			// The cmdMap object stores the index of all command messages in the logData object.
			cmdMap: [],
			// The verifyMap object stores the index of all command messages in the logData object that still need to be verified.
			verifyMap: [],
			// TODO: Remove this.
			msgCount: 0,
			// Using lineCount to keep track of how many lines are in the console log and is used to make unique id for SPJS commands.
			lineCount: 0,
			// value [string] - Stores the most recent information in the respective port's <input> element. Used to fill in the text field when switching between console log tabs.
			value: '',
			// inputStatus [string] - Stores the most recent status of the respective port's <input> element. Used to correctly hilite the input field when switching between console log tabs.
			inputStatus: null,
			cmdCount: 0,
			// history [array] - Stores all the commands submitted by the respective port's <input> element. Used to recall previously issued commands.
			history: [],
			// historyRecallIndex [number] - Stores the current history recall index. Value of 'null' indicates that no history recall is happening.
			historyRecallIndex: null,
			// placeholder [string] - Stores the text used as the placeholder for the <input> element.
			// Loaded by cson file.
			placeholder: 'SPJS Command',
			// verifyBuffer [array[objects]] - Store info about commands sent to the SPJS until they are echoed back. status: sent/received
			// verifyBuffer: [ { Data: "", Id: "", Time: 1475972430427, Status: "Sent" } ],
			// TODO: Phase Out the verifyBuffer object.
			verifyBuffer: [],
			// The logHtml array stores each msgHtml that is added to the console log (oldest -> recent).
			// logHtml: []
			// NOTE: Loaded by cson file.
			msgShow: {
				'default': true,
				stdout: true,
				stderr: true,
				Version: true,
				Commands: true,
				BufferAlgorithm: true,
				BaudRate: true,
				Hostname: true,
				SerialPorts: true,
				Open: true,
				OpenFail: true,
				Close: true,
				Broadcast: true,
				WipedQueue: true,
				Queued: true,
				Write: true,
				Complete: true,
				CompleteFake: true,
				Error: true,
				FeedRateOverride: true,
				RawPortData: true,
				GarbageCollection: true,
				GarbageHeap: true,
				ExecRuntimeStatus: true,
				ExecStatus: true,
				Command: true,
				MdiCommand: true,
				CommandEcho: true
			}
		},
		// Add 'samp' to use a samp DOM tag, default is 'code'.
		// NOTE: Loaded by cson file.
		style: {
			lineWrap: false,
			'default': 'text-default',
			stdout: 'samp text-muted',
			stderr: 'samp text-muted',
			Version: 'text-muted',
			Commands: 'text-muted',
			BufferAlgorithm: 'text-muted',
			BaudRate: 'text-muted',
			Hostname: 'text-muted',
			SerialPorts: 'text-muted',
			Open: 'text-success',
			OpenFail: 'text-danger',
			Close: 'text-danger',
			Broadcast: 'text-info',
			WipedQueue: 'text-success',
			Queued: 'text-warning',
			Write: 'hilite-blue',
			Complete: 'text-success',
			CompleteFake: 'text-success',
			Error: 'text-danger',
			FeedRateOverride: 'text-info',
			RawPortData: 'text-info',
			GarbageCollection: 'text-muted',
			GarbageHeap: 'text-muted',
			ExecRuntimeStatus: 'text-muted',
			ExecStatus: 'text-muted',
			SpjsCommand: 'text-default',	// A command sent to the spjs that is placed in the respective port's log.
			Command: 'samp text-default',
			MdiCommand: 'samp hilite-blue',	// A command that origionated at the text input field.
			CmdComment: 'samp text-muted',
			CommandEcho: 'text-default'
		},
		// Command Verification Steps:
		// 1. Sent - Your Gcode has been sent to the SPJS.
		// 2. Queued - Gcode is queued inside the SPJS and waiting to be sent to the CNC controller's serial buffer.
		// 3. Written - Gcode has been written to the serial buffer of your CNC controller and removed from the SPJS's buffer.
		// 4. Completed - Gcode is completed when the CNC controller tells us it read the Gcode from it's serial buffer and placed the Gcode into it's planner buffer (this means the Gcode may only get executed seconds into the future as the planner buffer works it's way through lines).
		// 5. Executed (optional) - The CNC controller tells us that your Gcode was actually executed. This is the final step. On controllers like TinyG this data only comes back if line numbers are in your Gcode.
		// 6. Error (optional) - The CNC controller failed to execute the line of Gcode. This could indicate a problem with your Gcode syntax, or that your CNC controller does not understand a particular Gcode command.
		// NOTE: Loaded by cson file.
		verifyStyle: {
			New: 'fa-check text-muted',
			Sent: 'fa-check text-default',
			Queued: 'fa-check text-warning',
			Written: 'fa-check hilite-blue',
			Completed: 'fa-check text-success',
			Executed: 'fa-check text-success',
			Warning: 'fa-exclamation-triangle text-warning',
			Error: 'fa-times text-danger'
		},
		// The verifyPrecidence object sets the precidence of status so that a command cannot be un-verified if messages are not received from the SPJS in the correct order.
		verifyPrecidence: [ 'New', 'Sent', 'Queued', 'Written', 'Completed', 'Executed', 'Warning', 'Error' ],
		// Used to create the msgShow object in each port's consoleLog object.
		// NOTE: Loaded by cson file.
		msgShowDefault: {
			'default': true,
			Open: true,
			OpenFail: true,
			Close: true,
			Broadcast: true,
			WipedQueue: true,
			Queued: true,
			Write: true,
			Complete: true,
			CompleteFake: true,
			Error: true,
			FeedRateOverride: true,
			RawPortData: true,
			SpjsCommand: true,	// A command sent to the spjs that is placed in the respective port's log.
			Command: true,
			MdiCommand: true
		},
		appendMsg(port, { Msg, Id, IdPrefix, Type, Status, Comment, Related, Meta }) {
			// This method gets called when a message is received from the SPJS and ports on the SPJS.
			// If Id is provided, it will be used for the message's id.
			// If Id is omitted but IdPrefix is provided, a new id based on the IdPrefix, port number, and line number will be created.
			// If both Id and IdPrefix are omitted, a new id based on the port number and line number will be created.
			// NOTE: The Id argument will be ignored if the IdPrefix argument is provided.

			// Check that the message argument is valid.
			if (Msg === '') {
				console.log('The append message method got the Msg argument as an empty string.');

			} else if (Msg === undefined) {
				// console.log('Aborted the append message method because the Msg argument was omitted.');
				throw 'Aborted the append message method because the Msg argument was omitted.'
				return false;

			} else if (typeof Msg === 'object') {
				// console.warn(`The append message method got called with a message that is an object.\nMessage: ${Msg}\nParsed Message: ${JSON.stringify(Msg, null, ' ')}`);
				Msg = JSON.stringify(Msg, null, ' ').replace(/\}$/, ' \}');
			}

			// Check that the Type argument is valid.
			if (Type === undefined || this.style[Type] === undefined) {
				console.error('The append message method received a bad Type argument. Using default.\n  Type:', Type);
				Type = 'default';
			}

			// Prevent any messages containing '<' or '>' because these can mess with the console log DOM structure.
			if (/[<>]/.test(Msg)) {
				if (Type === 'stdout' || Type === 'stderr') console.log(`There are '<' and/or '>' character(s) in the Msg argument. These can mess with the DOM structure of the console log. Characters removed.\nMessage: ${Msg}\nNew Message: ${Msg.replace(/</g, '&#60;').replace(/>/g, '&#62;')}`);
				Msg = Msg.replace(/</g, '&#60;').replace(/>/g, '&#62;');
			}

			// Apply the default values here so that warning messages can be logged.
			IdPrefix = IdPrefix || '';
			Status = Status || 'New';
			Meta = Meta || [];
			Comment = Comment ? `[${Comment}]` : '';

			if (Related && typeof Related === 'string') {
				Related = { Port: Related };

			// This shouldnt be needed becuse if there is just a single related command, the id of the command in the spjs will be the same as that of the related command.
			} else if (Related && Related.Id && typeof Related.Id === 'string') {
				Related.Id = [ `${Related.Id}` ];

			}

			// If the logData object has elements, get the line number from the last message in the logData object.
			let logLength = this[port].logData.length;
			const Line = logLength ? this[port].logData[logLength - 1].Line + 1 : 0;

			// If the message is a command.
			if (Type === 'Command' || Type === 'MdiCommand') {
				console.groupCollapsed(`Append: ${Msg}`);

				// Make the id.
				if (IdPrefix) {
					Id = `${IdPrefix}-${port.toLowerCase().replace(/com/i, 'p').replace(/fs-dev-fs-tty/i, '')}n${Line}`

				} else {
					Id = Id ? Id : `${port.toLowerCase().replace(/com/i, 'p').replace(/fs-dev-fs-tty/i, '')}n${Line}`;
				}

				if (this.commentCmdId) {
					Comment = Comment ? `${Comment} [${Id}]`: `[${Id}]`;
				}

				// Turn the Meta argument into an array.
				Meta = (typeof Meta === 'string') ? Meta.split(' ') : Meta;

				// Add the command data to this port's logData object.
				logLength = this[port].logData.push({ Msg, Id, Line, Type, Status, Comment, Related, Meta, Time: Date.now() });
				this[port].cmdMap.push(logLength - 1);
				console.log(`Pushed onto cmdMap: ${this[port].cmdMap}`);

				// If the command is not already verified, add it to the verifyBuffer object.
				// if (Status !== 'Executed' && Status !== 'Error' && !(Status === 'Completed' && Meta.includes('NumberedGCode')))
				if (this.verifyPrecidence.indexOf(Status) < this.verifyPrecidence.indexOf('Completed')) {
					this[port].verifyMap.push(logLength - 1);
					console.log(`Pushed onto verifyMap: ${this[port].verifyMap}`);
				}

			// If the message is not a command.
			} else {
				// Add the message data to this port's logData object.
				logLength = this[port].logData.push({ Msg, Type, Line});
			}

			// If the style object says that this message should not be shown, abort this method.
			// if (!this[port].msgShow[Type]) return Id;
			if (!this[port].msgShow[Type]) return (Type === 'Command' || Type === 'MdiCommand') ? Id : false;

			// JQuery reference to the console log panel.
			const logPanel = $(`#connection-widget .console-log-panel .log-${port}`);

			const prefixZeros = (Line.toString().length > this.minLineNumberDigits) ? 0 : this.minLineNumberDigits - Line.toString().length;
			const domLineNumber = '0'.repeat(prefixZeros) + Line;

			const domTag = (this.style[Type].includes('samp')) ? 'samp':'code';
			const domClass = ((port === 'SPJS') ? (this.style.lineWrap ? '' : 'text-nowrap ') : (this.style.lineWrap ? 'text-prewrap ':'text-pre ')) + this.style[Type].replace('samp ', '');
			const domMsg = Msg.replace(/\n/g, '').replace(/\r/g, '').replace(/\\"/g, '\"');

			// Build DOM element for the line number and left margin.
			let msgHtml = `<span class="text-muted" style="font-size: 8px; margin-right: ${(Type === 'Command' || Type === 'MdiCommand') ? '3px':'19px'}; margin-left: 0px;">${domLineNumber}</span>`;

			// Build DOM elements for command message.
			if (Type === 'Command' || Type === 'MdiCommand') {
				console.log(`Port: ${port}\nMsg: ${Msg}\nType: ${Type}\nId: ${Id}\nStatus: ${Status}\nMeta: ${Meta}\nComment: ${Comment}\n${ Related ? (Related.Port ? `\nRelated Port: ${Related.Port}` : '') + (Related.Id ? `\nRelated Id: ${CSON.stringify(Related.Id)}` : '') : '' }`);
				console.log('logData:', this[port].logData, '\ncmdMap:', this[port].cmdMap, '\nverifyMap:', this[port].verifyMap);

				const domCommentTag = (this.style.CmdComment.includes('samp')) ? 'samp':'code';
				const domCommentClass = ((this.style.lineWrap) ? 'text-pre ':'text-prewrap ') + this.style.CmdComment.replace('samp ', '');
				const domComment = Comment;

				msgHtml += `<span class="fa fa-check fa-fw verify-mark ${Id} ${this.verifyStyle[Status]}" style="font-size: 10px; margin-right: 3px;"></span>`;
				msgHtml += `<${domTag} class="cmd ${domClass}">${domMsg}</${domTag}>`;
				msgHtml += `<${domCommentTag} class="cmd-comment ${Id} ${domCommentClass}" style="margin-left: 6px;">${domComment}</${domCommentTag}><br>`;

				console.groupEnd();

			// Build DOM elements for message.
			} else {
				msgHtml += `<${domTag} class="${domClass}">${domMsg}</${domTag}><br />`;
			}

			// If the console log is longer than the limit, reduce the length of the log.
			if (logLength > this.maxLineLimit) {
				this.truncateLog(port);
			}

			// Add the message to the bottom the the console log.
			logPanel.append(msgHtml);

			// Scroll to bottom of console log.
			logPanel.scrollTop(logPanel.prop('scrollHeight'));

			// Return the Id used for this command so that it can be used for related messages on other port's logs.
			if (Type === 'Command' || Type === 'MdiCommand') {
				// this.updateCmd(port, { Index: logLength - 1, Comment: Id, UpdateRelated: false });

				// logLength = this[port].logData.push({ Msg, Id, Type, Status, Meta, Comment, Related, Line, Time: Date.now() });
				logItem = this[port].logData[logLength - 1];

				return {
					cmdMsg: logItem.Msg,
					cmdId: logItem.Id,
					cmdLine: logItem.Line,
					cmdType: logItem.Type,
					cmdStatus: logItem.Status,
					cmdComment: logItem.Comment,
					cmdRelated: logItem.Related,
					cmdLine: logItem.Line,
					cmdTime: logItem.Time,
				};

			}

			return true;
			// return (Type === 'Command' || Type === 'MdiCommand') ? Id : true;

		},
		truncateLog(port) {
			// console.log(`Truncate the '${port}' log.`);

			// Have to re-assign index values in the cmdMap and verifyMap objects to point to new locations of items in the logData object and remove pointers to items that have been truncated.
			// Re-build the port's log using this.buildLog(port).
		},
		buildLog(port) {
			console.log(`Build the '${port}' log.`);
		},
		makeRegExpSafe(str) {
			console.log(`String: ${str}`);

			let safeString = '';

			for (let i = 0; i < str.length; i++) {
				// If the character is any alphanumeric character, add it to safeString.
				if (/\w| /.test(str[i])) {
					safeString += str[i];

				} else {
					safeString += '\\' + str[i]

				}
			}

			console.log(`safeString: ${safeString}`);

			return safeString;
		},
		checkMatchItem({ Msg, PartMsg, Length, Id, Line, Type, Meta, MinAge, MaxAge, LogItem }) {

			console.log(`LogItem: %O`, LogItem);

			if (Msg !== undefined && LogItem.Msg !== Msg) return false;
			if (PartMsg && !PartMsg.test(this.makeRegExpSafe(LogItem.Msg))) return false;
			if (Length !== undefined && LogItem.Msg.length !== Length) return false;
			if (Id !== undefined && LogItem.Id !== Id) return false;
			if (Line !== undefined && LogItem.Line !== Line) return false;
			if (Type !== undefined && LogItem.Type !== Type) return false;
			if (MinAge !== undefined && LogItem.Time - Date.now() < MinAge) return false;
			if (MaxAge && LogItem.Time - Date.now() > MaxAge) {

				if (MaxAge == this.staleCmdLimit && this.verifyPrecidence.indexOf(LogItem.Status) < this.verifyPrecidence.indexOf('Completed')) {

					this.updateCmd(port, { Index: logIndex, Status: 'Warning', Comment: 'Stale', UpdateRelated: true });

				}

				console.log('Found stale command.');

				return false;
			}

			// Only counts a match as: all elements of Meta array are in the LogItem.Meta array.
			if (Meta !== undefined) {
				let matchCount = 0;

				for (let x = 0; x < Meta.length; x++) {
					// if (!LogItem.Meta.includes(Meta[x])) matchCount++;
					if (!LogItem.Meta.includes(Meta[x])) return false;

				}

				// if (matchCount == Meta.length) return false;
			}

			return true;
		},
		findItem(port, { Msg, PartMsg, Length, Id, Line, Type, Meta, MinAge, MaxAge, Index, IndexMap, SearchFrom = 0 }) {
			// Return logData item of matched command within the specified search space.
			// Defaults to searching entire logData object, use IndexMap to narrow that search.
			// Arg. IndexMap [array][optional] - Array of indexes to search for in the logData object (eg. [1, 15, 27, 69]).
			// Arg. StartFrom [number/string][optional] - Defaults to zero (eg. 10, 'Last').

			const that = this;

			if (IndexMap === undefined && Index === undefined) {
				throw 'IndexMap is undefined.'
				// console.warn('IndexMap is undefined.');
				IndexMap = this[port].cmdMap;

			}

			let matchFound = false;
			let matchIndex = Index;
			const dataRef = Msg !== undefined ? 'Msg' : (PartMsg !== undefined ? 'PartMsg' : (Length !== undefined ? 'Length' : (Id !== undefined ? 'Id' : (Line !== undefined ? 'Line' : 'Type'))));
			const data = arguments[1][dataRef];
			const logData = this[port].logData;

			console.groupCollapsed(`Find - ${dataRef}: ${data}`);

			let refMsg;

			// If the PartMsg argument is already a RegExp.
			if (PartMsg && PartMsg.constructor === RegExp) {
				console.log('PartMsg is a regExp.');
				refMsg = PartMsg;

			// If the PartMsg argument is a string.
			} else if (PartMsg) {
				// Use a RegExp to match data to command in verifyBuffer.
				// Replace the square brackets with text because the square brackets mess with the RegExp and match method.
				// Note that any '\' character in the buffer is a text item but in the RegExp it becomes a modifier.
				// refMsg = PartMsg.toLowerCase().replace(/\[/g, 'sqOpBk').replace(/\]/g, 'sqClBk').replace(/\\n/g, 'newline').replace(/\\r/g, 'returnline').replace(/\\/g, '\\\\');
				refMsg = new RegExp(this.makeRegExpSafe(PartMsg), 'i');

				console.log(`Got PartMsg as a string. refMsg: ${refMsg}`);

			}

			// Make sure that the Meta argument is an array.
			if (Meta !== undefined && !Array.isArray(Meta)) {
				Meta = [].push(Meta);
			}

			if (MaxAge === undefined) {
				MaxAge = this.staleCmdLimit;
			}

			// Make sure that the SearchFrom argument is valid.
			if (SearchFrom >= logData.length || logData.length + SearchFrom < 0) {
				throw `Invalid SearchFrom value.\n  SearchFrom: ${SearchFrom}\n  IndexMap.length: ${IndexMap.length}`

			}

			// If the Index argument was given.
			if (Index !== undefined) {
				console.log('Index argument was given so not searching through the log for a match. Skiping to returning object data.');

				matchFound = true;

			// If the Index argument was omitted, search the port's console log for a match.
			} else if (SearchFrom >= 0) {

				console.log('Searching forwards through the log for a match (ie. old to recent).');

				// Debugging purposes only.
				// if (SearchFrom == IndexMap.length) {
				// 	console.log(`SearchFrom is equal to IndexMap.length.\n  SearchFrom: ${SearchFrom}\n  IndexMap.length: ${IndexMap.length}`);
				// 	console.groupEnd();
				// 	return { matchFound };
				//
				// } else if (SearchFrom > IndexMap.length) {
				// 	for (let i = 0; i < 10; i++) {
				// 		console.groupEnd();
				// 	}
				// 	throw `What the fack?? SearchFrom is greater than IndexMap.length.\n  SearchFrom: ${SearchFrom}\n  IndexMap.length: ${IndexMap.length}`;
				// }

				let init = 0;

				for (let i = 0; i < IndexMap.Length; i++) {

					if (IndexMap[i] >= SearchFrom) {
						init = i;
						break;

					}

				}

				// Search forwards through the console log for a match (ie. old -> new).
				for (let i = init; i < IndexMap.length; i++) {

					const logIndex = IndexMap[i];
					const LogItem = logData[logIndex];

					console.log(`i: ${i}\nlogIndex: ${logIndex}\nIndexMap Length: ${IndexMap.length}\nLogItem: %O`, LogItem);

					// if (Msg !== undefined && logItem.Msg !== Msg) continue;
					// if (PartMsg && !refMsg.test(this.makeRegExpSafe(logItem.Msg))) continue;
					// if (Length !== undefined && logItem.Msg.length !== Length) continue;
					// if (Id !== undefined && logItem.Id !== Id) continue;
					// if (Line !== undefined && logItem.Line !== Line) continue;
					// if (Type !== undefined && logItem.Type !== Type) continue;
					// if (MinAge !== undefined && logItem.Time - Date.now() < MinAge) continue;
					// if (MaxAge && logItem.Time - Date.now() > MaxAge) {
					//
					// 	if (MaxAge == this.staleCmdLimit && this.verifyPrecidence.indexOf(logItem.Status) < this.verifyPrecidence.indexOf('Completed')) {
					//
					// 		this.updateCmd(port, { Index: logIndex, Status: 'Warning', Comment: 'Stale', UpdateRelated: true });
					//
					// 	}
					//
					// 	console.log('Found stale command.');
					//
					// 	continue;
					// }
					//
					// if (Meta !== undefined) {
					// 	let matchCount = 0;
					//
					// 	for (let x = 0; x < Meta.length; x++) {
					// 		if (logItem.Meta.includes(Meta[x])) matchCount++;
					// 	}
					//
					// 	if (matchCount == Meta.length) continue;
					//
					// }

					// Check to see if found a match.
					if (this.checkMatchItem({ Msg, PartMsg: refMsg, Length, Id, Line, Type, Meta, MinAge, MaxAge, LogItem })) {
						console.log('  ...got a match.');
						matchFound = true;
						matchIndex = logIndex;

						break;
					}

				}

			// Search backwards through the log for a match (ie. recent to old).
			} else if (SearchFrom < 0) {

				console.log('Searching backwards through the log for a match (ie. recent to old).');

				// Debugging purposes only.
				// if (SearchFrom * -1 == IndexMap.length) {
				// 	console.log(`SearchFrom is equal to IndexMap.length.\n  SearchFrom: ${SearchFrom}\n  IndexMap.length: ${IndexMap.length}`);
				// 	console.groupEnd();
				// 	return { matchFound };
				//
				// } else if (SearchFrom * -1 > IndexMap.length) {
				// 	for (let i = 0; i < 10; i++) {
				// 		console.groupEnd();
				// 	}
				// 	throw `What the fack?? SearchFrom is greater than IndexMap.length.\n  SearchFrom: ${SearchFrom}\n  IndexMap.length: ${IndexMap.length}`;
				// }

				let init = IndexMap.length - 1;
				let refIndex = logData.length + SearchFrom;

				for (let i = IndexMap.length - 1; i >= 0; i--) {

					if (IndexMap[i] <= refIndex) {
						init = i;
						break;

					}

				}

				// Search backwards through the console log for a match (ie. new -> old).
				for (let i = init; i >= 0; i--) {

					const logIndex = IndexMap[i];
					const LogItem = logData[logIndex];

					console.log(`i: ${i}\nlogIndex: ${logIndex}\nIndexMap Length: ${IndexMap.length}\nLogItem: %O`, LogItem);

					// if (Msg !== undefined && logItem.Msg !== Msg) continue;
					// if (PartMsg && !refMsg.test(this.makeRegExpSafe(logItem.Msg))) continue;
					// if (Length !== undefined && logItem.Msg.length !== Length) continue;
					// if (Id !== undefined && logItem.Id !== Id) continue;
					// if (Line !== undefined && logItem.Line !== Line) continue;
					// if (Type !== undefined && logItem.Type !== Type) continue;
					// if (MinAge !== undefined && logItem.Time - Date.now() < MinAge) continue;
					// if (MaxAge && logItem.Time - Date.now() > MaxAge) {
					//
					// 	if (MaxAge == this.staleCmdLimit && this.verifyPrecidence.indexOf(logItem.Status) < this.verifyPrecidence.indexOf('Completed')) {
					//
					// 		this.updateCmd(port, { Index: logIndex, Status: 'Warning', Comment: 'Stale', UpdateRelated: true });
					//
					// 	}
					//
					// 	console.log('Found stale command');
					//
					// 	continue;
					// }
					//
					// if (Meta !== undefined) {
					// 	let matchCount = 0;
					//
					// 	for (let x = 0; x < Meta.length; x++) {
					// 		if (logItem.Meta.includes(Meta[x])) matchCount++;
					//
					// 	}
					//
					// 	if (matchCount == Meta.length) continue;
					//
					// }

					// Check to see if found a match.
					if (this.checkMatchItem({ Msg, PartMsg: refMsg, Length, Id, Line, Type, Meta, MinAge, MaxAge, LogItem })) {
						console.log('  ...got a match.');
						matchFound = true;
						matchIndex = logIndex;

						break;
					}
				}

			}

			// If a match was found in this port's console log, return the object data.
			if (matchFound) {
				const matchItem = this[port].logData[matchIndex];
				console.log('Found match in log:', matchItem);

				console.groupEnd();

				return {
					matchFound,
					matchIndex,
					matchMsg: matchItem.Msg,
					matchId: matchItem.Id,
					matchLine: matchItem.Line,
					matchType: matchItem.Type,
					matchStatus: matchItem.Status,
					matchComment: matchItem.Comment,
					matchRelated: matchItem.Related,
					matchMeta: matchItem.Meta,
					matchTime: matchItem.Time,
					matchIndexMap: IndexMap
				};
			}

			console.log(`No match found in '${port}' log for ${ Msg !== undefined ? 'Msg' : (PartMsg !== undefined ? 'PartMsg' : (Length !== undefined ? 'Length' : (Id !== undefined ? 'Id' : (Line !== undefined ? 'Line' : 'Type'))))}: ${data}`);
			console.groupEnd();

			return { matchFound };
		},
		updateCmd(port, { Msg, PartMsg, Length, Id, Line, Type, Meta, MinAge, MaxAge, Index, IndexMap, SearchFrom, Status, Comment, PrevComment = 'left', UpdateRelated }) {
			// This method updates the status of commands in the SPJS console log.
			// Matches to command data can be partial and are not cose sensitive but matches to command id's have to be exact.
			// Arg. port - Specifies the console log (eg. "SPJS" or "COM7").
			// Arg. status - Specifies the new status to apply to a matched command (eg. "Written" or "Executed").
			// Arg. SearchFrom [int] - Specify the index of IndexMap from which to start searching for a match. If Status is 'Warning' or 'Error', default is -1. Otherwise default is 0.
			// Arg. PrevComment [string] - Specify that the previous comment should be to the left or right of the new comment or it should be cleared (eg. 'left' or 'right' or 'clear').
			//   Default: 'left'.
			// Arg. UpdateRelated [boolean] - Specify wether the related message(s) in another log should also be updated.
			//   Default: If port is SPJS - true. Otherwise - false.

			if (this[port] === undefined) {
				throw `The consoleLog.${port} object is undefined.`;
			}

			if (!Status && Comment === undefined) {
				// console.warn('No Update Requested. Aborting update');
				throw 'No Update Requested. Aborting update'
				// console.groupEnd();
				return { matchFound: false };
			}

			console.groupCollapsed(`${port}${ Comment ? ` - Comment: '${Comment}'` : '' }${ Status ? ` - Status: ${Status}` : '' } - ${ Msg !== undefined ? `Msg: ${Msg}` : (PartMsg !== undefined ? `PartMsg: ${PartMsg}` : (Length !== undefined ? `Length: ${Length}` : (Id !== undefined ? `Id: ${Id}` : (Line !== undefined ? `Line: ${Line}` : (Index !== undefined ? `Index: ${Index}` : `Type: ${Type}`))))) }`);
			// console.groupCollapsed(`Update ${ Status ? 'status' : 'comment' }: ${ Msg || PartMsg || Id || Line || Type }`);
			console.log(CSON.stringify(arguments));

			const cmdMap = this[port].cmdMap;
			const verifyMap = this[port].verifyMap;
			const logData = this[port].logData;

			// Use verifyMap if doing a status update other than warning or error.
			if (IndexMap === undefined && Status && Status !== 'Warning' && Status !== 'Error') {
				IndexMap = verifyMap;

			} else if (IndexMap === undefined) {
				IndexMap = cmdMap;
			}

			if (SearchFrom === undefined && (Status === 'Warning' || Status === 'Error')) {
				SearchFrom = 1 - cmdMap.length;

			} else if (SearchFrom === undefined) {
				SearchFrom = 0;
			}

			if (UpdateRelated === undefined && port === 'SPJS') {
				UpdateRelated = true;

			} else if (UpdateRelated === undefined) {
				UpdateRelated = false;
			}

			// Check if command is in this port's verify buffer.
			// const matchItem = this.findItem(port, { Msg, PartMsg, Id, Index, IndexMap: this[port].verifyMap });
			let { matchFound, matchIndex, matchMsg, matchId, matchLine, matchType, matchStatus, matchMeta, matchComment, matchRelated, matchTime, matchIndexMap } = this.findItem(port, { Msg, PartMsg, Length, Id, Line, Type, Meta, MinAge, MaxAge, Index, IndexMap, SearchFrom });

			console.log('matchFound:', matchFound, '\nmatchIndex:', matchIndex,'\nmatchMsg:', matchMsg,'\nmatchId:', matchId,'\nmatchLine:', matchLine,'\nmatchType:', matchType,'\nmatchStatus:', matchStatus,'\nmatchComment:', matchComment,'\nmatchRelated:', matchRelated,'\nmatchMeta:', matchMeta,'\nmatchTime:', matchTime);

			if (matchIndex === undefined) {
				console.log('No Match Found. Aborting update.');
				console.groupEnd();
				return { matchFound };
			}

			if (Status && this.verifyPrecidence.indexOf(matchStatus) < this.verifyPrecidence.indexOf(Status)) {
				// let removeItem = (Status === 'Error' || Status === 'Warning' || Status === 'Executed' || (Status === 'Completed' && !matchMeta.includes('NumberedGCode'))) ? true : false;
				let removeItem = (Status === 'Error' || Status === 'Warning' || Status === 'Executed' || Status === 'Completed') ? true : false;
				const bufferLength = this[port].verifyMap.length;

				console.log('Status Update.');
				console.log(`Remove item: ${removeItem}`);
				// console.log('Match item:', matchItem);
				console.log('cmdMap:', this[port].cmdMap, '\nverifyMap:', this[port].verifyMap);

				// Update the style of the respective command's check-mark DOM element (ie. remove previous style and add new style).
				$(`#connection-widget .console-log-panel .log-${port} span.verify-mark.${matchId}`).removeClass(this.verifyStyle[matchStatus]).addClass(this.verifyStyle[Status]);
				// console.log(`#connection-widget .console-log-panel .log-${port} span.verify-mark.${matchId}`);

				logData[matchIndex].Status = Status;

				console.log('Updated status.');
				console.log(`  Prev status: ${matchStatus}\n  New status: ${logData[matchIndex].Status}`);

				// If removeItem is true, remove the matched command from the verifyBuffer object.
				if (removeItem && this[port].verifyMap.includes(matchIndex)) {

					if (this.commentTimeToVerify && (!matchMeta.includes('portSendJson') || ( matchMeta.includes('portSendJson') && (port === 'SPJS' || matchMeta.includes('1of1'))))) {
						const deltaTime = Date.now() - matchTime;

						console.log("Time to " + Status + ": " + deltaTime + "ms");

						this.updateCmd(port, { Index: matchIndex, Comment: `${deltaTime}ms`, PrevComment: 'right', UpdateRelated: false });

					}

					// Remove the item from the verifyBuffer object.
					this[port].verifyMap.splice(this[port].verifyMap.indexOf(matchIndex), 1);

					console.log('  cmdMap:', this[port].cmdMap, '\n  verifyMap:', this[port].verifyMap);

					// Double check that the item has been removed from the verifyBuffer object.
					if (bufferLength && this[port].verifyMap.length + 1 == bufferLength) {
						console.log('Item was removed from the verifyMap.');

					} else {
						throw 'Item was not successfully removed from the verifyMap.'

					}

				} else if (removeItem) {
					console.log('Item was already removed from the verifyMap.');

				}

			// If this a redundant status update, look for another match in the log incase this is the wrong command in the log.
			} else if (Status && this.verifyPrecidence.indexOf(matchStatus) >= this.verifyPrecidence.indexOf(Status)) {

				if ((Status === 'Warning' || Status === 'Error') && matchIndex > 0) {
					console.groupEnd();

					console.log(`Redundant Status Update. Trying to find an older match in the log. SearchFrom: ${1 - matchIndex}`);

					// return this.updateCmd(port, { Msg, PartMsg, Length, Id, Line, Type, Index, IndexMap, SearchFrom: 1 - matchIndexMap.indexOf(matchIndex), Status, Comment, PrevComment, UpdateRelated });
					return this.updateCmd(port, { Msg, PartMsg, Length, Id, Line, Type, Index, IndexMap, SearchFrom: 1 - matchIndex, Status, Comment, PrevComment, UpdateRelated });

				} else if (Status !== 'Warning' && Status !== 'Error' && SearchFrom < logData.length - 1) {
					console.groupEnd();

					console.log(`Redundant Status Update. Trying to find a newer match in the log. SearchFrom: ${matchIndex + 1}`);

					// return this.updateCmd(port, { Msg, PartMsg, Length, Id, Line, Type, Index, IndexMap, SearchFrom: matchIndexMap.indexOf(matchIndex) + 1, Status, Comment, PrevComment, UpdateRelated });
					return this.updateCmd(port, { Msg, PartMsg, Length, Id, Line, Type, Index, IndexMap, SearchFrom: matchIndex + 1, Status, Comment, PrevComment, UpdateRelated });

				} else {
					console.log('Redundant Status Update.');

				}

			}

			if (Comment !== undefined && !matchComment.includes(`[${Comment}]`)) {
				console.log('Comment update.');

				// Get the new value of the comment in case the comment was updated by the status update (ie. time to execute/error was added).
				matchComment = logData[matchIndex].Comment;

				let newComment = '';

				// Add the new comment to the right of any previous comments.
				if (PrevComment === 'left') {
					newComment = matchComment ? `${matchComment} [${Comment}]` : (Comment ? `[${Comment}]` : '');

				// Add the new comment to the left of any previous comments.
				} else if (PrevComment === 'right') {
					newComment = matchComment ? `[${Comment}] ${matchComment}` : (Comment ? `[${Comment}]` : '');

				// Replace any previous comments with the new comment.
				} else if (PrevComment === 'clear') {
					newComment = Comment ? `[${Comment}]` : '';

				}

				// Update the style of the respective command's comment DOM element (ie. remove previous style and add new style).
				$(`#connection-widget .console-log-panel .log-${port} ${this.style.CmdComment.includes('samp') ? 'samp' : 'code'}.cmd-comment.${matchId}`).text(`${newComment}`);
				// console.log(`#connection-widget.console-log-panel .log-${port} ${this.style.CmdComment.includes('samp') ? 'samp' : 'code'}.cmd-comment.${matchId}`);

				logData[matchIndex].Comment = newComment;

				console.log(`New Comment: ${newComment}`);

			} else if (Comment && matchComment.includes(`[${Comment}]`)) {
				console.log('Redundant Comment Update.');
			}

			// Debugging purposes only.
			// Check that matchRelated has a port.
			if (matchRelated && !matchRelated.Port) {
				throw 'matchRelated does not have a port.'
			}

			// If the command has a related command in a port's log, verify that command using the id from the command in the SPJS log.
			if (UpdateRelated && matchRelated && matchRelated.Port && this[matchRelated.Port]) {

				console.log(`Found related port:\n${CSON.stringify(matchRelated)}`);

				// If there is a match Id, use that.
				if (matchRelated.Id) {

					// Debugging Purposes Only.
					if (!Array.isArray(matchRelated.Id)) {
						throw 'matchRelated.Id is not an array.'
					}

					// Update each message in the list of id's.
					for (let i = 0; i < matchRelated.Id.length; i++) {
						this.updateCmd(matchRelated.Port, { Id: matchRelated.Id[i], Status, Comment, PrevComment, UpdateRelated: false });

					}

				} else {
					this.updateCmd(matchRelated.Port, { Id: matchId, Status, Comment, PrevComment, UpdateRelated: false });

				}

			} else if (UpdateRelated && port !== 'SPJS') {
				console.log('Finding related message in the SPJS log.');
				this.updateCmd('SPJS', { Id: matchId, Status, Comment, PrevComment, UpdateRelated: false });

			}

			const matchItem = logData[matchIndex];
			console.groupEnd();

			return {
				matchFound,
				matchIndex,
				matchMsg: matchItem.Msg,
				matchId: matchItem.Id,
				matchLine: matchItem.Line,
				matchType: matchItem.Type,
				matchStatus: matchItem.Status,
				matchMeta: matchItem.Meta,
				matchComment: matchItem.Comment,
				matchRelated: matchItem.Related,
				matchTime: matchItem.Time,
				matchIndexMap
			};

		}
	},

	initBody: function () {
		console.group(this.name + ".initBody()");

		// Only connect to SPJS once all widgets have loaded so that we dont publish any important signals before other widgets have a chance to subscribe to them.
		subscribe('/main/all-widgets-loaded', this, this.wsConnect.bind(this));
		// When the window resizes, look at updating the size of DOM elements.
		subscribe('/main/window-resize', this, this.resizeWidgetDom.bind(this));
		// If this widget is made visible, update the size of DOM elements.
		subscribe('/main/widget-visible', this, this.visibleWidget.bind(this));

		// Send a given message to the SPJS and add it to the console log so that it can be displayed as incomplete/complete.
		subscribe('/' + this.id + '/spjs-send', this, this.spjsSend.bind(this));
		// Send message directly to SPJS as 'send [port] [cmd]' and add it to the respective port's log.
		subscribe('/' + this.id + '/port-send', this, this.portSend.bind(this));
		// Send message directly to SPJS as 'sendnobuf [port] [cmd]' and add it to the respective port's log.
		subscribe('/' + this.id + '/port-sendnobuf', this, this.portSendNoBuf.bind(this));
		// Send message directly to SPJS as 'sendjson { P: [port], Data: [{ D: [cmd], Id: [id] }] }' and add it to the respective port's log.
		subscribe('/' + this.id + '/port-sendjson', this, this.portSendJson.bind(this));

		this.initSettings();
		// Import the status codes from the 'TinyG_Status_Codes.json' file as an object.
		this.initStatusCodes();
		this.initClickEvents();
		this.initConsoleInput();

		publish('/main/widget-loaded', this.id);
	},
	// FIXME: Get the settings from a cson file.
	initSettings: function () {

		let that = this;
		console.log('Loading Settings from cson file.');

		console.log('initScripts:', JSON.stringify(this.initScripts));

		CSON.parseCSONFile('config/connection-widget_Settings.cson', function (err, result) {
			console.log('Error:', err, '\nResult:', result);

			if (err) return false;

			console.log('Result:', CSON.stringify(result));

			const { SPJS, consoleLog, deviceMeta, defaultMetaIndex, initScripts } = result;

		    // Object.keys(result).forEach(function(key) {
			// 	that[key] = result[key];
			// });

			// Merge the objects in the cson file with the ones here.
			// Object.assign(that.SPJS, SPJS);
			// Object.assign(that.consoleLog, consoleLog);
			// Object.assign(that.deviceMeta, deviceMeta);
			// Object.assign(that.defaultMetaIndex, defaultMetaIndex);
			// Object.assign(that.initScripts, initScripts);
			that.initScripts = initScripts;

		});

		console.log('SPJS:', this.SPJS);
		console.log('consoleLog:', this.consoleLog);
		console.log('deviceMeta:', this.deviceMeta);
		console.log('defaultMetaIndex:', this.defaultMetaIndex);
		console.log('initScripts:', this.initScripts);
	},
	initStatusCodes: function () {
		// Synchronous file read.
		let that = this;
		console.log('Loading Status Codes from cson file.');

		CSON.parseCSONFile('config/TinyG_Status_Codes.cson', function (err, result) {
			// console.log('Error:', err, '\nResult:', result);
			that.tinygStatusMeta = result;

		});

		// console.log('tinygStatusMeta:', this.tinygStatusMeta);

	},
	initClickEvents: function () {
		var that = this;

		// Console log tab events.
		$('#' + this.id + ' .console-log-panel .nav-tabs').on('click', "span", function(evt) {
			// console.log("evt:", evt);
			// console.log("View " + $(this).attr("evt-data") + " log.");
			that.consoleLogChangeView($(this).attr("evt-data"));
		});

		// Serial port list header button events.
		$('#' + this.id + ' .splist-panel .panel-heading .btn-group').on('click', "span.btn", function(evt) {
			// console.log("evt:", evt, "\nthis:", this);
			// console.log("  evt-signal: " + $(evt.currentTarget).attr("evt-signal"));
			// console.log("  evt-data: " + $(evt.currentTarget).attr("evt-data"));
			var evtSignal = $(this).attr('evt-signal');
			var evtData = $(this).attr('evt-data');

			if (evtSignal == "hide-body") {
				console.log('Hide body.', this);

				$('#connection-widget .' + evtData + ' .panel-body').addClass("hidden");
				$(this).find('span').removeClass("glyphicon-chevron-up").addClass("glyphicon-chevron-down");
				$(this).attr("evt-signal", "show-body");

				that.resizeWidgetDom();

			} else if (evtSignal == "show-body") {
				console.log('Show body.', this);

				$('#connection-widget .' + evtData + ' .panel-body').removeClass("hidden");
				$(this).find('span').removeClass("glyphicon-chevron-down").addClass("glyphicon-chevron-up");
				$(this).attr("evt-signal", "hide-body");

				that.resizeWidgetDom();

			} else if (evtSignal) {
				publish(evtSignal, evtData);
			}
		});

		// Click events for each port in the serial port list.
		$('#' + this.id + ' .splist-panel table.serial-port-list').on('click', "tr", function(evt) {

			const port = $(this).attr("evt-data");
			const portMeta = that.SPJS.portMeta;

			let Msg = "";

			const unsafePort = that.makePortUnSafe(port);

			if (that.consoleLog.openLogs.includes(port)) {
				console.log("Port " + unsafePort + " selected.\n  ...closing port.");

				// Prevent the port from autoconnecting again.
				that.deviceMeta[portMeta[port].metaIndex].autoConnectPort = false;

				Msg = `close ${unsafePort}`;

			} else {
				console.log("Port " + unsafePort + " selected.\n  ...opening port.");

				// Allow the port to autoconnecting again if it was dissabled by a manual port close.
				// that.deviceMeta[portMeta[port].metaIndex].autoConnectPort = false;

				Msg = `open ${unsafePort} ${portMeta[port].Baud} ${portMeta[port].Buffer}`;

			}

			that.newspjsSend({ Msg });

		});
	},
	initConsoleInput: function () {
		// SPJS and serial port inputs.
		// TODO: Recall past commands by pressing the arrow keys.
		var that = this;
		var consoleInputDom = '#' + this.id + ' .console-log-panel .console-input input';

		// backspace		8
		// tab				9
		// enter			13
		// shift			16
		// ctrl				17
		// alt				18
		// pause/break		19
		// caps lock		20
		// escape			27
		// page up			33
		// page down		34
		// end				35
		// home				36
		// left arrow		37
		// up arrow			38
		// right arrow		39
		// down arrow		40
		// insert			45
		// delete			46
		// [0-9]:			48-57
		// [a-z]:			65-90
		// window key [left,right]: 91,92
		// select key:		93
		// numpad [0-9]:	96-105
		// numpad period	110
		// f [1-12]:		112-123
		// num lock:		144
		// scroll lock:		145
		// semicolon:		186
		// equal sign:		187
		// comma:			188
		// dash:			189
		// period:			190
		// forward slash:	191
		// grave accent:	192
		// open bracket:	219
		// back slash:		220
		// close braket:	221
		// single quote:	222

		$(consoleInputDom).on('keydown', function(evt) {
			// console.log("keyCode: " + evt.keyCode);
			// console.log("key: " + evt.key);
			// TODO: Set cursor to end of text in the input field after recalling a previous command from the history list.
			var activeLog = that.consoleLog.activeLog;
			var activeConsoleLog = that.consoleLog[activeLog];
			var historyRecallIndex = activeConsoleLog.historyRecallIndex;

			var key = Number(evt.keyCode);
			var inputData = $(consoleInputDom).val();

			// If the 'backspace' key was pressed.
			if (evt.keyCode == "8") {
				// console.log("evt:", evt);
				activeConsoleLog.value = inputData;

			// If the 'enter' key was pressed.
			} else if (evt.keyCode == 13) {
				// console.log("evt:", evt);
				// TODO: Write a more elegant solution.
				that.consoleLogParseInput();
				activeConsoleLog.value = "";
				historyRecallIndex = null;

			// If the 'up-arrow' was pressed.
			} else if (evt.keyCode == "38") {
				var history = activeConsoleLog.history;

				if (historyRecallIndex === null && history.length) {
					activeConsoleLog.historyRecallIndex = 0;
					$(consoleInputDom).val(activeConsoleLog.history[activeConsoleLog.historyRecallIndex]);

				} else if (historyRecallIndex < history.length - 1) {
					activeConsoleLog.historyRecallIndex++;
					$(consoleInputDom).val(activeConsoleLog.history[activeConsoleLog.historyRecallIndex]);
				}
				// activeConsoleLog.historyRecallIndex = (historyRecallIndex === null) ? 0:++historyRecallIndex;
				// console.log("historyRecallIndex: " + activeConsoleLog.historyRecallIndex);

			// If the 'down-arrow' was pressed.
			} else if (evt.keyCode == "40") {
				if (historyRecallIndex === null) {
					// $(consoleInputDom).val(this.consoleLog[activeLog].value);
				} else if (historyRecallIndex === 0) {
					activeConsoleLog.historyRecallIndex = null;
					$(consoleInputDom).val(activeConsoleLog.value);
				} else {
					activeConsoleLog.historyRecallIndex--;
					$(consoleInputDom).val(activeConsoleLog.history[activeConsoleLog.historyRecallIndex]);
				}
				// console.log("historyRecallIndex: " + activeConsoleLog.historyRecallIndex);

			// If a character key was pressed.
			} else if (evt.key.length == 1) {
				// TODO: Fix issue with inserting text into middle of string in input field.
				inputData += evt.key;
			}

			if (evt.keyCode != "13" && evt.keyCode != "38" && evt.keyCode != "40") {
				activeConsoleLog.value = inputData;
				activeConsoleLog.historyRecallIndex = null;
				// console.log(activeLog + ":" + gui.parseObject(that.consoleLog, 2));
				// console.log(activeLog + " Log:" + gui.parseObject(activeConsoleLog, 2));
			}

		});

	},
	// FIXME: If the console log was scrolled to the bottom when widget resized, scroll to bottom of log after resize.
	resizeWidgetDom: function () {
		// console.group("Resize " + this.id + " window");
		// If widget is not visible, do not update the size of DOM elements.
		if (!this.widgetVisible) return false;

		var that = this;

		// TODO: Do the resize stuff like this: $(selector).attr(attribute,function(index,currentvalue))
		// index - Receives the index position of the element in the set.
		// currentvalue - Receives the current attribute value of the selected elements.
		// Put the .attr() function inside of a $.each() loop.

		$.each(this.widgetDom, function(setIndex, setItem) {
			// console.log("setIndex:", setIndex, "\nsetItem:", setItem);
			var that1 = that;
			var containerElement = null;
			var containerHeight = null;
			var marginSpacing = 0;
			var panelSpacing = 0;

			$.each(setItem, function(panelIndex, panelItem) {
				// console.log("  panelIndex:", panelIndex, "\n  panelItem:", panelItem);
				// If panelItem is the container element, skip it.
				if (!panelIndex) {
					containerElement = '#' + that1.id + panelItem;
					containerHeight = $(containerElement).height();
					// console.log("    Container: " + containerElement + "\n    Height: " + containerHeight);
					return true;
				}
				var elementItem = containerElement + panelItem;
				marginSpacing += Number($(elementItem).css("margin-top").replace(/px/g, ""));

				if (panelIndex == setItem.length - 1) { // Last element in array, set it's height.
					marginSpacing += Number($(elementItem).css("margin-bottom").replace(/px/g, ""));
					var panelHeight = containerHeight - (marginSpacing + panelSpacing);
					$(elementItem).css({"height": (panelHeight) + "px"});
					// console.log("    panelHeight: " + panelHeight);
				} else { // Not last element in array, read it's height.
					// console.log("    panelHeight: " + $(elementItem).css("height").replace(/px/g, ""));
					panelSpacing += Number($(elementItem).css("height").replace(/px/g, ""));
				}
			});
		});
		// console.groupEnd();
	},
	visibleWidget: function (wgtVisible, wgtHidden) {
		// console.log("visibleWidget()\n  wgtVisible: " + wgtVisible + "\n  wgtHidden: " + wgtHidden + "\n this.id: " + this.id);
		if (wgtVisible == this.id) {
			console.log(this.id + " is now visible.");
			this.widgetVisible = true;
			this.resizeWidgetDom();
		} else if (wgtHidden == this.id) {
			console.log(this.id + " is now hidden.");
			this.widgetVisible = false;
		}
	},

	wsConnect: function () {
		// This method creates a new WebSocket connection to the SPJS and is called by the '/main/all-widgets-loaded' subscribe line.
		// NOTE: Try connecting to a SPJS before creating one incase the ui was restarted.

		// console.log("Attempting to connect to the SPJS now.");
		// console.log("Web Socket (before calling 'new WebSocket()'):" + gui.parseObject(this.SPJS.ws, 2, { keep: ["CONNECTING", "OPEN", "CLOSING", "CLOSED", "url", "readyState", "bufferedAmount"] }));
		const socketUrl = 'ws://localhost:8989/ws';
		// const socketUrl = 'ws://192.168.1.68:8888/ws';
		// const socketUrl = 'ws://192.168.1.68:8888/ws';

		this.SPJS.ws = new WebSocket(socketUrl);

		let that = this;
		this.SPJS.ws.onopen = function () {
			that.onSpjsOpen();
		};
		this.SPJS.ws.onmessage = function (evt) {
			that.onSpjsMessage(evt.data);
		};
		this.SPJS.ws.onerror = function (error) {
			that.onSpjsError(error);
		};
		this.SPJS.ws.onclose = function () {
			that.onSpjsClose();
		};

	},
	launchSpjs: function () {
		console.log('Launching a new SPJS.');

		// If on a Raspberry Pi.
		if (hostMeta.platform === 'linux' && hostMeta.architecture === 'arm') {

			// Launch the SPJS in max garbage collection mode.
			this.SPJS.go = spawn(`lxterminal --command "sudo serial-port-json-server-1.92_linux_arm/serial-port-json-server -gc max -allowexec"`, [], { shell: true });

			if (this.SPJS.launchGpioServerOnLinux) {

				// Launch the GPIO JSON server.
				this.SPJS.gpio = spawn(`lxterminal --command "sudo serial-port-json-server-1.92_linux_arm/gpio-json-server"`, [], { shell: true });

				this.SPJS.gpio.stdout.on('data', (data) => {
					console.log(`GPIO Server. stdout: ${data}`);

					let msg = `${data}`;
					let msgBuffer = msg.split('\n');

					for (let i = 0; i < msgBuffer.length; i++) {
						msgBuffer[i] && this.consoleLog.appendMsg('SPJS', { Msg: msgBuffer[i], Type: 'stdout' });

					}

				});

				this.SPJS.gpio.stderr.on('data', (data) => {
					console.log(`GPIO Server. stderr: ${data}`);

					let msg = `${data}`;
					let msgBuffer = msg.split('\n');

					for (let i = 0; i < msgBuffer.length; i++) {
						msgBuffer[i] && this.consoleLog.appendMsg('SPJS', { Msg: msgBuffer[i], Type: 'stderr' });

					}

				});

				this.SPJS.gpio.on('close', (code) => {
					console.log(`GPIO Server. Child precess exited with the code: ${code}`);

				});

			}

		// If the host is on a windows platform.
		} else if (hostMeta.os === 'Windows') {
			// Launch the SPJS in max garbage collection mode.
			this.SPJS.go = spawn(`cd json_server && serial-port-json-server.exe`, ['-gc max', '-allowexec'], { shell: true });

		}
		// this.SPJS.go = spawn(`cd json_server && serial-port-json-server.exe`, ['-gc max'], { shell: true });
		// Launch the SPJS in verbose mode with max garbage collection.
		// this.SPJS.go = spawn(`cd json_server && serial-port-json-server.exe`, ['-gc max', '-v'], { shell: true });

		this.SPJS.go.stdout.on('data', (data) => {
			console.log(`SPJS. stdout: ${data}`);

			let msg = `${data}`;
			let msgBuffer = msg.split('\n');

			for (let i = 0; i < msgBuffer.length; i++) {
				msgBuffer[i] && this.consoleLog.appendMsg('SPJS', { Msg: msgBuffer[i], Type: 'stdout' });

			}

		});

		this.SPJS.go.stderr.on('data', (data) => {
			console.log(`SPJS. stderr: ${data}`);

			let msg = `${data}`;
			let msgBuffer = msg.split('\n');

			for (let i = 0; i < msgBuffer.length; i++) {
				msgBuffer[i] && this.consoleLog.appendMsg('SPJS', { Msg: msgBuffer[i], Type: 'stderr' });

			}

		});

		this.SPJS.go.on('close', (code) => {
			console.log(`SPJS. Child precess exited with the code: ${code}`);

		});

	},
	onSpjsOpen: function () {
		// If the SPJS is already in an 'open' state, skip DOM updates.
		if (this.SPJS.wsState == "open") return false;

		// console.log("WebSocket -onOpen-" + gui.parseObject(this.SPJS.ws, 2, { keep: ["url"] }));
		console.groupCollapsed("WebSocket -onOpen-" + gui.parseObject(this.SPJS.ws, 2, { keep: ["url"] }));
		console.log("ws:" + gui.parseObject(this.SPJS.ws, 2, { keep: ["CONNECTING", "OPEN", "CLOSING", "CLOSED", "url", "readyState", "bufferedAmount"] }));

		this.SPJS.wsState = "open";

		$('#' + this.id + ' .spjs-connection-warning').addClass("hidden");
		$('#' + this.id + ' .serialport-connection-warning').removeClass("hidden");

		publish('/statusbar-widget/hilite', "SPJS", "success");

		console.log("openPorts: " + gui.parseObject(this.SPJS.openPorts));
		console.log("openLogs: " + gui.parseObject(this.consoleLog.openLogs));

		this.resizeWidgetDom();

		console.groupEnd();
	},
	onSpjsMessage: function (msg) {
		// This method receives all messages from the SPJS and sends each message to it's respective method.

		if (msg.match(/^\{/)) {
			var data = null;

			try {
				// data = $.parseJSON(msg);
                data = JSON.parse(msg);
				// console.log('SPJS Recv (json):\n ', data);
				// console.info('SPJS Recv (json):\n ', data);
				console.info(data);

			} catch(error) {
				console.log('SPJS Recv (json error):\n  ' + msg);

				this.consoleLog.appendMsg('SPJS', { Msg: msg, Type: 'Error' });
				this.onParseError(msg);
				return false;
			}
			// TODO: Re-order these condition statements so that they go most common -> least common to increase efficiency.

			if (data.Version) {
				this.onVersion(data);

			} else if (data.Commands) {
				this.onCommands(data);

			} else if (data.BufferAlgorithm) {
				this.onBufferAlgorithm(data);

			} else if (data.BaudRate) {
				this.onBaudRate(data);

			} else if (data.Hostname) {
				this.onHostname(data);

			} else if (data.SerialPorts) {
				// this.onSystemAlarm({ er: { fb: 78.02, st: 5, msg: "System alarmed", val: 1 } });
				this.onSerialPorts(data);

			} else if (data.Cmd && data.Cmd === 'Open') {
				// Port connection was opened.
				this.onPortOpen(data);

			} else if (data.Cmd && data.Cmd === 'OpenFail') {
				this.onPortOpenFail(data);

			} else if (data.Cmd && data.Cmd === 'Close') {
				this.onPortClose(data);

			} else if (data.Cmd && data.Cmd === 'Broadcast') {
				this.onBroadcast(data);

			} else if (data.Cmd && data.Cmd === 'WipedQueue') {
				this.onWipedQueue(data);

			} else if (data.Cmd && data.Cmd === 'Queued') {
				// Need to watch for queues being done so we know to send next
				// is it a json queued response or text mode queued response

				// If 'Data' is in the data object, a JSON message got queued.
				if ('Data' in data) {
					this.onQueuedJson(data);

				} else {
					this.onQueuedText(data);
				}

				// Update prog bar of buffer as this would decrement prog bar cuz a dequeue happened.
				this.onQueueCnt(data);

			} else if (data.Cmd && data.Cmd === 'Write') {
				this.onWriteJson(data);

				// Update prog bar of buffer as this would decrement prog bar cuz a dequeue happened.
				this.onQueueCnt(data);

			} else if (data.Cmd && (data.Cmd === 'Complete' || data.Cmd === 'CompleteFake')) {
				this.onCompleteJson(data);

			} else if (data.Cmd && data.Cmd === 'Error') {
				this.onErrorJson(data);

			} else if (data.Error) {
				this.onErrorText(data);

			} else if (data.er) {
				this.onSystemAlarm(data);

			} else if (data.Cmd && data.Cmd === 'FeedRateOverride') {
				this.onFeedRateOverride(data);

			} else if (data.P && data.D) {
				this.onRawPortData(data);

			} else if (data.gc) {
				this.onGarbageCollection(data);

			} else if (data.Alloc && data.TotalAlloc) {
				this.onGarbageHeap(data);

			} else if (data.ExecRuntimeStatus) {
				this.onExecRuntimeStatus(data);

			} else if (data.ExecStatus) {
				this.onExecStatus(data);

			} else {
				console.error('Did nothing with JSON.\n  msg: ' + msg + '\n  data:' + gui.parseObject(data, 4));

				this.consoleLog.appendMsg('SPJS', { Msg: data, Type: 'Error' });
			}

        } else if (msg.match(/We could not find the serial port/)) {
			console.error('SPJS Recv (error):\n  ' + msg);
			console.error('SPJS -Port Not Found-');

			this.consoleLog.appendMsg('SPJS', { Msg: msg, Type: 'Error' });

		// If this msg is an echo of a spjs (aka. non port specific) message, mark the message in the spjs log as received.
		} else {
			// const matchId = this.logCmdStatus('SPJS', {Cmd: msg}, 'Sent');
			const matchItem = this.consoleLog.updateCmd('SPJS', { Msg: msg, Status: 'Sent' });
			const { matchId, matchRelated } = matchItem;
			// console.log(`Match Item:`, matchItem);

			// If this message has a match in the console log, it is a SPJS command echo.
			const Type = matchId ? 'CommandEcho' : 'default';
			this.consoleLog.appendMsg('SPJS', { Msg: msg, Type});
		}
	},
	onSpjsError: function (error) {
		// If the SPJS is already in an 'error' or 'closed' state, skip DOM updates.
		if (this.SPJS.wsState == 'error' || this.SPJS.wsState == 'closed') {
			console.groupEnd();
			return false;
		}

		// console.error('WebSocket -onError-' + gui.parseObject(this.SPJS.ws, 2, { keep: ['url', 'bufferedAmount'] }));
		// console.error('WebSocket -onError-');
		console.groupCollapsed('WebSocket -onError-');

		// Only update the state of the SPJS if it is not already closed.
		this.SPJS.wsState = 'error';
		// console.log('Web Socket -onSpjsError-' + gui.parseObject(this.SPJS.ws, 2, { keep: ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED', 'url', 'readyState', 'bufferedAmount'] }));

		publish('/statusbar-widget/hilite', 'SPJS', 'danger');
		console.groupEnd();
	},
	onSpjsClose: function () {
		let that = this;
		// console.log('go:', this.SPJS.go);

		// If a reconnect delay has been set, attempt to reconnect to the SPJS after that delay.
		if (this.SPJS.wsReconnectDelay !== null) {
			setTimeout(function() {
				that.wsConnect();
			}, this.SPJS.wsReconnectDelay);
		}

		// If the SPJS is already in a 'closed' state, skip DOM and object updates.
		if (this.SPJS.wsState == "closed") {
			console.groupEnd();
			this.launchSpjs();
			return false;
		}

		// If the SPJS was not shut down because of a command, launch a new SPJS.
		// if (this.logCmdStatus('SPJS', {Cmd: 'exit'}, 'Executed')) {
		// 	console.log('SPJS was shut down because of a \'exit\' command.');
		// 	this.launchSpjs();
		//
		// } else if (this.logCmdStatus('SPJS', {Cmd: 'restart'}, 'Executed')) {
		// 	console.log('SPJS was shut down because of a \'restart\' command.');
		// }

		if (this.consoleLog.updateCmd('SPJS', { Msg: 'exit', Status: 'Executed' }) && this.SPJS.wsReconnectOnExitCmd) {
			console.log('SPJS was shut down because of a \'exit\' command.');
			this.launchSpjs();

		} else if (this.consoleLog.updateCmd('SPJS', { Msg: 'restart', Status: 'Executed' })) {
			console.log('SPJS was shut down because of a \'restart\' command.');
		}

		console.groupCollapsed("WebSocket -onClose-" + gui.parseObject(this.SPJS.ws, 2, { keep: ["url", "bufferedAmount"] }));

		this.SPJS.wsState = "closed";

		console.log("Web Socket -onSpjsClose-" + gui.parseObject(this.SPJS.ws, 2, { keep: ["CONNECTING", "OPEN", "CLOSING", "CLOSED", "url", "readyState", "bufferedAmount"] }));

		console.log("openPorts: " + gui.parseObject(this.SPJS.openPorts));
		console.log("openLogs: " + gui.parseObject(this.consoleLog.openLogs));

		const verifyMap = this.consoleLog.SPJS.verifyMap;

		if (verifyMap.length > 0) {

			// If there are any pending commands in the SPJS, mark them as error (recent to oldest).
			for (let i = verifyMap.length - 1; i > 0; i--) {
				// Only mark commands that are more recent than the errorCmdOnSpjsCloseMaxAge setting.
				// this.consoleLog.updateCmd('SPJS', { Id: this.consoleLog.SPJS.logData[verifyMap[i]].Id, MaxAge: this.consoleLog.errorCmdOnSpjsCloseMaxAge, Status: 'Error', Comment: 'SPJS Closed' });

				let { matchId, matchIndex, matchTime } = this.consoleLog.findItem('SPJS', { Index: verifyMap[i] });

				if (!matchId) continue;

				// If the command is not verified and the spjs is closed, set the message to error.
				if (this.consoleLog.errorCmdOnSpjsCloseMaxAge === null || matchTime - Date.now() < this.consoleLog.errorCmdOnSpjsCloseMaxAge) {
					this.consoleLog.updateCmd('SPJS', { Index: matchIndex, Status: 'Error', Comment: 'SPJS Closed' });

					// If the command is older than the stale command limit, .
				} else if (this.consoleLog.staleCmdLimit !== null && matchTime - Date.now() > this.consoleLog.staleCmdLimit) {
					this.consoleLog.updateCmd('SPJS', { Index: matchIndex, Status: 'Error', Comment: 'Stale' });

				}

			}

		}

		// Clear the verifyBuffer since any commands still not executed will not be able to execute now that the SPJS has disconnected/closed.
		// TODO: remove verifyBuffer stuff.
		this.consoleLog.SPJS.verifyBuffer = [];
		this.consoleLog.SPJS.cmdMap = [];
		this.consoleLog.SPJS.verifyMap = [];

		publish('/statusbar-widget/hilite', "SPJS", "danger");

		this.portDisconnected(this.consoleLog.openLogs);
		publish('/statusbar-widget/remove', this.SPJS.openPorts);

		this.SPJS.openPorts = [];
		this.SPJS.portList = {};
		this.SPJS.portMeta = {};

		// TODO: Do this in the portListDomUpdate() method.
		$('#' + this.id + ' .serialport-connection-warning').addClass("hidden");
		$('#' + this.id + ' .spjs-connection-warning').removeClass("hidden");

		this.portListDomUpdate();

		console.log("openPorts: " + gui.parseObject(this.SPJS.openPorts));
		console.log("openLogs: " + gui.parseObject(this.consoleLog.openLogs));

		console.groupEnd();

		// Return true so that the caller knows that the SPJS was closed.
		return true;
	},

	onVersion: function (data) {
		const { Version } = data;
		// Ex. { "Version": "1.92" }

		console.log(`SPJS -Version-\n  Version: ${Version}`);

		// Add the message to the SPJS log.
		this.consoleLog.appendMsg('SPJS', { Msg: data, Type: 'Version' });
		this.consoleLog.updateCmd('SPJS', { Msg: 'version', Status: 'Executed' });

		this.SPJS.version = parseFloat(Version);

	},
	onCommands: function (data) {
		const { Commands } = data;
		// Ex. { "Commands" : [ "list", "open [portName] [baud]", ... ] }

		console.log('SPJS -Commands-');

		// Add the message to the SPJS log.
		this.consoleLog.appendMsg('SPJS', { Msg: data, Type: 'Commands' });

		this.SPJS.commands = Commands;

	},
	onBufferAlgorithm: function (data) {
		const { BufferAlgorithm } = data;

		console.log(`SPJS -BufferAlgorithm-\n BufferAlgorithm: ${BufferAlgorithm}`);

		// Add the message to the SPJS log.
		this.consoleLog.appendMsg('SPJS', { Msg: data, Type: 'BufferAlgorithm' });
		this.consoleLog.updateCmd('SPJS', { Msg: 'bufferalgorithms', Status: 'Executed' });

	},
	onBaudRate: function (data) {
		const { BaudRate } = data;
		console.log(`SPJS -BaudRate-\n BaudRate: ${BaudRate}`);

		// Add the message to the SPJS log.
		this.consoleLog.appendMsg('SPJS', { Msg: data, Type: 'BaudRate' });
		this.consoleLog.updateCmd('SPJS', { Msg: 'baudrates', Status: 'Executed' });

	},
	onHostname: function (data) {
		const { Hostname } = data;
		// Ex. { "Hostname": "Braydens-Laptop" }

		console.log(`SPJS -Hostname-\n  Hostname: ${Hostname}`);

		// Add the message to the SPJS log.
		this.consoleLog.appendMsg('SPJS', { Msg: data, Type: 'Hostname' });
		this.consoleLog.updateCmd('SPJS', { Msg: 'hostname', Status: 'Executed' });

		this.SPJS.hostname = Hostname;

		this.newspjsSend({ Msg: 'list' });

	},
	onSerialPorts: function (data) {
		// This method parses the port list data received from the SPJS.

		// Add the message to the SPJS log.
		// let Msg = JSON.stringify(data, null, ' ').replace(/\}$/, ' \}').replace('"AvailableBufferAlgorithms": [ "default", "timed", "nodemcu", "tinyg", "tinyg_old", "tinyg_linemode", "tinyg_tidmode", "tinygg2", "grbl", "marlin" ], ', '');
		let Msg = JSON.stringify(data, null, ' ').replace(/\}$/, ' \}').replace('"AvailableBufferAlgorithms": [\n    "default",\n    "timed",\n    "nodemcu",\n    "tinyg",\n    "tinyg_old",\n    "tinyg_linemode",\n    "tinyg_tidmode",\n    "tinygg2",\n    "grbl",\n    "marlin"\n   ],\n   ', '');

		this.consoleLog.appendMsg('SPJS', { Msg, Type: 'SerialPorts' });

	 	const that = this;

		// Sort the portList data array by ascending port number. Technically this is not really needed... but ocd ;)
		data = data.SerialPorts.sort((a, b) => {
			return Number(a.Name.substring(3)) - Number(b.Name.substring(3));
		});

		let dataObj = {};
		// Make the port list data into an object.
		for (let i = 0; i < data.length; i++) {
			// The linux platform gives port names like 'dev/ttyAMA0' which messes up the object names and the dom operations.
			safePort = this.makePortSafe(data[i].Name);

			dataObj[safePort] = {};

			for (let x in data[i]) {

				if (x === 'Name') {
					continue;

				} else if (x === 'RelatedNames') {
					// HACK: just make the first related name safe.
					// FIXME: make a loop to make all related names safe.
					dataObj[safePort][x] = data[i][x] ? [ this.makePortSafe(data[i][x][0]) ] : [ '' ];

				} else {
					dataObj[safePort][x] = data[i][x];

				}

			}
		}

		// Check for errors in the portList (aka. no serial numbers, vid/pid).
		// If any errors are present, discard data and get portList again.
		// Linux os will show ports like '/dev/ttyAMA0' with no assocciated serial number.
		if (hostMeta.platform !== 'linux' && !this.validifyPortList(dataObj)) {
			// console.warn("Got corrupted port list data.");
			console.log('Got corrupted port list data.');

			// Indicate that the 'list' command has errored in the SPJS console log.
			// This also removes the 'list command from the verifyBuffer object allowing others 'list' commands to be sent.
			// this.logCmdStatus('SPJS', {Cmd: 'list'}, 'Error');
			this.consoleLog.updateCmd('SPJS', { Msg: 'list', IndexMap: this.consoleLog.SPJS.verifyMap, Status: 'Warning', Comment: 'Corrupt' });

			setTimeout(function() {
				publish(`/${that.id}/spjs-send`, 'list');
			}, 500);

			return false;
		}

		// Indicate that the 'list' command has been executed in the SPJS console log.
		// This also removes the 'list command from the verifyBuffer object allowing others 'list' commands to be sent.
		this.consoleLog.updateCmd('SPJS', { Msg: 'list', Status: 'Executed' });

		console.groupCollapsed("onSerialPorts");
		console.log("SPJS -PortList-" + gui.parseObject(dataObj, 2, ["DeviceClass", "IsPrimary", "AvailableBufferAlgorithms", "Ver"]));

		// Build the portListDiffs object.
		// If the port list has not changed since the last time it was received, exit the function.
		if (!this.buildPortListDiffs(dataObj)) {
			console.groupEnd();
			console.log("PortList not changed.");
			return false;
		}
		console.log("PortList changed." + gui.parseObject(this.SPJS.portListDiffs, 2));

		this.SPJS.portList = dataObj;
		let diffs = this.SPJS.portListDiffs;
		// var openPorts = this.SPJS.openPorts;
		let openLogs = this.consoleLog.openLogs;

		// Do object and DOM updates based on how the portList has changed.
		// If any ports have opened/closed, update the openPorts object, and call portConnected()/portDisconnected() if they have not been called yet (aka. when we connect to the SPJS and it already has open ports on it).
		// Normally when a port is opened/closed, portConnected()/portDisconnected() is called by onPortOpen()/onPortClose() in response to an 'open/close port' command from the SPJS.
		if (diffs.opened) {
			console.log("diffs.opened: " + gui.parseObject(diffs.opened));
			this.SPJS.openPorts = this.SPJS.openPorts.concat(diffs.opened);
			// TODO: Change this from an anonymous function to an arror function.
			// this.SPJS.openPorts = this.SPJS.openPorts.sort(function(a, b) {
			// 	return Number(a.substring(3)) - Number(b.substring(3));
			// });

			this.SPJS.openPorts = this.SPJS.openPorts.sort((a, b) => {
				return Number(a.substring(3)) - Number(b.substring(3));
			});

			for (let i in diffs.opened) {
				if (openLogs.indexOf(diffs.opened[i]) == -1) {
					that.portConnected(diffs.opened[i]);
				}
			}
		}
		if (diffs.closed) {
			// Remove the ports in the actionData object from the openPorts object.
			for (let i in diffs.closed) {
			 	const port = diffs.closed[i];
				that.SPJS.openPorts.splice(that.SPJS.openPorts.indexOf(port), 1);

				if (openLogs.indexOf(port) != -1) {
					that.portDisconnected(port);
				}
			}
		}

		// If SPJS has 'no list -> list' or 'list -> no list', show/hide the warning in the port list DOM.
		if (diffs.SPJS && diffs.SPJS[0] == "no list -> list") {
			$('#' + this.id + ' .serialport-connection-warning').addClass("hidden");
		}
		if (diffs.SPJS && diffs.SPJS[0] == "list -> no list") {
			$('#' + this.id + ' .serialport-connection-warning').removeClass("hidden");
		}

		console.log("openPorts: " + gui.parseObject(this.SPJS.openPorts));
		console.log("openLogs: " + gui.parseObject(this.consoleLog.openLogs));

		console.groupEnd();

		// If connected to an SPJS that was not launched by the launchSpjs method with no devices active, close the SPJS and launch a new one.
		// console.log('go:', this.SPJS.go);
		// console.log('openPorts:', this.SPJS.openPorts);
		if (this.SPJS.exitUntrustedSpjs && !this.SPJS.openPorts.length && this.SPJS.go === null) {
			console.log("Exiting this SPJS and launching a new one.");

			this.newspjsSend({ Msg: 'exit', Comment: 'Untrusted SPJS'});

			// Exit this method to prevent trying to open ports automatically.
			return false;
		}

		// If there are no ports on SPJS and requestListDelay is set, request a new list.
		if (!data.length && this.SPJS.requestListDelay !== null) {
			setTimeout(function() {
				// publish(`/${that.id}/spjs-send`, 'list');
				this.newspjsSend({ Msg: 'list', Comment: 'Auto List'});
			}, this.SPJS.requestListDelay);
		}

		// Build the portMeta object based on the portList and deviceMeta objects.
		this.buildPortMeta();

		// Publish the new portList object, portMeta object, and diffs object so that other widgets can react to these changes.
		publish(`/${this.id}/recvPortList`, dataObj, this.SPJS.portMeta, diffs);

		// If any ports have been added/removed, call the portListDomUpdate method.
		if (diffs.added) {
			// IDEA: Make portListDomUpdate accept arguments to make updates more efficient (eg. this.portListDomUpdate(diffs.added)).
			this.portListDomUpdate();

			// If no ports are currently open, try to auto connect to one.
			this.SPJS.openPorts.length || this.autoConnectPorts();
		}
		if (diffs.removed) {
			// IDEA: Make portListDomUpdate accept arguments to make updates more efficient (eg. this.portListDomUpdate(diffs.removed)).
			this.portListDomUpdate();
		}

		console.log("openPorts: " + gui.parseObject(this.SPJS.openPorts));
		console.log("openLogs: " + gui.parseObject(this.consoleLog.openLogs));

	},
	validifyPortList: function (data) {
		// This method checks that port list data received from the SPJS is not corrupted.
		console.log("Validating port list data.");

		var that = this;
		var requiredProp = ["SerialNumber", "UsbPid", "UsbVid"];

		// Check that each property in the requiredProp array has an associated value for each port in the portList object.
		for(var i in data) {
			for(var x = 0; x < requiredProp.length; x++) {
				// If port list data is corrupted, return 'false'.
				if (!data[i][requiredProp[x]]) {
					return false;
				}
			}
		}

		// Return 'true' to indicate that data is valid.
		return true;
	},
	buildPortListDiffs: function (data) {
		console.log("Finding diffs in list data."); // ...since 1903
		// console.log("this.SPJS.portList:", this.SPJS.portList);

		var portList = this.SPJS.portList;
		var diffs = this.SPJS.portListDiffs = {};

		// The dataCount and portListCount properties are used to count how many ports are in the new and old port list data, respectively.
		var dataCount = 0;
		var portListCount = 0;

		for(let port in data) {
			dataCount++;
			// If this port is not in portList, port was added.
			if (!portList[port]) {
				if (!diffs.added) diffs.added = [];
				diffs.added.push(port);
			}

			for(let i in data[port]) {
				// console.log("  " + i + ": " + gui.parseObject(data[port][i], ""));
				if (i == "IsOpen" && data[port][i] && (!portList[port] || !portList[port][i])) {
					if (!diffs.opened) diffs.opened = [];
					diffs.opened.push(port);
				} else if (i == "IsOpen" && !data[port][i] && portList[port] && portList[port][i]) {
					if (!diffs.closed) diffs.closed = [];
					diffs.closed.push(port);
				} else if (i == "FeedRateOverride" && portList[port] && data[port][i] != portList[port][i]) {
					if (!diffs.feedrate) diffs.feedrate = [];
					diffs.feedrate.push(port);
				}
			}
		}

		for(let port in portList) {
			portListCount++;
			// If this port is not in the new port list, the port was removed.
			if (!data[port]) {
				if (!diffs.removed) diffs.removed = [];
				diffs.removed.push(port);
			}
			// If this port was removed from the SPJS and it was open.
			if (!data[port] && portList[port].IsOpen) {
				if (!diffs.closed) diffs.closed = [];
				diffs.closed.push(port);
			}
		}

		if (diffs && (!portListCount || !dataCount)) {
			diffs.SPJS = [ (portListCount ? "list":"no list") + " -> " + (dataCount ? "list":"no list") ];
		}

		return diffs;
	},
	buildPortMeta: function () {
		// console.group("building portMeta");
		console.groupCollapsed("Building portMeta");
		// Builds the portMeta object based on the portList object and using information from the deviceMeta object.
		// The portMeta object is used to determine which port to automatically connect to, and is used with portList to build the serial port list in the DOM.
		const that = this;
		const portList = this.SPJS.portList;
		const deviceMeta = this.deviceMeta;
		const portMeta = this.SPJS.portMeta;

		let portMetaObj = {};
		let matchIndex = 0;
		let portListUpdate = false;

		// Loop through each port object in the received serial ports object.
		for (let port in portList) {
			console.log(`Port ${port}`);

			// Loop through each meta in the deviceMeta object and check if it matches the current port in the serial ports list.
			metaLoop: for (let i = 0; i < deviceMeta.length; i++) {
				console.log("  i: " + i);

				// Loop through each Vid/Pid in the current deviceMeta and check for match against Vid/Pid in received port data.
				for (let x = 0; x < deviceMeta[i].VidPids.length; x++) {
					console.log("    x: " + x);

					// If the Vid/Pids from the deviceMeta match the received port's Vid/Pids.
					if (deviceMeta[i].VidPids[x].Vid.toLowerCase() == portList[port].UsbVid.toLowerCase() && deviceMeta[i].VidPids[x].Pid.toLowerCase() == portList[port].UsbPid.toLowerCase()) {

						matchIndex = i;

						// If this port has any related ports.
						if (portList[port].RelatedNames) {

							let a = Number(port.replace(/com|fs-dev-fs-tty\D{3}/i, ''));
							let b = Number(portList[port].RelatedNames[0].replace(/com|fs-dev-fs-tty\D{3}/i, ''));

							console.log(`a: ${a}\nb: ${b}`);

							// If this port is greater than it's related port, use the next meta object in the deviceMeta array.
							if (a > b && matchIndex < deviceMeta.length - 1 && JSON.stringify(deviceMeta[i].VidPids) === JSON.stringify(deviceMeta[i + 1].VidPids)) {
								matchIndex++;
								console.log(`      ++i: ${matchIndex}`);
							}
						}

						console.log(`      break. [${deviceMeta[matchIndex].Friendly}]`);
						console.log(`index: ${matchIndex}\ndeviceMeta: `, deviceMeta[matchIndex]);

						// Exit the search for meta data becuase a match was found.
						break metaLoop;

					// If the Vid/Pid are empty strings, set the meta as the default meta data.
					} else if (deviceMeta[i].VidPids[x].Vid === '' && deviceMeta[i].VidPids[x].Pid === '') {
						matchIndex = i;
						console.log("      default. [" + deviceMeta[matchIndex].Friendly + "]");
					}
				}
			}

			const matchItem = deviceMeta[matchIndex];
			const matchFriendly = matchItem.useReceivedFriendly ? portList[port].Friendly.split('(COM')[0] : matchItem.Friendly;
			// console.log(`useReceivedFriendly: ${matchItem.useReceivedFriendly}\nmatchFriendly: ${matchFriendly}`);
			const matchBaud = portList[port].Baud || matchItem.Baud;
			const matchBuffer = portList[port].Buffer || matchItem.Buffer;

			// If the info in the portMeta object has changed, perform a DOM update on the serial ports list.
			if (portMeta[port] && (matchBaud !== portMeta[port].Baud || matchBuffer !== portMeta[port].Buffer)) {
				portListUpdate = true;
				console.log('Will update port list DOM.');
			}

			const lineEndings = this.consoleLog.lineEndings;
			const defaultLineEnding = this.consoleLog.defaultLineEnding;

			portMetaObj[port] = {
				metaIndex: matchIndex,
				Friendly: matchFriendly,
				Baud: matchBaud,
				Buffer: matchBuffer,
				autoConnectPort: matchItem.autoConnectPort,
				portMuted: matchItem.portMuted,
				lineEnding: matchItem.lineEnding ? lineEndings[matchItem.lineEnding] : lineEndings[defaultLineEnding]
			};

		}

		this.SPJS.portMeta = portMetaObj;

		portListUpdate && this.portListDomUpdate();

		console.log("Built -portMeta-" + gui.parseObject(this.SPJS.portMeta, 2));
		console.groupEnd();

	},
	portListDomUpdate: function () {
		// TODO: Make portListDomUpdate accept arguments to make updates more efficient. (aka. only update what is needing to be changed rather that rebuilding the entire DOM list everytime.)
		console.groupCollapsed('Updating port list DOM');

		const that = this;
		const portList = this.SPJS.portList;
		const portMeta = this.SPJS.portMeta;

		let listHtml = '<tbody>';

		// Build the new DOM code.
		for (let port in portList) {

			let classItem = `${listHtml == '<tbody>' ? ' first-item' : ''}${portMeta[port].portMuted ? ' text-muted' : ''}`;
			let portHtml = `<tr evt-data="${port}" class="port-list-item port-${port}${classItem}${portList[port].IsOpen ? ' success' : ''}">`;

			portHtml += `<td class="port-toggle-btn"><span class="fa fa-toggle-${portList[port].IsOpen ? 'on' : 'off'}"></span></td>`;
			portHtml += `<td class="port-name">${this.makePortUnSafe(port)}</td>`;
			portHtml += `<td class="port-friendly">${portMeta[port].Friendly}</td>`;
			portHtml += `<td class="port-baud">${portMeta[port].Baud}</td>`;
			portHtml += `<td class="port-buffer">${portMeta[port].Buffer}</td>`;
			// portHtml += '<td class="">' + portMetaItem.Buffer + '</td>';
			portHtml += '</tr>';

			listHtml += portHtml;

			console.log(`Port ${port}${(portMeta[port].portMuted ? ' [muted]' : '')}:`, portHtml);

		}

		listHtml += '</tbody>';

		// Update the DOM.
		$(`#${this.id} .serial-port-list`).html(listHtml);
		this.resizeWidgetDom();

		console.groupEnd();

	},
	autoConnectPorts: function () {
		console.groupCollapsed("Auto-Connect Ports");

		const that = this;
		const portList = this.SPJS.portList;
		const portMeta = this.SPJS.portMeta;

		for (let port in portMeta) {
			// console.log("Port " + portMeta[port].Name + gui.parseObject(portMeta[port], 2));
			// If the port's autoConnectPort property is 'true', and the port is not already open, send an 'open' command to the SPJS.
			const unsafePort = this.makePortUnSafe(port);

			if (portMeta[port].autoConnectPort && !portList[port].IsOpen) {
				console.log(`Port '${unsafePort}' ...connecting`);

				const Msg = `open ${unsafePort} ${portMeta[port].Baud} ${portMeta[port].Buffer}`;

				this.newspjsSend({ Msg });

			} else if (portList[port].IsOpen) {
				console.log(`Port '${unsafePort}' ...already open`);

			} else {
				console.log(`Port '${unsafePort}' ...nope`);
			}
		}

		console.groupEnd();
	},
	onPortOpen: function (data) {
		const { Cmd, Desc, Port, IsPrimary, Baud, BufferType } = data;
		// Ex. { Cmd: "Open", Desc: "Got register/open on port.", Port: "COM10", IsPrimary: true, Baud: 115200, BufferType: "tinygg2" }

		console.log(`SPJS -PortOpen-${gui.parseObject(data, 2)}`);

		// Add the message to the SPJS log.
		this.consoleLog.appendMsg('SPJS', { Msg: data, Type: Cmd });

		const that = this;
		const portMeta = this.SPJS.portMeta;
		const safePort = this.makePortSafe(Port);

		let refCmd = `open ${Port} ${Baud}${BufferType ? ` ${BufferType}` : ''}`;

		// If this was caused by an 'open' command in the SPJS, set the status of that command to 'Executed'.
		if (!this.consoleLog.updateCmd('SPJS', { Msg: refCmd, Status: 'Executed' })) {

			this.consoleLog.updateCmd('SPJS', { PartMsg: `open ${Port}`, Status: 'Executed' });

		}

		// If the port was opened with different settings from the deviceMeta data, update the serial ports list DOM.
		if (Baud !== portMeta[safePort].Baud || BufferType !== portMeta[safePort].Buffer) {

			// If a Baud value was given, update the device's portMeta object.
			portMeta[safePort].Baud = Baud || portMeta[safePort].Baud;
			portMeta[safePort].Buffer = BufferType || portMeta[safePort].Buffer;

			this.portListDomUpdate();

		}

		this.portConnected(safePort);
		this.sendPortInits(safePort);

		// publish(`/${this.id}/port-open`, port);

		// Get port list to keep the portList object up to date.
		// Use a delay to avoid getting corrupted port list data.
		setTimeout(function() {
			that.newspjsSend({ Msg: 'list' });

		}, 250);

	},
	portConnected: function (port) {
		// The portConnected method handles all the DOM and object updates required whenever a port is connected.

		var nextPort = null;
		// If the port argument is [array], this function will be ran once for each port in the array.
		if (typeof port == "object") {
			nextPort = [...port];
			port = nextPort.shift();
		}
		// If the port argument is 'SPJS', exit the method.
		if (port === 'SPJS') return false;

		console.groupCollapsed("Port Connected: " + port);
		let that = this;

		// If this port is already initiated (ie. this method was called redundantly), skip all DOM and object updates.
		if (this.consoleLog[port] !== undefined && this.consoleLog.openLogs.indexOf(port) != -1) {
			console.log("portConnected was already called for this port." + gui.parseObject(this.consoleLog, 2));

		// If this method was not called redundantly, update objects and DOM elements.
		} else {
			// if (!this.consoleLog.removeLogOnClose) {
			// }

			// Remove any hilites on the port in the serial device list.
			$('#' + this.id + ' .splist .port-' + port).removeClass("success warning");
			// Change the toggle-on button into a toggle-off button in the serial device list.
			$('#' + this.id + ' .splist .port-' + port + ' .port-toggle-btn > span').removeClass("fa-toggle-on").addClass("fa-toggle-off");

			// If this port's console log is visible, make the spjs' console log visible.
			if (port == this.consoleLog.activeLog) {
				// console.log("This port's console log was visible.");
				this.consoleLogChangeView("SPJS");
			}

			// Remove the respective port's console log output <div> element.
			$('#' + this.id + ' .console-log-panel .nav-tabs .list-tab-' + port).remove();
			// Remove the respective port's console log tab.
			$('#' + this.id + ' .console-log-panel .panel-body .log-' + port).remove();

			// Hilite the port green in the serial devices list.
			$('#' + this.id + ' .splist .port-' + port).addClass("success");
			// Change the toggle-off button into a toggle-on button in the serial devices list.
			$('#' + this.id + ' .splist .port-' + port + ' .port-toggle-btn > span').removeClass("fa-toggle-off").addClass("fa-toggle-on");

			// Update and sort the openLogs object. Sort the SPJS element to the end of the array.
			// IDEA: Use .splice() to add this port to the openLogs array so it does not need to be sorted everytime and use .localCompare() to know where it should be added.
			this.consoleLog.openLogs.unshift(port);
			this.consoleLog.openLogs = this.consoleLog.openLogs.sort(function(a, b) {
				var x = (a == "SPJS") ? 999:Number(a.substring(3));
				var y = (b == "SPJS") ? 999:Number(b.substring(3));
				return x - y;
			});

			// const origional = { a: 1, b: 2 };
			const msgShowDefault = this.consoleLog.msgShowDefault;
			// const msgShowDefault = { ...this.consoleLog.msgShowPortDefault };

			// Build the port log object.
			this.consoleLog[port] = {
				logData: [],
				cmdMap: [],
				verifyMap: [],
				msgCount: 0,
				value: "",
				inputStatus: null,
				cmdCount: 0,
				history: [],
				historyRecallIndex: null,
				placeholder: `GCode ${this.makePortUnSafe(port.replace(/fs-dev-fs-tty/i, ''))}`,
				verifyBuffer: [],
				msgShow: Object.assign({}, msgShowDefault)
			};

			// HTML for the console log tab.
			let consoleLogTabHtml = '';
			consoleLogTabHtml += '<li role="presentation" class="list-tab-' + port + '">';
			consoleLogTabHtml += '<span evt-data="' + port + '" class="console-log-tab">' + this.makePortUnSafe(port.replace(/fs-dev-fs-tty/i, '')) + '</span></li>';

			// HTML for the console log panel.
			let consoleLogOutputHtml = '<div class="console-log-output log-' + port + ' hidden"></div>';

			// Build the console log DOM based on the openLogs array.
			for(let i = this.consoleLog.openLogs.indexOf(port) + 1; i < this.consoleLog.openLogs.length; i++) {
				// console.log("openLogs[" + i + "]: " + that.consoleLog.openLogs[i]);
				publish('/statusbar-widget/add', port, this.makePortUnSafe(port.replace(/fs-dev-fs-tty/i, '')), "success", that.consoleLog.openLogs[i]);
				$('#' + that.id + ' .console-log-panel .nav-tabs .list-tab-' + that.consoleLog.openLogs[i]).before(consoleLogTabHtml);
				$('#' + that.id + ' .console-log-panel .panel-body .log-' + that.consoleLog.openLogs[i]).before(consoleLogOutputHtml);
				break;
			}

			// Call a  resize on the DOM elements so that 'style="height: ---px;"' is added to the console log's DOM element to ensure that scroll bars are created properly..
			this.resizeWidgetDom();

			console.log("openLogs: " + gui.parseObject(this.consoleLog.openLogs));

			// If this port's raw data buffer is undefined, define it.
			if (this.dataRecvBuffer[port] === undefined) {
				this.dataRecvBuffer[port] = "";

			// If this port's raw data buffer is already defined, call onRawPortData method to add the raw data to this port's log.
			} else {
				this.parseRawPortData(port);

			}

			// If the temporary data buffer was used to buffer data until the port officially opened, transfer that data to the dataRecvBuffer object.
			// if (this.tempDataRecvBuffer[port]) {
			// 	this.dataRecvBuffer[port] = this.tempDataRecvBuffer[port];
			// 	delete this.tempDataRecvBuffer[port];
			// }

		}

		console.groupEnd();

		// If the port argument was passed as [array], run the portConnected method for the next element in the port array.
		if (nextPort && nextPort.length && nextPort != "SPJS") this.portConnected(nextPort);
	},
	portDisconnected: function (port) {
		let nextPort = null;

		// If the port argument is [array], this function will be ran once for each port in the array.
		if (typeof port == "object") {
			nextPort = [...port];
			port = nextPort.shift();
		}
		// If the port argument is 'SPJS', exit the method.
		if (port == "SPJS") return false;

		console.groupCollapsed("Port Disconnected: " + port);
		// The portDisconnected method handles all of the DOM and object updates required whenever a port is disconnected.
		var that = this;

		// If this port is already un-initiated (aka. this function was called redundantly), skip all DOM and object updates.
		if (this.consoleLog[port] === undefined && this.consoleLog.openLogs.indexOf(port) == -1) {
			console.log("portDisconnected has already been called for this port." + gui.parseObject(this.consoleLog, 2));

		// If this method was not redundantly called, update objects and DOM elements.
		} else {
			// Update the openPorts array.
			// IDEA: Use .splice() to remove this port from the openLogs array.
			var openLogs = [];
			for(var i = 0; i < this.consoleLog.openLogs.length; i++) {
				// console.log("consoleLog.openLogs[" + i + "]: " + that.consoleLog.openLogs[i]);
				if (that.consoleLog.openLogs[i] != port) {
					// console.log("  ...concat-ing");
					openLogs = openLogs.concat(that.consoleLog.openLogs[i]);
				}
				// console.log("openLogs: " + gui.parseObject(openLogs));
			}
			this.consoleLog.openLogs = openLogs;

			// Remove the respective port from the statusbar.
			publish('/statusbar-widget/remove', port);
			// publish('/statusbar-widget/hilite', "serialport-a", "danger");

			// // If the removeLogOnClose flag is false, the following DOM updates will be done if/when the port is next opened (in the portConnected method).
			// if (this.consoleLog.removeLogOnClose) {
			// }

			// Remove any hilites on the port in the serial device list.
			$('#' + this.id + ' .splist .port-' + port).removeClass("success warning");
			// Change the toggle-on button into a toggle-off button in the serial device list.
			$('#' + this.id + ' .splist .port-' + port + ' .port-toggle-btn > span').removeClass("fa-toggle-on").addClass("fa-toggle-off");

			// If this port's console log is visible, make the spjs' console log visible.
			if (port == this.consoleLog.activeLog) {
				// console.log("This port's console log was visible.");
				this.consoleLogChangeView("SPJS");
			}

			// Remove the respective port's console log output <div> element.
			$('#' + this.id + ' .console-log-panel .nav-tabs .list-tab-' + port).remove();
			// Remove the respective port's console log tab.
			$('#' + this.id + ' .console-log-panel .panel-body .log-' + port).remove();

			// Delete the respective port's consoleLog and dataRecvBuffer objects.
			delete this.consoleLog[port];
			delete this.dataRecvBuffer[port];

			// console.log("openLogs: " + gui.parseObject(this.consoleLog.openLogs));
			// console.log("openLogs: ", this.consoleLog);
			// console.log("consoleLog.length: ", this.consoleLog.length);
		}
		console.groupEnd();
		if (nextPort && nextPort.length && nextPort != "SPJS") this.portDisconnected(nextPort);
	},
	onPortOpenFail: function (data) {
		const { Cmd, Port, Baud, Desc } = data;
		// Ex. { Cmd: "OpenFail", Desc: "Error opening port. The system cannot find the file specified.", Port: "COM69", Baud: 115200 }
		console.log(`SPJS -PortOpenFail-\n  Cmd: ${Cmd}\n  Port: ${Port}\n  Baud: ${Baud}\n  Desc: ${Desc}`);

		// Add the message to the SPJS log.
		this.consoleLog.appendMsg('SPJS', { Msg: data, Type: Cmd });

		const that = this;
		const safePort = this.makePortSafe(Port);
		const verifyMap = this.consoleLog[safePort].verifyMap;

		// It this was caused by an 'open' command in the SPJS, set the status of that command to 'Error'.
		const refCmd = `open ${Port}`;
		verifyMap.length && this.consoleLog.updateCmd('SPJS', { PartMsg: refCmd, IndexMap: verifyMap, Status: 'Error' });

		this.portDisconnected(safePort);

		// Repeatedly attempt to connect to a port.
		if (this.SPJS.requestListDelay !== null) {

			setTimeout(function() {
				that.newspjsSend({ Msg: 'list' });

			}, this.SPJS.requestListDelay);
		}

	},
	onPortClose: function (data) {
		const { Cmd, Desc, Port, Baud } = data;
		// Ex. {Cmd: "Close", Desc: "Got unregister/close on port.", Port: "COM10", Baud: 115200}
		console.log("SPJS -PortClose-\n  Cmd: " + data.Cmd + "\n  Port: " + data.Port + "\n  Baud: " + data.Baud + "\n  Desc: " + data.Desc);

		// Add the message to the SPJS log.
		this.consoleLog.appendMsg('SPJS', { Msg: data, Type: Cmd });

		const that = this;
		const safePort = this.makePortSafe(Port);

		const refCmd = `close ${Port}`;

		const { matchFound, matchType } = this.consoleLog.updateCmd('SPJS', { PartMsg: refCmd, Type: 'MdiCommand', Status: 'Executed' });

		// If the port closed because of a SPJS mdi command, prevent the port from autoconnecting again.
		if (matchFound) {
			// FIXME: Fix this.
			// FIXME: This is weird, the port doesnt autoconnect even though there is no code here.
			this.deviceMeta[this.SPJS.portMeta[safePort].metaIndex].autoConnectPort = false;
			console.log(`Clearing auto-connect on: ${Port}`);

		// If the port closed because of a SPJS command.
		} else if (this.consoleLog.updateCmd('SPJS', { PartMsg: refCmd, Status: 'Executed' })) {


		// If the port did not close because of a SPJS command, we know that the port disconnected unexpectedly.
		} else {
			// console.warn(`Port ${port} disconnected unexpectedly.`);

			// IDEA: Publish the unexpected port close event so that other widgets can respond accordingly.

		}

		this.portDisconnected(safePort);

		// Get port list to keep the portList object up to date.
		// Use a delay to avoid getting corrupted port list data.
		setTimeout(function() {
			that.newspjsSend({ Msg: 'list' });
		}, 250);

	},
	sendPortInits: function (port) {
		console.groupCollapsed('Sending init scripts to device.');
		console.log(`Init scripts for ${port}.`);

		// const { metaIndex, Friendly, Baud, Buffer, autoConnectPort, portMuted } = this.SPJS.portMeta[port];
		const meta = this.SPJS.portMeta[port];
		const portData = this.SPJS.portList[port];

		// Scan through the initScripts array for a match with the port information.
		for (let i = 0; i < this.initScripts.length; i++) {
			console.log(`i: ${i}`);
			let misMatch = 0;
			let scriptItem = this.initScripts[i];

			Object.keys(scriptItem).forEach(function (key, index) {
			    // key: the name of the object key
			    // index: the ordinal position of the key within the object
				console.log(`key: ${key}`);

				if (key !== 'script' && key !== 'pause') {

					if ((key === 'Friendly' || key === 'Baud' || key === 'Buffer') && meta[key] !== scriptItem[key] ) {
						misMatch += 1;

					} else if (key === 'SerialNumber' && portData[key] !== scriptItem[key] ) {
						misMatch += 1;

					}

				}

			});

			// If there is no mis-matching info, send the script.
			if (!misMatch) {
				console.groupEnd();
				// Return so that the caller knows that init scripts were sent.
				return this.newportSendJson(port, { Data: scriptItem.script, Id: 'init0', Pause: scriptItem.pause });

			}

		}

		console.groupEnd();
		return false;

	},
	onBroadcast: function (data) {
		const { Cmd, Msg } = data;
		// Ex. {Cmd: "Broadcast", Msg: "helloworld↵"}
		console.log(`SPJS -Broadcast-\n  Cmd: ${Cmd}\n  Msg: ${Msg}`);

		// Add the message to the SPJS log.
		this.consoleLog.appendMsg('SPJS', { Msg: data, Type: Cmd });

		this.consoleLog.updateCmd('SPJS', { PartMsg: 'broadcast', Status: 'Executed' });

	},
	onWipedQueue: function (data) {
		const { Cmd, QCnt, Port } = data;
		// Ex. { "Cmd": "WipedQueue", "QCnt": 0, "Port": "COM10" }

		console.log(`SPJS -WipedQueue-\n  Cmd: ${Cmd}\n  QCnt: ${QCnt}\n  Port: ${Port}`);

		// Add the mess age to the SPJS log.
		this.consoleLog.appendMsg('SPJS', { Msg: data, Type: Cmd });

		const safePort = this.makePortSafe(Port);

	},
	onQueuedJson: function (data) {
		const { Cmd, QCnt, P, Data } = data;

		// Ex. { "Cmd": "Queued", "QCnt": 1, "P": "COM10", "Data": [{ "D": "\n", "Id": "startup1", "Pause": 0 }] }
		// Ex. { "Cmd": "Queued", "QCnt": 2, "P": "COM10", "Data": [{ "D": "$sys\n", "Id": "console18", "Pause": 0 }, { "D": "{"ej":""}\n", "Id": "console18-part-2-2", "Pause": 0 }] }

		console.log(`SPJS -QueuedJson-${gui.parseObject(data, 2)}`);

		// Add the message to the SPJS log.
		this.consoleLog.appendMsg('SPJS', { Msg: data, Type: Cmd });

		const safePort = this.makePortSafe(P);

		for (let i = 0; i < Data.length; i++) {

			// If a command was sent in one line that the device parses as two lines, it will add a suffix to the command's id like: 'com10n7' -> 'com10n7-part-1-2' and 'com10n7-part-1-2'.
			// If there is no Id, the message may have been sent as a non-buffered command which does not send an associated id.
			const refId = Data[i].Id.split('-part')[0];

			if (refId && this.consoleLog.updateCmd(safePort, { Id: refId, Status: 'Queued', UpdateRelated: true })) continue;

			if (this.consoleLog.updateCmd(safePort, { Msg: Data[i].D, Status: 'Queued', UpdateRelated: true })) continue;

			if (this.consoleLog.updateCmd(safePort, { PartMsg: Data[i].D, Status: 'Queued', UpdateRelated: true })) continue;

			// The command could have been sent as mdi from the spjs which means that it wouldnt show up in the port's log.
			if (this.consoleLog.updateCmd('SPJS', { PartMsg: Data[i].D, Status: 'Queued', UpdateRelated: true })) continue;

			console.log(`No match was found for Msg: '${Data[i].D}', Id: '${Data[i].Id}'`);

		}

	},
	// FIXME: Make this work for multiple commands at a time (when a list of data and ids are received).
	// TODO: Test that it works when receiving multiple commands at a time (see comment above).
	onQueuedText: function (data) {
		const { Cmd, QCnt, Ids, D, Port } = data;
		// Ex. { "Cmd": "Queued", "QCnt": 2, "Ids": [ "" ], "D": [ "!" ], "Port": "COM5" }

		console.log(`SPJS -QueuedText-\n  Cmd: ${Cmd}\n  QCnt: ${QCnt}\n  Ids: %O\n  D: %O\n  Port: ${Port}`, Ids, D);

		// Add the message to the SPJS log.
		this.consoleLog.appendMsg('SPJS', { Msg: data, Type: Cmd });

		const safePort = this.makePortSafe(Port);

		for (let i = 0; i < D.length; i++) {

			// If a command was sent in one line that the device parses as two lines, it will add a suffix to the command's id like: 'com10n7' -> 'com10n7-part-1-2' and 'com10n7-part-1-2'.
			// If there is no Id, the message may have been sent as a non-buffered command which does not send an associated id.
			const refId = Ids[i].split('-part')[0];

			if (refId && this.consoleLog.updateCmd(safePort, { Id: refId, Status: 'Queued', UpdateRelated: true })) continue;

			if (this.consoleLog.updateCmd(safePort, { Msg: D[i], Status: 'Queued', UpdateRelated: true })) continue;

			if (this.consoleLog.updateCmd(safePort, { PartMsg: D[i], Status: 'Queued', UpdateRelated: true })) continue;

			// The command could have been sent as mdi from the spjs which means that it wouldnt show up in the port's log.
			if (this.consoleLog.updateCmd('SPJS', { PartMsg: D[i], Status: 'Queued', UpdateRelated: true })) continue;

			console.log(`No match was found for Msg: '${D[i]}', Id: '${Ids[i]}'`);

		}

	},
	onWriteJson: function (data) {
		const { Cmd, QCnt, Id, P } = data;

		// Ex. { "Cmd": "Write", "QCnt" :0, "Id": "startup1", "P": "COM10" }
		// Ex. { "Cmd": "Write", "QCnt": 1, "Id": "console18", "P": "COM10" }
		// Ex. { "Cmd": "Write", "QCnt": 0, "Id": "console18-part-2-2", "P": "COM10" }
		// Ex. { "Cmd": "Write", "QCnt": 0, "Id": "", "P": "COM10" } <- from send text instead of json.
		// Ex. { "Cmd": "Write", "QCnt": 1, "Id": "", "P": "COM5" }

		console.log(`SPJS -WriteJson-${gui.parseObject(data, 2)}`);
		// console.log("SPJS -WriteJson-\n  Cmd: " + data.Cmd + "\n  QCnt: " + data.QCnt + "\n  Id: " + data.Id + "\n  Port: " + data.P);

		// Add the message to the SPJS log.
		this.consoleLog.appendMsg('SPJS', { Msg: data, Type: Cmd });

		// // See if we have an Id in the resposne, if so it is from a json send and we need to see the response.
		// // If there is no id, look for a recent command sent without buffering.
		// if (Id === '') {
		//
		// 	if (!this.consoleLog.updateCmd(P, { Meta: 'portSendNoBuf', Status: 'Written', UpdateRelated: true })) {
		// 		console.log('No match found searching for portSendNoBuf commands.');
		// 	}
		//
		// 	return;
		// }
		//
		// const refId = Id.split('-part')[0];
		//
		// // if (Id.includes('-part')) {
		// // 	console.warn(`There was '-part' added onto the id.\nId: ${Id}\nNew Id: ${refId}`);
		// // }
		//
		// // If the command was sent in json for with one or more other commands, look for it in the port's console log.
		// if (!this.consoleLog.updateCmd(P, { Id: refId, Status: 'Written', UpdateRelated: true })) {
		// 	this.consoleLog.updateCmd('SPJS', { Id: refId, Status: 'Written' });
		//
		// }

		const safePort = this.makePortSafe(P);
		const refId = Id.split('-part')[0];

		if (refId && this.consoleLog.updateCmd(safePort, { Id: refId, Status: 'Written', UpdateRelated: true })) return;

		if (refId && this.consoleLog.updateCmd('SPJS', { Id: refId, Status: 'Written' })) return;

		// The message could be from a recent sendNoBuf command.
		const refMsg = `sendnobuf ${P}`;

		const cmdMap = this.consoleLog.SPJS.cmdMap;
		const verifyMap = this.consoleLog.SPJS.verifyMap;
		const logData = this.consoleLog.SPJS.logData;

		// console.log('cmdMap:', cmdMap, '\nverifyMap:', verifyMap);

		if (refId === '' && verifyMap && verifyMap.length && this.consoleLog.updateCmd('SPJS', { PartMsg: refMsg, Status: 'Written', SearchFrom: 1 - logData.length, IndexMap: verifyMap })) return;

		console.log(`No match was found for Id: '${Id}'`);

	},
	onCompleteJson: function (data) {
		const { Cmd, Id, P } = data;

		// Ex. { "Cmd": "Complete", "Id": "internalInit0", "P": "COM10" }
		// Ex. { "Cmd": "CompleteFake", "Id": "console18", "P": "COM10" }
		// Ex. { "Cmd": "Complete", "Id": "console18-part-2-2", "P": "COM10" }
		// Ex. { "Cmd": "CompleteFake", "Id": "", "P": "COM5" } <- from send text instead of json.

		console.log(`SPJS -CompleteJson-\n  Cmd: ${Cmd}\n  Id: ${Id}\n  Port: ${P}`);

		// Add the message to the SPJS log.
		this.consoleLog.appendMsg('SPJS', { Msg: data, Type: Cmd });

		// // If there is no id, look for a recent command sent without buffering.
		// if (Id === '') {
		// 	if (!this.consoleLog.updateCmd(P, { Meta: 'portSendNoBuf', Status: 'Completed', UpdateRelated: true })) {
		// 		console.log('No match found searching for portSendNoBuf commands.');
		// 	}
		// 	return;
		// }
		// // const refId = (Id.match('-part')) ? Id.split()
		// const refId = Id.split('-part')[0];
		//
		// // If the command was sent in json for with one or more other commands, look for it in the port's console log.
		// if (!this.consoleLog.updateCmd(P, { Id: refId, Status: 'Completed', UpdateRelated: true })) {
		// 	this.consoleLog.updateCmd('SPJS', { Id: refId, Status: 'Completed' });
		// }

		const safePort = this.makePortSafe(P);
		const refId = Id.split('-part')[0];

		if (refId && this.consoleLog.updateCmd(safePort, { Id: refId, Status: 'Completed', UpdateRelated: true })) return;
		if (refId && this.consoleLog.updateCmd('SPJS', { Id: refId, Status: 'Completed' })) return;

		// The message could be from a recent sendNoBuf command.
		const refMsg = `sendnobuf ${P}`;

		const cmdMap = this.consoleLog.SPJS.cmdMap;
		const verifyMap = this.consoleLog.SPJS.verifyMap;
		const logData = this.consoleLog.SPJS.logData;

		// console.log('cmdMap:', cmdMap, '\nverifyMap:', verifyMap);

		if (refId === '' && verifyMap && verifyMap.length && this.consoleLog.updateCmd('SPJS', { PartMsg: refMsg, Status: 'Completed', SearchFrom: 1 - logData.length, IndexMap: verifyMap })) return;

		console.log(`No match was found for Id: '${Id}'`);

	},
	onErrorText: function (data) {
		const { Error } = data;

		// Ex. { "Error": "We could not find the serial port 10 that you were trying to apply the feedrate override to. This error is ok actually because it just means you have not opened the serial port yet." }
		// Ex. { "Error": "You did not specify a port and baud rate in your open cmd" }
		// Ex. { "Error": "Could not understand command." }
		// Ex. { "Error": "Could not parse send command: sendNoBuf" }
		// Ex. { "Error": "We could not find the serial port /dev/ttyAMA0 that you were trying to apply the feedrate override to. This error is ok actually because it just means you have not opened the serial port yet." }

		console.log(`SPJS -ErrorText-\n  Error: ${Error}`);

		// Add the message to the SPJS log.
		this.consoleLog.appendMsg('SPJS', { Msg: data, Type: 'Error' });

		let refMsg = '';

		// If the error message has a colon in it, then it has the origional message in it, use that to find the origional message in the console log.
		if (Error.includes(':')) {
			refMsg = Error.substring(Error.indexOf(':') + 2);
			console.log(`refMsg: '${refMsg}'`);

			this.consoleLog.updateCmd('SPJS', { Msg: refMsg, Status: 'Error', Comment: 'Syntax Error' });

		// If the message is in response to a non existent port, the message has the port name in it, use that to find the origional message in the console log.
		} else if (Error.includes('serial port') && Error.includes('that you were trying')) {
			let a = Error.indexOf('serial port') + 12;
			let b = Error.indexOf('that you were trying') - 1;

			refMsg = Error.substring(a, b);
			console.log(`refMsg: '${refMsg}'`);

			this.consoleLog.updateCmd('SPJS', { PartMsg: refMsg, Status: 'Error', Comment: 'Syntax Error' });

		} else {

			// If the verifyBuffer has anything in it, make the most recent command have a status of error.
			const verifyMap = this.consoleLog.SPJS.verifyMap;

			// TODO: Test to make sure this does not error.
			verifyMap.length && this.consoleLog.updateCmd('SPJS', { Index: verifyMap[verifyMap.length - 1], IndexMap: varifyMap, Status: 'Error', Comment: 'Syntax Error' });

		}

	},
	onErrorJson: function (data) {
		const { Cmd } = data;

		console.log('SPJS -ErrorJson-\n ', data);

		// Add the message to the SPJS log.
		this.consoleLog.appendMsg('SPJS', { Msg: data, Type: 'Error' });
	},
	onSystemAlarm: function (data) {
		const { er } = data;
		// Ex. { "er": { "fb": 78.02, "st": 27, "msg": "System alarmed", "val": 1 } }

		const { Label, Desc } = this.lookupStatusCode(er.st);

		console.log('SPJS -SystemAlarm-\n ', data, `\n  #${er.st} - ${Label}${ Desc ? `\n  Desc: ${Desc}` : ''}`);

		// Add the message to the SPJS log.
		this.consoleLog.appendMsg('SPJS', { Msg: data, Type: 'Error' });

	},
	lookupStatusCode: function (code) {
		// Return the label and description of a given status code.
		// Uses the lookup table retreived from the 'TinyG_Status_Codes.cson' file.

		let meta = this.tinygStatusMeta.statusCodes[code];

		// If no meta found for the provided status code, the code is reserved.
		if (!meta) {
			return { Code: code, Label: 'Reserved', Desc: '' };
		}

		let colonIndex = meta.indexOf(':');

		let Label = colonIndex >= 0 ? meta.substring(0, colonIndex) : meta;
		let Desc = colonIndex >= 0 ? meta.substring(colonIndex + 2, meta.length) : '';

		return { Code: code, Label, Desc };

	},
	onFeedRateOverride: function (data) {
		const { Cmd, Desc, Port, FeedRateOverride, IsOn } = data;
		// Ex. { "Cmd": "FeedRateOverride", "Desc": "Successfully set the feedrate override.", "Port": "COM10", "FeedRateOverride": 3, "IsOn": true }

		console.log(`SPJS -FeedRateOverride-\n  Desc: ${Desc}\n  Port: ${Port}\n  FeedRateOverride: ${FeedRateOverride}\n  IsOn: ${IsOn}\n  Cmd: ${Cmd}`);

		// Add the message to the SPJS log.
		this.consoleLog.appendMsg('SPJS', { Msg: data, Type: Cmd });
		this.consoleLog.updateCmd('SPJS', { PartMsg: 'fro ' , Status: 'Executed' });

	},
	onRawPortData: function (data) {
		const { P, D } = data;

		// Ex. { "P": "COM10", "D": "{"r":{"fv":0.970,"fb":78.02,"cv":5,"hp":3,"hv":0,"…"02130215d42","msg":"SYSTEM READY" }, "f": [1,0,0]}\n" }
		// Ex. { "P": "COM10", "D": "[fb]  firmware build             78.02\n" }
		// Ex. { "P": "COM10", "D": "{"r":{"rxm":null},"f":[1,100,9]}\n" }
		// Ex. { "P": "COM10", "D": "{"r":{"ej":1},"f":[1,0,9]}\n" }
		// Ex. { "P": "COM10", "D": "{"r":{"gc":"G0X0"},"f":[1,102,7]}\n" } <- from send text instead of json

		const logMessage = JSON.stringify(data, null, " ").replace(/\\\"/g, '"').replace(/\t/g, '    ');

		// Add the message to the SPJS log.
		this.consoleLog.appendMsg('SPJS', { Msg: data, Type: 'RawPortData' });

		const port = data.P;
		const safePort = this.makePortSafe(port);

		// If the dataRecvBuffer object for this port is not defined, define it.
		if (this.dataRecvBuffer[safePort] === undefined) {
			this.dataRecvBuffer[safePort] = '';
		}

		// Buffer the raw data onto the dataRecvBuffer object.
		this.dataRecvBuffer[safePort] += data.D;

		// If there is at least one full line of raw data in the data buffer and this port is open, parse the data in the raw data buffer.
		if (this.dataRecvBuffer[safePort].match(/\n/) && this.consoleLog.openLogs.indexOf(safePort) != -1) {
			// console.log('  ...parsing raw data.');
			this.parseRawPortData(safePort);

		// If this port is not open yet.
		} else if (this.consoleLog.openLogs.indexOf(safePort) == -1) {
			// console.log('  ...port not open yet.');
		}

	},
	parseRawPortData: function (port) {
		// This is a seperate method from onRawPortData so that it can be called after this port has been opened if raw data was received before it was opened.
		console.groupCollapsed(`Parsing raw port data.\n  Port: ${port}`);

		// See if received newline.
		while (/\n/.test(this.dataRecvBuffer[port])) {

			let tokens = this.dataRecvBuffer[port].split('\n');
			// 	let line = tokens.shift() + '\n';
			let line = tokens.shift();
			this.dataRecvBuffer[port] = tokens.join('\n');

			line = line.replace(/\t/g, '').replace(/\r/g, '').replace(/\v/g, '').replace(/\f/g, '');
			let lineObj;

			console.log(`line character length: ${line.length}\ncharCode: ${line.charCodeAt(0)}`);

			if (line === '') {
				console.log('This line is an empty string.');
				continue;
			}

			// HACK: Do some last minute cleanup.
			// THIS IS NOT GOOD, BUT SEEING TINYG SHOWING BAD DATA
			// THIS IS ALSO NOT THE RIGHT SPOT SINCE THIS SERIAL PORT WIDGET IS SUPPOSED
			// TO BE GENERIC. Remove when TinyG has no problems.
			if (line.match(/\{"sr"\{"sr"\:/) || line.match(/\{"r"\{"sr"\:/)) {
				// console.warn(`Got corrupted raw port data: '${line}'`);
				line = line.replace(/\{"sr"\{"sr"\:/, '{"sr":');
				line = line.replace(/\{"r"\{"sr"\:/, '{"sr":');
			}

			console.log(`line: ${line}`);
			// Add the raw data to the respective port's console log.
			this.consoleLog.appendMsg(port, { Msg: line, Type: 'RawPortData' });

			// Try parsing line and if it errors, it is a string. Eitherwise, it is an object that we want information from.
			try {
				lineObj = JSON.parse(line);

			} catch (err) {
				// There was an error parsing line therefore it is a string.
				lineObj = line;

				// If the line was an error message.
				// Ex. "tinyg [mm] err: Unrecognized command or config name: helloworld \n".
				if (/tinyg \[\w{2}\] err:/g.test(line)) {
					console.log('Got error message.');
					const a = line.indexOf(':', 15) + 2;
					const b = line.length - 1;
					const refMsg = line.substring(a, b);

					console.log(`RefMsg: '${refMsg}'`);
					const { matchId } = this.consoleLog.updateCmd(port, { Msg: refMsg, Status: 'Error', Comment: 'Syntax Error' });

					if (matchId) {
						this.consoleLog.updateCmd('SPJS', { Id: matchId, Status: 'Error', Comment: 'Syntax Error', UpdateRelated: false });

					} else {
						this.consoleLog.updateCmd('SPJS', { PartMsg: refMsg, Status: 'Error', Comment: 'Syntax Error' });
					}

				// If the device only uses text output (such as the arduino uno).
				} else if (/error: /.test(line)) {

					const cmdMap = this.consoleLog[port].cmdMap;

					cmdMap.length && this.consoleLog.updateCmd(port, { Index: cmdMap[cmdMap.length - 1], Status: 'Error', Comment: 'Syntax Error' });

				}
			}

			console.log('lineObj:', lineObj);

			// Look through received data for useful info.

			if (lineObj.f) {

				const [ pv, sc, rx ] = lineObj.f;
				console.log(`Footer:\n  pv: ${pv}\n  sc: ${sc}\n  rx: ${rx}`);
				// If there is a warning or error status code.
				if (sc) {
					console.log('sc !== 0');

					const { Code, Label, Desc } = this.lookupStatusCode(sc);

					console.log('lineObj.r:', lineObj.r);
					console.log(`typeof lineObj.r: ${typeof lineObj.r}`);
					console.log(`StatusMeta:\n  Code: ${Code}\n  Label: ${Label}\n  Desc: ${Desc}`);

					// If the lineObj data was an error message.
					if (lineObj.r && lineObj.r.err) {
						// Ex. { "r": {"err":"{sv}"}, "f": [1,108,4] }.
						console.log('Got error data.');

						const refMsg = lineObj.r.err;
						console.log(`  RefMsg: '${refMsg}'`);

						let Comment = Code ? Label : 'Syntax Error';

						if (!this.consoleLog.updateCmd(port, { Msg: refMsg, Status: 'Warning', Comment, UpdateRelated: true })) {
							console.log('Found no match. idk wtf to do.');
						}

					} else if (lineObj.r && typeof lineObj.r === 'string') {

						console.log(`lineObj.r is a string\n  r: ${lineObj.r}`);

						const refMsg = lineObj.r;
						// let Comment = statusMeta.Code ? statusMeta.Label : '';
						// let Comment = statusMeta.Label;

						// If no matching message was found and there was a footer message, look for a message with a matching length to the rx received by the device.
						if (!this.consoleLog.updateCmd(port, { Msg: refMsg, Status: 'Warning', Comment: `${Label} refMsg`, UpdateRelated: true }) && footer !== undefined && statusMeta.Code) {
							console.log('  No matching message was found. Searching for matching message using rx received by the device.');

							// NOTE: This is probably not a good idea cuz it may highlight the incorrect message as having an error since the search criteria is very vague.
							this.consoleLog.updateCmd(port, { Length: rx, Status: 'Warning', Comment: `${Label} length`, UpdateRelated: true });

						}

					} else if (typeof lineObj.r === 'object' && Object.keys(lineObj.r).length == 0) {

						console.log(`lineObj.r is an empty object.`);

						this.consoleLog.updateCmd(port, { Length: rx, Status: 'Warning', Comment: Label, UpdateRelated: true });


					} else if (typeof lineObj.r === 'object'){

						console.log('lineObj.r is an object.');

						let rStr = JSON.stringify(lineObj.r);
						// let refMsg = new RegExp(rStr.substring(0, rStr.indexOf(':')).replace(/\W/, ''), 'gi');
						let refMsg = rStr.substring(0, rStr.indexOf(':')).replace(/\W/g, '');
						console.log(`refMsg: ${refMsg}`);

						let { matchMsg, matchId } = this.consoleLog.updateCmd(port, { PartMsg: refMsg, Length: rx, Status: 'Warning', Comment: Label, UpdateRelated: true });

						console.log(matchId);

						if (!matchId) {
							console.log('No match was found for the partMsg and msg length given.');
						}

						// If no match is found or the length does not match.
						// if (!matchId || matchMsg.length != rx) {
						// 	this.consoleLog.updateCmd(port, { Length: rx, Status: 'Warning', Comment: `${Label} length`, UpdateRelated: true });
						// }

					} else {
						console.log('lineObj.r is unrecognized.');

						throw 'Make lineObj.r recognized and do something with it.'

					}

				}

			}

			// Let the other modules handle the data received.
			// publish(`/${this.id}/recvRawPortData`, port, lineObj);
		}

		console.groupEnd();

	},
	onQueueCnt: function (data) {
		const { QCnt } = data;

		console.log(`SPJS -QueueCnt-\n  QCnt: ${QCnt}`);

		this.SPJS.queueCount = Number(QCnt);

	},
	onGarbageCollection: function (data) {
		const { gc } = data;

		console.log(`SPJS -GarbageCollection-\n  Status: ${gc}`);

		const statusMeta = {
			starting: 'Written',
			done: 'Completed'
		}
		this.consoleLog.updateCmd('SPJS', { Msg: 'gc', Status: statusMeta[gc] });

		this.consoleLog.appendMsg('SPJS', { Msg: data, Type: 'GarbageCollection' });
	},
	onGarbageHeap: function (data) {
		const { Alloc, TotalAlloc, Sys, Lookups, Mallocs, Frees, HeapAlloc, HeapSys, HeapIdle, HeapInuse, HeapReleased, HeapObjects, StackInuse, StackSys, MSpanInuse, MSpanSys, MCacheInuse, MCacheSys, BuckHashSys, GCSys, OtherSys, NextGC, LastGC, PauseTotalNS, PauseNS, PauseEnd, NumGC, GCCPUFraction, EnableGC, DebugGC, BySize } = data;

		console.log('SPJS -GarbageCollectionHeap-');

		// Add the message to the SPJS log.
		this.consoleLog.appendMsg('SPJS', { Msg: data, Type: 'GarbageHeap' });

		console.log(`GCCPUFraction: ${(GCCPUFraction * 100).toFixed(10)}%`);

	},
	onExecRuntimeStatus: function (data) {
		const { ExecRuntimeStatus, OS, Arch, Goroot, NumCpu } = data;

		// The ExecRuntimeStatus message is a result of calling the 'execruntime' command.
		// Ex. { "ExecRuntimeStatus": "Done", "OS": "windows", "Arch": "amd64", "Goroot": "/usr/local/go", "NumCpu": 4 }

		console.log('SPJS -ExecRuntimeStatus-');
		this.consoleLog.appendMsg('SPJS', { Msg: data, Type: 'ExecRuntimeStatus' });

		const statusMeta = {
			Done: 'Executed'
		};

		this.consoleLog.updateCmd('SPJS', { Msg: 'execruntime', Status: statusMeta[ExecRuntimeStatus]});

	},
	onExecStatus: function (data) {
		// Ex. { "ExecStatus": "Error", "Id": "", "Cmd": "C:\\WINDOWS\\system32\\cmd.exe", "Args": [ "cd thermika" ], "Output": "Error trying to execute terminal command. No user/pass provided or command line switch was not specified to allow exec command. Provide a valied username/password or restart spjs with -allowexec command line option to exec command." }
		// Ex. { "ExecStatus": "Progress", "Id": "", "Cmd": "C:\\WINDOWS\\system32\\cmd.exe", "Args": [ "echo HelloWorld" ], "Output": "HelloWorld" }
		// Ex. { "ExecStatus": "Done", "Id": "", "Cmd": "C:\\WINDOWS\\system32\\cmd.exe", "Args": [ "echo HelloWorld" ], "Output": "HelloWorld" }
		const { ExecStatus, Id, Cmd, Args, Output } = data;

		console.log('SPJS -ExecStatus-');
		this.consoleLog.appendMsg('SPJS', { Msg: data, Type: 'ExecStatus' });

		const statusMeta = {
			Progress: 'Written',
			Done: 'Executed',
			Error: 'Error'
		};

		let Comment = '';

		if (ExecStatus === 'Error' && Output.includes('No user/pass provided')) {
			Comment = 'Permission Denied';

		} else if (ExecStatus === 'Error') {
			Comment = 'Failed';

		}

		let Msg = 'exec';

		for (let i = 0; i < Args.length; i++) {
			Msg += ` ${Args[i]}`;

		}

		this.consoleLog.updateCmd('SPJS', { Msg, Status: statusMeta[ExecStatus], Comment });

	},
	onParseError: function (data) {
		// Ex. { "Error" : "Problem decoding json. giving up. json: {"P":"COM11","Data":[{"D":"Hi ","Id":"mdi-com11log0"}]}, err:invalid character '\n' in string literal" }

		console.group(`SPJS -ParseError-\n  Error: ${Error}`);

		if (data.includes('Problem decoding json. giving up. json: ') && data.includes(', err:')) {

			let a = data.indexOf('json: ') + 6;
			let b = data.indexOf(', err:');

			const refMsg = data.substring(a, b);
			console.log(`refMsg: ${refMsg}`);

			if (!this.consoleLog.updateCmd('SPJS', { PartMsg: refMsg, Status: 'Error', Comment: 'JSON Error' })) {

				console.log('Match not found.\nTrying to get Id from error report.');

				if (data.includes('"Id":"') && (/\"[\}\]]+,/).test(data)) {

					let a = data.indexOf('"Id":"') + 6;
					let b = data.indexOf(data.match(/\"[\}\]]+,/)[0]);

					// console.log(`match: ${data.match(/\"[\}\]]+,/)}\nStartIndex: ${a}\nEndIndex: ${b}`);

					const refId = data.substring(a, b);
					console.log(`refId: ${refId}`);

					this.consoleLog.updateCmd('SPJS', { Id: refId, Status: 'Error', Comment: 'JSON Error' });

				}

			}

		}

		console.groupEnd();

	},
	makePortSafe(unsafePortName) {
		// The linux platform gives port names like 'dev/ttyAMA0' which messes up the object names and the dom operations.

		const portList = this.SPJS.portList;

		let safePortName = unsafePortName ? unsafePortName.replace(/^\//g, 'fs-').replace(/\//g, '-fs-') : unsafePortName;

		// If the port is not in the portList object, try to find a match.
		if (safePortName && !portList[safePortName]) {
			// console.log(`The safePortName: '${safePortName}' not found in the serial ports list.`);

			// Loop through each port in the portList object.
			for (let port in portList) {

				// If the ports match case-insensitive.
				if (port.toLowerCase() === safePortName.toLowerCase()) {
					safePortName = port;
					// console.log(`The safePortName: '${safePortName}' not found in the serial ports list.\nChanged safePortName to: '${safePortName}'.`);

					break;
				}

			}
		}

		return safePortName;
	},
	makePortUnSafe(safePortName) {
		// The linux platform gives port names like 'dev/ttyAMA0' which messes up the object names and the dom operations.

		let unsafePortName = safePortName ? safePortName.replace(/fs-|-fs-/g, '/') : safePortName;

		return unsafePortName;
	},

	newspjsSend: function ({ Msg, Id, IdPrefix, Type = 'Command', Status, Comment, Related, Meta = [] }) {
		console.log(`SPJS Send\n  Msg: ${Msg}`);

		// If the Meta argument is not an array, split it into an array.
		if (!Array.isArray(Meta)) {
			console.error(`The Meta argument is not an array. But i will fix it for you... because i am nice like that. Next time i may not be so nice, so you may wanna get that fixed.\n  Meta: ${Meta}\n  typeof: ${typeof Meta}`);
			Meta = Meta.split(' ');
		}

		// If the Msg argument is 'list' and the SPJS is already processing a 'list' command, exit this method.
		if (Msg === 'list') {
			const { matchIndex, matchTime } = this.consoleLog.findItem('SPJS', { Msg: 'list', IndexMap: this.consoleLog.SPJS.verifyMap });
			const deltaTime = matchTime && Date.now() - matchTime;
			// console.log(`matchTime: ${matchTime}\ndeltaTime: ${deltaTime}\nstaleCmdLimit: ${this.consoleLog.staleCmdLimit}`);

			if (matchTime && deltaTime > this.consoleLog.staleCmdLimit) {
				this.consoleLog.updateCmd('SPJS', { Index: matchIndex, Status: 'Error', Comment: 'Stale' });

			} else if (matchTime) {
				console.log("The SPJS is already processing a request for the portList.\nRequest for list terminated.");
				return false;

			}
		}

		// Add the command to the SPJS console log.
		const { cmdId } = this.consoleLog.appendMsg('SPJS', { Msg, Id, IdPrefix, Type, Status, Comment, Related, Meta});

		// Send the command to the SPJS. There may be an error following the send if the web socket has just closed.
		try {
			this.SPJS.ws.send(Msg);

		// Since there was an error sending the command, show the error in the log and return false.
		} catch (err) {
			console.log(`Could not send command to the SPJS.\nError: ${err}`);
			this.consoleLog.updateCmd('SPJS', { Id: cmdId, Status: 'Error', Comment: 'SPJS Closed' });

			return false;
		}

		// Return the command id to indicate that the command was sent successfully.
		return { cmdId };
	},
	newportSend: function (port, { Msg, IdPrefix, Type = 'Command', Status, Comment, Meta = [] }) {

		// If the Meta argument is not an array, split it into an array.
		if (!Array.isArray(Meta)) {
			console.error(`The Meta argument is not an array. But i will fix it for you... because i am nice like that. Next time i may not be so nice, so you may wanna get that fixed.\n  Meta: ${Meta}\n  typeof: ${typeof Meta}`);
			Meta = Meta.split(' ');
		}

		Meta.push('portSend');

		// Append the command to this port's log and use the returned id as the id for the SPJS log as well.
		// If the id argument was omitted, the appendMsg method will make one up.
		const { cmdId } = this.consoleLog.appendMsg(port, { Msg, IdPrefix, Type, Status, Comment, Meta });

		const unsafePort = this.makePortUnSafe(port);
		const cmd = `send ${unsafePort} ${Msg}`;

		// Send the message to the SPJS. If there is an error sending the command to the SPJS, the status of the message in the port's log will be automatically changed.
		if (!this.newspjsSend({ Msg: cmd, Id: cmdId, Status, Comment, Related: port, Meta })) {
			return false;
		}

		// Return true to indicate that the command was sent successfully.
		return cmdId;
	},
	newportSendNoBuf: function (port, { Msg, IdPrefix, Type = 'Command', Status, Comment, Meta = [] }) {
		// To reset tinyg board, send it a '\u0018\n' command.

		// If the Meta argument is not an array, split it into an array.
		if (!Array.isArray(Meta)) {
			console.error(`The Meta argument is not an array. But i will fix it for you... because i am nice like that. Next time i may not be so nice, so you may wanna get that fixed.\n  Meta: ${Meta}\n  typeof: ${typeof Meta}`);
			Meta = Meta.split(' ');
		}

		Meta.push('portSendNoBuf');

		// Append the command to this port's log and use the returned id as the id for the SPJS log as well.
		// If the id argument was omitted, the appendMsg method will make one up.
		const { cmdId } = this.consoleLog.appendMsg(port, { Msg, IdPrefix, Type, Status, Comment, Meta });

		const unsafePort = this.makePortUnSafe(port);
		const cmd = `sendnobuf ${unsafePort} ${Msg}`;

		let Related = {
			Port: port,
			Id: cmdId
		}

		// Send the message to the SPJS. If there is an error sending the command to the SPJS, the status of the message in the port's log will be automatically changed.
		if (!this.newspjsSend({ Msg: cmd, Id: cmdId, Status, Comment, Related, Meta })) {
			return false;
		}

		// Return true to indicate that the command was sent successfully.
		return true;
	},
	newportSendJson: function (port, { Data, Msg, Id, IdPrefix, Pause = 0, Type = 'Command', Status, Comment, Meta = [] }) {
		// This method sends JSON messages to specified ports on the SPJS.
		// Ex. portSendJson [port] [cmd] [id]
		// Ex. portSendJson [port] [ [cmd], [cmd1], ..., [cmdn] ] [id]
		// Ex. portSendJson [port] [ [[cmd],[id]], [[cmd1],[id1]], ..., [[cmdn],[idn]] ]
		// Sends message as: 'sendjson { "P":"[port]", "D": {[ "Data": "[cmd]", "Id": "[id]-0" ], [ "Data": "[cmdn]", "Id": "[id]-1" ]} }'
		// If the id ends in a number, the following id's will be increments of that number. Otherwise add '-0', '-1', '-2', ... '-n' to the end of each id (ie. 'init-0').
		// An Id must be passed to this method either in each Data array element or the Id argument.
		// Arg. Data [string] or [arrray[string]] [array[array[string/int]]] - If only sending one command, the id and pause values must be passed into their respective arguments and not in the form of [array[string/int]] as the parser will read that as an array of commands.
		// 	Ex. [ [msg0,(id0),(pause0)], [msg1,(id1),(pause1)], ..., [msgn,(idn),(pausen)] ]
		// Arg. Msg [string] - Can be used instead of Data for single line commands.
		// Arg. Id [string] - If there are multiple msgs and the id ends with a number, the number will be incremented automatically for each msg. Otherwise, a suffix (ie. '-0', '-1', '-2', ... '-n') will be added to the end of each id.

		console.groupCollapsed('newportSendJson');

		// If the Meta argument is not an array, split it into an array.
		if (!Array.isArray(Meta)) {
			console.error(`The Meta argument is not an array. But i will fix it for you... because i am nice like that. Next time i may not be so nice, so you may wanna get that fixed.\n  Meta: ${Meta}\n  typeof: ${typeof Meta}`);
			Meta = Meta.split(' ');
		}

		const portMeta = this.SPJS.portMeta;

		let cmdBuffer = [];
		let idBase;
		let idSuffix;

		// Msg argument can be used instead of Data argument to pass a single command.
		if (Data === undefined && Msg !== undefined) {
			Data = Msg;

		}

		// The data argument is [array[]], parse the data from it.
		if (Array.isArray(Data)) {

			if (Id) {

				idBase = Id.substring(0, Id.search(/\d+\b/));
				idSuffix = /\d+\b/.exec();

				if (!idSuffix) {
					idSuffix = '0';
				}

				console.log(`idBase: ${idBase}\nidSuffix: ${idSuffix}`);

			}

			for (let i = 0; i < Data.length; i++) {

				cmdBuffer.push({ Msg: Data[i], Id, IdPrefix, Pause, Status, Comment, Meta: i < Data.length - 1 ? ['portSendJson'].concat(`${ i + 1 }of${Data.length}`, Meta) : ['portSendJson'].concat(`${ i + 1 }of${Data.length}`, 'final', Meta) });
				let item = cmdBuffer[i];

 				// The Data argument is [array[object[string/int]]].
				// Eg. Data: [ { Msg:msg0, Id:id0 }, { Msg:msg1, Id:id1 }, ..., { Msg:msgn, Id:idn } ]
				// Eg. Data: [ { Msg:msg0, Id:id0, Pause:pause0 }, { Msg:msg1, Id:id1, Pause:pause1 }, ..., { Msg:msgn, Id:idn, Pause:pausen } ]
				if (typeof(Data[i]) === 'object') {

					console.log('Data argument is [array[object[string/int]]]');
					// Parse item msg.
					item.Msg = Data[i].Msg;

					// Parse item id.
					if (Data[i].Id) {
						item.Id = Data[i].Id;

					} else if (Id) {
						idItemSuffix = (Number(idSuffix) + i).toString();
						idDeltaLen = idSuffix.length - idItemSuffix.length;
						idItemZeros = idDeltaLen > 0 ? idDeltaLen : 0;

						item.Id = `${idBase}${'0'.repeat(idItemZeros)}${idItemSuffix}`;
						console.log(`i: ${i}\n  idItemSuffix: ${idItemSuffix}\n  idDataLen: ${idDataLen}\n  idItemZeros: ${idItemZeros}\n  id: ${item.Id}`);

					}

					item.Pause = Data[i].Pause !== undefined ? Data[i].Pause : Pause;
					item.Status = Data[i].Status !== undefined ? Data[i].Status : Status;
					item.Comment = Data[i].Comment !== undefined ? Data[i].Comment : Comment;
					// item.Related = Data[i].Related !== undefined ? Data[i].Related : Related;
					item.Meta = Data[i].Meta !== undefined ? Data[i].Meta : Meta;

				// The Data argument is [array[string]].
				// Eg. Data: [ msg0, msg1, ..., msgn ], Id: id0, Pause: pause0
				} else if (typeof Data[i] === 'string') {
					console.log('Data argument is [array[string/int]]');

					idItemSuffix = (Number(idSuffix) + i).toString();
					idDeltaLen = idSuffix.length - idItemSuffix.length;
					idItemZeros = idDeltaLen > 0 ? idDeltaLen : 0;

					item.Id = `${idBase}${'0'.repeat(idItemZeros)}${idItemSuffix}`;
					console.log(`i: ${i}\n  idItemSuffix: ${idItemSuffix}\n  idDeltaLen: ${idDeltaLen}\n  idItemZeros: ${idItemZeros}\n  id: ${item.Id}`);

				}
				// cmdBuffer[i].Meta.push('portSendJson', `${ i + 1 }of${Data.length}`);

			}

		// Data is a single command.
		// Eg. Data: msg, Id: id, ...etc.
		} else if (typeof Data === 'string') {

			console.log('Data argument is a string.');
			// console.error('Id argument was omitted.\n  Id:', Id);

			cmdBuffer.push({ Msg: Data, Id, IdPrefix, Pause, Status, Comment, Meta: ['portSendJson', '1of1'] });

			console.log('cmdBuffer:', cmdBuffer);

		} else {
			console.error('Did not receive a valid Data argument.\n  Data:', Data);

		}

		const unsafePort = this.makePortUnSafe(port);
		let cmd = `sendjson {"P":"${unsafePort}","Data":[`;
		let cmdIds = [];

		// Build the command string.
		for (let i = 0; i < cmdBuffer.length; i++) {

			let bufferItem = cmdBuffer[i];

			// Append the command to this port's log and use the returned id as the id for the SPJS log as well.
			// If the id argument was omitted, the appendMsg method will make one up based on the port and line number.
			const { cmdId } = this.consoleLog.appendMsg(port, { Msg: bufferItem.Msg , Id: bufferItem.Id, IdPrefix: bufferItem.IdPrefix, Type, Status: bufferItem.Status, Comment: bufferItem.Comment, Related: bufferItem.Related, Meta: bufferItem.Meta });
			cmdIds.push(cmdId);

			// Do not add a linefeed character to a reset or feedhold command.
			if (!(/\\n$/).test(bufferItem.Msg) && !(/[%!]/).test(bufferItem.Msg)) {
				// bufferItem.Msg += '\\n';
				bufferItem.Msg += portMeta[port].lineEnding;

			}

			cmd += i ? ',' : '';
			cmd += `{"D":"${bufferItem.Msg}","Id":"${cmdIds[i]}"${bufferItem.Pause ? `,"Pause":${bufferItem.Pause}` : ''}}`;

		}

		cmd += ']}';

		let spjsId = cmdBuffer.length > 1 ? cmdIds[cmdIds.length - 1] : cmdIds[0];

		// Send the message to the SPJS. If there is an error sending the command to the SPJS, the status of the message in the port's log will be automatically changed.
		if (!this.newspjsSend({ Msg: cmd, Id: spjsId, Status, Comment, Related: { Port: port, Id: cmdIds }, Meta: ['portSendJson'] })) {
			console.groupEnd();
			return false;
		}

		console.groupEnd();

		// Return true to indicate that the command was sent successfully.
		return spjsId;
	},
	sendBuffered: function ({ Data }) {
		// Receive message data the same way as the portSendJson method.
		// Add message data to the buffer object.

		// If the SPJS has fewer messages in the queue than the pauseOnQueueCount setting, send messages.


		// Approach #1:
		// If there are messages in the sendBuffer, set a periodic interval timer to check if messages can be sent.
		// 	-If messages can be sent, send the number of messages that can be sent to fill the queue.
		// If the sendBuffer is empty, cancel the periodic interval timer.

		// Approach #2: (the chilipeppr method)
		// If queueCount < pauseOnQueueCount and sending is not paused, send a fixed number of lines.
		// If queueCount > pauseOnQueueCount and sending is not paused, pause sending.
		// If queueCount < resumeOnQueueCount, resume sending and send a fixed number of lines.

	},
	// TODO: Parse port names to make sure that they are the correct case.
	mdiSend: function (port, { Msg }) {

		const that = this;
		const portList = this.SPJS.portList;

		// If there is space before the message, remove it.
		Msg = /^\s+\S/.test(Msg) ? Msg.replace(/^\s+/, '') : Msg;

		if (port === 'SPJS') {

			// Correct any character upper/lower case mistakes for port names. Nothing should break if port is not entered with correct cases but it is just allot better.
			// Ex. 'close com4' is changed to 'close COM4'.
			for (let portName in portList) {

				let unsafePortName = this.makePortUnSafe(portName);

				let refStr = new RegExp(unsafePortName, 'gi');
				// console.log('refStr:', refStr);

				Msg = Msg.replace(refStr, unsafePortName);

			}

			// If the message is related to a specific port, put the message in the port's log.
			// If the message is not a 'sendnobuf' command, check if it relates to a port so it can be added to the port's console log.
			// TODO: Make this work for sendjson messages as well.
			if (Msg.includes('sendnobuf')) {

				// Ex. Msg: 'sendnobuf COM5 helloworld'
				let [ msgOperation, msgPort, ...msg ] = Msg.split(' ');
				msg = msg.join(' ');

				console.log('msgOperation:', msgOperation, '\nmsgPort:', msgPort, '\nmsg:', msg, `\nmsg: '${msg}'`);

				const safeMsgPort = msgPort ? this.makePortSafe(msgPort) : undefined;

				// Send the message to the SPJS.
				const { cmdId } = this.newspjsSend({ Msg, IdPrefix: 'mdi', Type: 'MdiCommand', Related: safeMsgPort });

				// Add the command to the respective port's log with the same id as the message in the SPJS log.
				if (cmdId && msg && safeMsgPort && this.consoleLog.openLogs.includes(safeMsgPort)) {
					this.consoleLog.appendMsg(safeMsgPort, { Msg: msg, Id: cmdId, Type: 'MdiCommand', Meta: [ 'portSendNoBuf' ], Status: 'Sent' });

					console.log('Added message to related port.');

				// NOTE: The following are intended for debugging purposes only.
				} else {
					cmdId || console.log('!cmdId', cmdId);
					msg || console.log('!msg', msg);
					safeMsgPort || console.log('!safeMsgPort', safeMsgPort);
					this.consoleLog.openLogs.includes(safeMsgPort) || console.log('!this.consoleLog.openLogs.includes(safeMsgPort)', this.consoleLog.openLogs.includes(safeMsgPort));

				}

			// If the message is not a 'sendnobuf' command.
			} else {
				this.newspjsSend({ Msg, IdPrefix: 'mdi', Type: 'MdiCommand' });

			}

		// If a message contains only characters like '!' or '%', send to device without buffering.
		} else if (/\W/.test(Msg) && !/ |\w|\?/.test(Msg)) {
			this.newportSendNoBuf(port, { Msg, IdPrefix: 'mdi', Type: 'MdiCommand' });

		} else {
			this.newportSendJson(port, { Msg, IdPrefix: 'mdi', Type: 'MdiCommand' });

		}

	},

	// Deprecated Jan. 07, 2017:
	spjsSend: function (cmd, id, Related, Status, Comment, Meta) {
		console.log("SPJS Send:\n  " + cmd);

		// If the cmd argument is 'list' and the SPJS is already processing a 'list' command, exit this method.
		if (cmd === 'list') {
			const { matchIndex, matchTime } = this.consoleLog.findItem('SPJS', { Msg: 'list', IndexMap: this.consoleLog.SPJS.verifyMap });
			const deltaTime = matchTime && Date.now() - matchTime;
			// console.log(`matchTime: ${matchTime}\ndeltaTime: ${deltaTime}\nstaleCmdLimit: ${this.consoleLog.staleCmdLimit}`);

			if (matchTime && deltaTime > this.consoleLog.staleCmdLimit) {
				this.consoleLog.updateCmd('SPJS', { Index: matchIndex, Status: 'Error', Comment: 'Stale' });
			} else if (matchTime) {
				console.log("The SPJS is already processing a request for the portList.\nRequest for list terminated.");
				return false;
			}
		}

		const Type = (id === 'mdi') ? 'MdiCommand' : 'Command';
		const IdPrefix = (id === 'mdi') ? id : undefined;

		// Add the command to the SPJS console log.
		const { cmdId } = this.consoleLog.appendMsg('SPJS', { Msg: cmd, Id: id, IdPrefix, Type, Related, Comment, Meta});

		// Send the command to the SPJS. There may be an error following the send if the web socket has just closed.
		try {
			this.SPJS.ws.send(cmd);

		// Since there was an error sending the command, show the error in the log and return false.
		} catch (err) {
			console.log(`Could not send command to the SPJS.\nError: ${err}`);
			this.consoleLog.updateCmd('SPJS', { Id: cmdId, Status: 'Error', Comment: 'SPJS Closed' });

			return false;
		}

		// Return true to indicate that the command was sent successfully.
		return true;
	},
	portSend: function (port, msg) {
		// Append the command to this port's log and use the returned id as the id for the SPJS log as well.
		// If the id argument was omitted, the appendMsg method will make one up.
		const { cmdId } = this.consoleLog.appendMsg(port, { type: 'Command', message: msg });

		var cmd = "send " + port + " " + msg;

		// Send the message to the SPJS. If there is an error sending the command to the SPJS, the status of the message in the port's log will be automatically changed.
		if (!this.spjsSend(cmd, cmdId)) {
			return false;
		}

		// Return true to indicate that the command was sent successfully.
		return true;
	},
	portSendNoBuf: function (port, msg) {
		// To reset tinyg board, send it a '\u0018\n' command.

		// Append the command to this port's log and use the returned id as the id for the SPJS log as well.
		// If the id argument was omitted, the appendMsg method will make one up.
		const { cmdId } = this.consoleLog.appendMsg(port, { type: 'Command', message: msg });

		var cmd = "sendnobuf " + port + " " + msg;

		// Send the message to the SPJS. If there is an error sending the command to the SPJS, the status of the message in the port's log will be automatically changed.
		if (!this.spjsSend(cmd, cmdId)) {
			return false;
		}

		// Return true to indicate that the command was sent successfully.
		return true;
	},
	portSendJson: function (port, msg, id, pause) {
		// This method sends JSON messages to specified ports on the SPJS.
		// Ex. portSendJson [port] [cmd] [id]
		// Ex. portSendJson [port] [ [cmd], [cmd1], ..., [cmdn] ] [id]
		// Sends message as: 'sendjson { "P":"[port]", "D": {[ "Data": "[cmd]", "Id": "[id]-0" ], [ "Data": "[cmdn]", "Id": "[id]-1" ]} }'

		// Append the command to this port's log and use the returned id as the id for the SPJS log as well.
		// If the id argument was omitted, the appendMsg method will make one up.
		const Type = (id === 'mdi') ? 'MdiCommand':'Command';
		const { cmdId } = this.consoleLog.appendMsg(port, { Msg: msg, IdPrefix: id, Type });

		if (!(/\\n$/).test(msg) && !(/[%!]/).test(msg)) {
			msg += '\\n';
		}

		// If the pause argument was passed, include pause in the command.
		if (pause) {
			var cmd = `sendjson {"P":"${port}","Data":[{"D":"${msg}","Id":"${cmdId}","Pause":"${pause}"}]}`;

		// If the pause argument was omitted, do not include it in the command.
		} else {
			var cmd = `sendjson {"P":"${port}","Data":[{"D":"${msg}","Id":"${cmdId}"}]}`;
		}

		// Send the message to the SPJS. If there is an error sending the command to the SPJS, the status of the message in the port's log will be automatically changed.
		if (!this.spjsSend(cmd, cmdId, port)) {
			return false;
		}

		// Return true to indicate that the command was sent successfully.
		return true;
	},

	// Phased Out: Dec. 22, 2016
	// logCmdStatus: function (port, { Cmd, Id }, Status, remove) {
	//
	// 	return this.consoleLog.updateCmd(port, { Msg: Cmd, Id, Status });
	//
	// 	// This method updates the status of commands in the SPJS console log.
	// 	// Matches to command data can be partial and are not cose sensitive but matches to command id's have to be exact.
	// 	// Arg. port - Specifies the console log (eg. "SPJS" or "COM7").
	// 	// Arg. data - Either the command or the id of the command (eg. "list" or "appendCmd3").
	// 	// Arg. status - Specifies the new status to apply to a matched command (eg. "Written" or "Executed").
	//
	// 	// Check if command is in this port's verify buffer.
	// 	const {matchIndex, matchCmd, matchId, matchStatus, matchTime} = this.logCmdInBuffer(port, {Cmd, Id});
	//
	// 	let portLog = this.consoleLog[port];
	// 	const verifyStyle = this.consoleLog.verifyStyle;
	//
	// 	// FIXME: If the status is completed, only keep the data in the verifyBuffer if it is not a Gcode command with a line number.
	// 	let removeMatch = (remove || status == "Completed" || status == "Executed" || status == "Error") ? true:false;
	//
	// 	if (matchIndex !== undefined) {
	// 		console.groupCollapsed("Command status." + gui.parseObject(arguments, 2));
	// 		// console.log("removeMatch:", removeMatch, "\npartialMatch:", partialMatch);
	//
	// 		const bufferLength = portLog.verifyBuffer.length;
	// 		const bufferItem = portLog.verifyBuffer[matchIndex];
	//
	// 		console.log("Found verify match.");
	// 		console.log("verifyBuffer", gui.parseObject(portLog.verifyBuffer, 2));
	// 		console.log("bufferItem" + matchIndex + ": " + gui.parseObject(bufferItem, 2));
	//
	// 		// Update the style of the respective command's check-mark DOM element (ie. remove previous style and add new style).
	// 		$('#' + this.id + ' .console-log-panel .log-' + port + ' span.fa.' + bufferItem.Id).removeClass(verifyStyle[bufferItem.Status]).addClass(verifyStyle[status]);
	//
	// 		portLog.verifyBuffer[matchIndex].Status = status;
	//
	// 		console.log("Update status.");
	// 		console.log("bufferItem" + matchIndex + ": " + gui.parseObject(bufferItem, 2));
	//
	// 		// If removeMatch is true, remove the matched command from the verifyBuffer object.
	// 		if (removeMatch) {
	// 			let deltaTime = Date.now() - bufferItem.Time;
	// 			console.log("Time to " + status + ": " + deltaTime + "ms");
	//
	// 			// Remove the item from the verifyBuffer object.
	// 			portLog.verifyBuffer.splice(matchIndex, 1);
	//
	// 			// Double check that the item has been removed from the verifyBuffer object.
	// 			if (portLog.verifyBuffer.length + 1 == bufferLength) {
	// 				console.log("Command removed.");
	//
	// 			} else {
	// 				console.error("Command was not removed successfully");
	// 			}
	// 		}
	//
	// 		console.log("verifyBuffer", gui.parseObject(portLog.verifyBuffer, 2));
	//
	// 		console.groupEnd();
	//
	// 		// Exit this method and return the matched Id so that the caller knows if a match was found.
	// 		return bufferItem.Id;
	// 	}
	//
	// 	console.log(`No cmd match found in ${port} for: '${(Id) ? Id:Cmd}'`);
	//
	// 	// Return false so that the caller knows that no matching command was found.
	// 	return false;
	// },
	truncateLog: function (port) {
		// This method removes excess lines of the respective console log to prevent performance issues. This gets called once a console log reaches consoleLog.maxLineLimit and truncates the log to consoleLog.minLineLimit.
		// Arg. port - The console log to be truncated.

		// console.groupCollapsed("Truncate Log" + gui.parseObject(arguments, 2));
		const logPanel = $('#' + this.id + ' .console-log-panel .log-' + port);
		var portLog = this.consoleLog[port];

		var logHtml = logPanel.html();
		var logHtmlArray = logHtml.split("<br>").slice(this.consoleLog.minLineLimit * -1);
		logHtml = logHtmlArray.join("<br>");

		// console.log("msgCount: " + portLog.msgCount + "\nlogHtmlArray.length: " + logHtmlArray.length);

		$('#' + this.id + ' .console-log-panel .log-' + port).html(logHtml);

		portLog.lineCount = this.consoleLog.minLineLimit;

		// console.log("logHtmlArray:" + gui.parseObject(logHtmlArray, 2));
		// console.groupEnd();
	},
	// FIXME: Fix how input values are taken... cuz its shit atm.
	// FIXME: When the active log changes, scroll to the bottom of that log if it was previously scrolled to the bottom.
	// FIXME: Do not allow SPJS commands to be sent from the input field if not connected to a SPJS.
	consoleLogGetInputValue: function (logName) {
		// If the logName argument is omitted, the input value of the activeLog will be returned.
		if (!logName) logName = this.consoleLog.activeLog;

		var consoleLogItem = this.consoleLog[logName];

		if (consoleLogItem.historyRecallIndex !== null) {
			return consoleLogItem.history[consoleLogItem.historyRecallIndex];

		}

		return consoleLogItem.value;

	},
	consoleLogParseInput: function (data) {
		const consoleInputDom = `#${this.id} .console-log-panel .console-input input`;
		const port = this.consoleLog.activeLog;

		let inputData = $(consoleInputDom).val();

		console.log(`Parsing console log input: '${inputData}'`);

		this.mdiSend(port, { Msg: inputData });

		// if (port === 'SPJS') {
		// 	// publish('/' + this.id + '/spjs-send', data, id);
		// 	this.newspjsSend({ Msg: inputData, IdPrefix: 'mdi', Type: 'MdiCommand' });
		//  } else {
		// 	// publish('/' + this.id + '/port-sendjson', port, data, id);
		// 	this.newportSendJson(port, { Msg: inputData, IdPrefix: 'mdi', Type: 'MdiCommand' });
		//  }

		this.consoleLogInputStatus(null);
		// If the input field is hilited (aka. red because of bad input), remove that hilite.
		// if (this.consoleLog[port].inputStatus) {
		// }

		// If the input is not the same as the last input, save the input command to history.
		if (!this.consoleLog[port].history.length || this.consoleLog[port].history[0] != data) {
			this.consoleLog[port].history.unshift(data);
		}
		// console.log("consoleLog:" + gui.parseObject(this.consoleLog, 2));

		this.consoleLog[port].cmdCount++;
		$(consoleInputDom).val('');
	},
	consoleLogInputStatus: function (status) {
		var port = this.consoleLog.activeLog;
		var portLog = this.consoleLog[port];

		// If status has not changed, exit this method to avoid unnecessary DOM updates.
		if (portLog.inputStatus == status) return false;

		if (status == "error") {
			console.log("Console log input error.");

			var errorData = portLog.history.shift();
			console.log("errorData: " + errorData);

			portLog.value = errorData;
			portLog.historyRecallIndex = null;

			$('#' + this.id + ' .console-log-panel .console-input input').val(errorData);
			$('#' + this.id + ' .console-log-panel .console-input').addClass("has-error");

		} else if (status === null) {
			$('#' + this.id + ' .console-log-panel .console-input').removeClass("has-error");

		}

		portLog.inputStatus = status;
	},
	consoleLogChangeView: function (logName) {
		// console.log("Change visible console log: " + logName);
		var activeLog = this.consoleLog.activeLog;
		var consoleLogPanel = '#' + this.id + ' .console-log-panel .console-log-output.log-' + activeLog;

		// Set focus to the input field.
		$('#' + this.id + ' .console-log-panel .console-input input').focus();

		// If the log panel of the selected tab is already visible, skip DOM updates.
		if (this.consoleLog.activeLog == logName) return false;

		// Hide the console log output that is currently visible.
		$('#' + this.id + ' .console-log-panel .log-' + activeLog).addClass("hidden");

		// Make the selected console log panel visible.
		$('#' + this.id + ' .console-log-panel .log-' + logName).removeClass("hidden");

		// Make the <li> element of the selected tab 'active'.
		$('#' + this.id + ' .console-log-panel .nav-tabs > .list-tab-' + activeLog).removeClass("active");
		$('#' + this.id + ' .console-log-panel .nav-tabs > .list-tab-' + logName).addClass("active");

		if (this.consoleLog[logName].value != this.consoleLog[activeLog]) {
			$('#' + this.id + ' .console-log-panel .console-input input').val(this.consoleLogGetInputValue(logName));
		}
		if (this.consoleLog[logName].inputStatus != this.consoleLog[activeLog].inputStatus) {
			$('#' + this.id + ' .console-log-panel .console-input').removeClass(this.consoleLog[activeLog].inputStatus).addClass(this.consoleLog[logName].inputStatus);
		}

		// Change the placeholder of the <input> element.
		$('#' + this.id + ' .console-log-panel .console-input input').attr("placeholder", this.consoleLog[logName].placeholder);

		// Set the activeLog property to the logName argument.
		this.consoleLog.activeLog = logName;

		// Scroll to the bottom of the console log.
		$(consoleLogPanel).scrollTop($(consoleLogPanel).prop("scrollHeight"));
		// console.log(activeLog + gui.parseObject(this.consoleLog, 2));
	}
};	/* return */
});	/* define */
