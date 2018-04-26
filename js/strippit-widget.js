/**
 *   ____  _        _             _ _    __        ___     _            _         _                  ____            _       _
 *  / ___|| |_ _ __(_)_ __  _ __ (_) |_  \ \      / (_) __| | __ _  ___| |_      | | __ ___   ____ _/ ___|  ___ _ __(_)_ __ | |_
 *  \___ \| __| '__| | '_ \| '_ \| | __|  \ \ /\ / /| |/ _` |/ _` |/ _ \ __|  _  | |/ _` \ \ / / _` \___ \ / __| '__| | '_ \| __|
 *   ___) | |_| |  | | |_) | |_) | | |_    \ V  V / | | (_| | (_| |  __/ |_  | |_| | (_| |\ V / (_| |___) | (__| |  | | |_) | |_
 *  |____/ \__|_|  |_| .__/| .__/|_|\__|    \_/\_/  |_|\__,_|\__, |\___|\__|  \___/ \__,_| \_/ \__,_|____/ \___|_|  |_| .__/ \__|
 *                   |_|   |_|                               |___/                                                    |_|
 *
 *  @author Brayden Aimar
 */

/* globals Mousetrap:false */

define([ 'jquery' ], $ => ({

	id: 'strippit-widget',
	name: 'Strippit Punch Press',
	shortName: 'Strippit',
	btnTheme: 'default',
	icon: 'fa fa-home',
	desc: 'The user interface for controlling the Strippit punch press.',
	publish: {},
	subscribe: {},
	foreignPublish: {
		'/main/widget-loaded': ''
	},
	foreignSubscribe: {
		'/main/all-widgets-loaded': ''
	},

	// widgetDom: ['strippit-panel'],
	widgetDom: [],
	widgetVisible: false,

	port: '',
	portList: {},
	portMeta: {},
	portListDiffs: {},

	// Stores the current unit mode (eg. 'inch' or 'mm').
	unit: '',
	intomm: 25.4,
	mmtoin: 0.0393700787401575,

	/**
	 *  The minimum number of digits to be displayed after the decimal place of the dro limits.
	 *  @type {Number}
	 */
	droLimitMinDecDigits: 1,
	/**
	 *  The maximum number of digits to be displayed after the decimal place of the dro limits.
	 *  @type {Number}
	 */
	droLimitMaxDecDigits: 3,

	/**
	 *  Stores information about the current die size.
	 *  @type {String}
	 */
	dieSize: '',
	/**
	 *  Stores data about the machine limits for each die.
	 *  @type {Object}
	 */
	dieMetaData: {
		small: {
			x: [ 6.5, 102.5 ],
			y: [ 0.125, 28.125 ]
		},
		large: {
			x: [ 6.5, 102.5 ],
			y: [ 3, 28.125 ]
		}
	},

	/**
	 *  These are the physical hardware limits of the machine in inches [in].
	 *  Travel outside these position values will cause a crash.
	 *
	 *  @type {Object}
	 */
	machLimits: {
		x: [ 6.5, 102.5 ],
		y: [ 0.125, 28.125 ]
	},
	// Stores the latest machine position.
	machPosition: {
		x: 0,
		y: 0
	},

	initBody() {

		const { name, id, savePosition } = this;

		debug.group(`${this.name}.initBody()`);

		subscribe('/main/window-resize', this, this.resizeWidgetDom.bind(this));
		subscribe('/main/widget-visible', this, this.visibleWidget.bind(this));

		subscribe('/connection-widget/recvPortList', this, this.recvPortList.bind(this));
		subscribe('/connection-widget/recvPortData', this, this.recvPortData.bind(this));

		this.initButtons();
		this.initKeyboardShortcuts();
		publish('/main/widget-loaded', this.id);

		setTimeout(() => {  // Wait for the DOM to load before changing DOM elements

			const { platform, architecture, os } = hostMeta;

			if (platform !== 'linux' || architecture !== 'arm')
				$('#strippit-widget').addClass('not-punch-press-display');

			savePosition.initialize();
			this.updateDroLimits();

		}, 1000);

		return true;

	},
	initButtons() {

		$('#strippit-inmm').on('click', 'span.btn', () => {  // Initialize the inch/mm button

			const { port, unit } = this;

			// inch - G20
			// mm - G21
			// debug.log('Button -in/mm-');
			const Msg = (unit === 'inch') ? 'G21' : 'G20';

			if (port)  // If got a valid port
				publish('/connection-widget/port-sendjson', port, { Msg });  // Send a unit change message to the device

		});

		$('#strippit-feedstop').on('click', 'span.btn', () => {  // Initialize the Feedstop button

			const { port, savePosition } = this;
			const { maxRetargetAttempts } = savePosition;

			if (port) {  // If got a valid port

				publish('/connection-widget/port-feedstop', port);  // Send a feedhold message to the device
				savePosition.retargetCount = maxRetargetAttempts + 1;  // Prevent retargeting after feedstop button is pressed

				setTimeout(() => {

					publish('/connection-widget/port-sendjson', port, { Msg: [ 'M09', 'M09' ], IdPrefix: 'fstop', Comment: 'Feedstop', Pause: 200 });  // Drop solenoid finger

				}, 2500);

			}

		});

		$('#strippit-dro').on('click', 'span.btn', (evt) => {  // Initialize the DRO buttons

			const { btnSignal, btnData } = this.getButtonData(evt);
			this.setAxis(btnData);

		});

		$('#strippit-savepos').on('click', 'span.btn', (evt) => {  // Initialize the Save Position buttons

			const { port, savePosition } = this;
			const { btnSignal, btnData } = this.getButtonData(evt);

			if (btnSignal === 'control') {

				if (btnData === 'prev' && port) {

					savePosition.setPrevPos(port);

				} else if (btnData === 'next' && port) {

					savePosition.setNextPos(port);

				} else if (btnData === 'save') {

					savePosition.saveFunc('toggle');
					savePosition.deleteFunc('off');

				} else if (btnData === 'delete') {

					savePosition.saveFunc('off');
					savePosition.deleteFunc('toggle');

				} else if (btnData === 'clear') {

					savePosition.clearAll();

				}


			} else if (btnSignal === 'position') {  // If a position slot was selected

				const { machPosition, port, savePosition } = this;
				const { saveSelection, deleteSelection } = savePosition;

				if (saveSelection)
					savePosition.savePosition(Number(btnData), machPosition.x);

				else if (deleteSelection)
					savePosition.deletePos(Number(btnData));

				else if (port)
					savePosition.setPos(port, Number(btnData));

			}

		});

		$('.strippit-die-size').on('click', 'span.btn', (evt) => {  // Initialize the Calculator buttons

			const { dieSize, dieMetaData } = this;
			const { btnSignal, btnData } = this.getButtonData(evt);

			if (dieSize === '')  // If selecting the die size for the first time
				$('.overlay').hide();  // Hide the overlay to show the application

			if (typeof dieMetaData[btnData] == 'undefined')  // If the die size is not valid
				return false;

			[ this.machLimits.x, this.machLimits.y ] = [ dieMetaData[btnData].x, dieMetaData[btnData].y ];
			this.updateDroLimits();

			if (btnData === 'small') {

				$('.strippit-die-size .small-die').removeClass('btn-default').addClass('btn-active');
				$('.strippit-die-size .large-die').removeClass('btn-active').addClass('btn-default');

			} else if (btnData === 'large') {

				$('.strippit-die-size .small-die').removeClass('btn-active').addClass('btn-default');
				$('.strippit-die-size .large-die').removeClass('btn-default').addClass('btn-active');

			}

			this.dieSize = btnData;

		});

		$('#strippit-calc').on('click', 'span.btn', (evt) => {  // Initialize the Calculator buttons

			const { btnSignal, btnData } = this.getButtonData(evt);

			if (btnSignal === 'function')  // If a function button was pressed (eg. plus/minus, clear, backspace, add, etc.)
				this.calc.uiFunction(btnData);

			else if (btnSignal === 'number')
				this.calc.uiNumber(btnData);

		});

	},
	getButtonData(evt) {

		const $target = $(evt.currentTarget);
		const btnSignal = $target.attr('btn-signal');
		const btnData = $target.attr('btn-data');

		return { btnSignal, btnData };

	},
	initKeyboardShortcuts() {

		Mousetrap.bind('b', () => this.savePosition.setNextPos(this.port));  // Advance to next saved position on punch

		Mousetrap.bind([ '0', '1', '2', '3', '4', '5', '6', '7', '8', '9' ], this.keyboardShortcuts.bind(this));
		Mousetrap.bind([ 'backspace', 'del', '.' ], this.keyboardShortcuts.bind(this));

		Mousetrap.bind([ 'ctrl+alt+x', 'ctrl+alt+y' ], this.keyboardShortcuts.bind(this));

	},
	keyboardShortcuts(evt) {

		const { widgetVisible } = this;
		const { ctrlKey, altKey, shiftKey, key } = evt;

		if (!widgetVisible)  // If widget is not visible
			return false;

		let keys = `${ctrlKey ? 'ctrl' : ''}${ctrlKey && (altKey || shiftKey || key) ? '+' : ''}`;  // Build the keys string based on the keypress event
		keys += `${altKey ? 'alt' : ''}${altKey && (shiftKey || key) ? '+' : ''}`;
		keys += `${shiftKey ? 'shift' : ''}${shiftKey && key ? '+' : ''}`;
		keys += `${key}`;

		if (/[0-9]/.test(keys))               // Calculator digit
			this.calc.uiNumber(keys);

		else if (keys === 'Backspace')        // Backspace
			this.calc.uiFunction('backspace');

		else if (keys === 'Delete')           // Clear value
			this.calc.uiFunction('clear');

		else if (keys === '.')                // Decimal place
			this.calc.uiFunction('decimal');

		else if (/ctrl\+alt\+[xy]/.test(keys))  // Set x or y axis
			this.setAxis(keys[keys.length - 1]);

	},
	resizeWidgetDom() {

		/* eslint-disable prefer-const */

		if (!this.widgetVisible)  // If this widget is not visible
			return false;

		const that = this;

		let containerHeight = $(`#${this.id}`).height();
		let marginSpacing = 0;
		let panelSpacing = 0;

		for (let i = 0; i < this.widgetDom.length; i++) {

			let panel = that.widgetDom[i];
			let panelDom = $(`#${that.id} .${panel}`);

			marginSpacing += Number(panelDom.css('margin-top').replace(/px/g, ''));

			if (i === that.widgetDom.length - 1) {

				marginSpacing += Number(panelDom.css('margin-bottom').replace(/px/g, ''));

				let panelHeight = containerHeight - (marginSpacing + panelSpacing);
				panelDom.css({ height: `${panelHeight}px` });

			} else {

				panelSpacing += Number(panelDom.css('height').replace(/px/g, ''));

			}

		}

		/* eslint-enable prefer-const */

	},
	visibleWidget(wgtVisible, wgtHidden) {

		const { id } = this;

		if (wgtVisible === id) {

			this.widgetVisible = true;
			this.resizeWidgetDom();

		} else if (wgtHidden === id) {

			this.widgetVisible = false;

		}

	},

	recvPortList({ PortList, PortMeta, Diffs }) {

		// debug.log('Got serial port list, portMeta, and diffs.');

		this.portList = PortList;
		this.portMeta = PortMeta;
		this.portListDiffs = Diffs;

		if (Diffs.closed && Diffs.closed.includes(this.port)) {  // If the port was removed/disconnected

			this.port = '';
			this.dro.updateDOM(0, 0);

			this.savePosition.targetPosition.x = null;
			this.savePosition.targetPosition.y = null;

		}

	},
	recvPortData(port, { Msg, Data }) {  // The recvPortData method receives port data from devices on the SPJS

		const { machPosition, dro, savePosition } = this;
		let updateDRO = false;
		let updateUnit = false;
		let velocity = null;
		let status = null;

		if (Data && (Data.sr || Data.r)) {

			savePosition.xMotionFlag = false;
			savePosition.yMotionFlag = false;

		}

		if (Data && Data.sr && typeof Data.sr.posz !== 'undefined' && Data.sr.posz !== machPosition.x) {  // If the data includes position info

			updateDRO = true;
			this.machPosition.x = Data.sr.posz;  // Update the stored position in the widget

			if (Data.sr.vel !== 0)
				savePosition.xMotionFlag = true;

		} else if (Data && Data.r && Data.r.sr && typeof Data.r.sr.posz !== 'undefined' && Data.r.sr.posz !== machPosition.x) {  // Response from a status report request

			updateDRO = true;
			this.machPosition.x = Data.r.sr.posz;  // Update the stored position in the widget

			if (Data.r.sr.vel !== 0)
				savePosition.xMotionFlag = true;

		}

		if (Data && Data.sr && typeof Data.sr.posy !== 'undefined' && Data.sr.posy !== machPosition.y) {  // If the data includes position info

			updateDRO = true;
			this.machPosition.y = Data.sr.posy;  // Update the stored position in the widget

			if (Data.sr.vel !== 0)
				savePosition.yMotionFlag = true;

		} else if (Data && Data.r && Data.r.sr && typeof Data.r.sr.posy !== 'undefined' && Data.r.sr.posy !== machPosition.y) {  // Response from a status report request

			updateDRO = true;
			this.machPosition.y = Data.r.sr.posy; // Update the stored position in the widget

			if (Data.r.sr.vel !== 0)
				savePosition.yMotionFlag = true;

		}

		if (Data && Data.sr && typeof Data.sr.unit !== 'undefined') {  // Got units information

			const { unit: unitData } = Data.sr;

			if (unitData === 0 && this.unit !== 'inch') {       // Inches [in]

				updateUnit = true;
				this.unit = 'inch';

			} else if (unitData === 1 && this.unit !== 'mm') {  // Millimeters [mm]

				updateUnit = true;
				this.unit = 'mm';

			}

		} else if (Data && Data.r && Data.r.sr && typeof Data.r.sr.unit !== 'undefined') {  // Got units information from a status report

			if (Data.r.sr.unit === 0 && this.unit !== 'inch') {       // Inches [in]

				updateUnit = true;
				this.unit = 'inch';

			} else if (Data.r.sr.unit === 1 && this.unit !== 'mm') {  // Millimeters [mm]

				updateUnit = true;
				this.unit = 'mm';

			}

		}

		if (Data && Data.sr && typeof Data.sr.vel != 'undefined')
			velocity = Data.sr.vel;

		else if (Data && Data.r && Data.r.sr && typeof Data.r.sr.vel != 'undefined')
			velocity = Data.r.sr.vel;

		if (Data && Data.sr && typeof Data.sr.stat != 'undefined')
			status = Data.sr.stat;

		else if (Data && Data.r && Data.r.sr && typeof Data.r.sr.stat != 'undefined')
			status = Data.r.sr.stat;

		if (velocity === 0 && status === 3) {  // If the machine has stopped and not processing any other lines of Gcode

			const { port, machPosition } = this;
			const { targetPosition, targetTolerance, retargetCount, maxRetargetAttempts } = savePosition;

			if (retargetCount >= maxRetargetAttempts)  // If a retarget has already been attempted the maximum number of times
				return false;

			if (targetPosition.x !== null && Math.abs(machPosition.x - targetPosition.x) > targetTolerance) {  // If x-axis is not on target

				savePosition.sendAxisCommand(port, { Axis: 'x', Value: targetPosition.x, Comment: 'Retarget' });
				this.retargetCount += 1;

			}

			if (targetPosition.y !== null && Math.abs(machPosition.y - targetPosition.y) > targetTolerance) {  // If y-axis is not on target

				savePosition.sendAxisCommand(port, { Axis: 'y', Value: targetPosition.y, Comment: 'Retarget' });
				this.retargetCount += 1;

			}

		}

		if (updateDRO) {  // If a position update was received

			this.port = port;
			dro.updateDOM(this.machPosition.x, this.machPosition.y);  // Update the DRO based on the new data

		}

		// const { xMotionFlag, yMotionFlag } = savePosition;
		// $('#strippit-dro .x-axis .dro-pos-well').removeClass(xMotionFlag ? '' : 'bg-success').addClass(xMotionFlag ? 'bg-success' : '');
		// $('#strippit-dro .y-axis .dro-pos-well').removeClass(yMotionFlag ? '' : 'bg-success').addClass(yMotionFlag ? 'bg-success' : '');

		if (updateUnit) {  // If a unit update was received

			const { unit, intomm, mmtoin, dro, machLimits, savePosition } = this;
			const { writeToSaveFile, maxPositions, posData, unit: savePosUnit } = savePosition;
			const convFactor = (unit === 'mm') ? intomm : mmtoin;

			if (unit !== savePosUnit) {

				savePosition.unit = unit;

				for (let i = 0; i < maxPositions; i++) {  // Perform a unit conversion on each position slot

					if (posData[i] === null)  // If this position slot is empty
						continue;

					savePosition.posData[i] = posData[i] * convFactor;

				}

			}

			if (writeToSaveFile)
				savePosition.updatePositionsToFile();

			this.updateDroLimits();

			$('#strippit-dro .x-axis .dro-pos-well .dro-dim').text(unit);  // Update the unit label in the DRO
			$('#strippit-dro .y-axis .dro-pos-well .dro-dim').text(unit);

			$('#strippit-calc .calc-display-well .dro-dim').text(unit);  // Update the unit label in the calculator readout

		}

	},

	dro: {

		// Stores the position values from the last update (used to prevent redundant DOM updates).
		x: 0,
		y: 0,

		$xPos: $('#strippit-dro .x-axis .dro-pos-well'),
		$xLimitLabel: $('#strippit-dro .x-axis .dro-pos-well .axis-limits-label'),
		$yPos: $('#strippit-dro .y-axis .dro-pos-well'),
		$yLimitLabel: $('#strippit-dro .y-axis .dro-pos-well .axis-limits-label'),

		// Stores JQuery DOM references to make updating the DRO more efficient.
		$xValDOM: $('#strippit-dro > div.x-axis > div.dro-pos-well > h2.dro-pos table tr'),
		$yValDOM: $('#strippit-dro > div.y-axis > div.dro-pos-well > h2.dro-pos table tr'),

		// Specifies how many digits should be shown before the decimal place by default.
		intgrayDigits: 3,

		// Updates the DRO values in the DOM.
		updateDOM(x, y) {

			if (x === this.x && y === this.y) {

				// debug.log('Redundant DRO update.');
				return false;

			}

			// debug.log('Updating DRO DOM values.');

			const { intgrayDigits } = this;

			const xStr = x.toFixed(3).toString();
			const yStr = y.toFixed(3).toString();
			const [ xInt, xDec ] = xStr.split('.');
			const [ yInt, yDec ] = yStr.split('.');

			// Parse the position value into format for DRO.
			const xNegpos = x >= 0 ? ' xyz-dimmed' : '';
			const xIntblack = xInt.includes('-') ? xInt.substring(1) : xInt;
			const xDecimal = xDec;
			const xIntgray = xIntblack.length < intgrayDigits ? '0'.repeat(intgrayDigits - xIntblack.length) : '';

			const yNegpos = y >= 0 ? ' xyz-dimmed' : '';
			const yIntblack = yInt.includes('-') ? yInt.substring(1) : yInt;
			const yDecimal = yDec;
			const yIntgray = yIntblack.length < intgrayDigits ? '0'.repeat(intgrayDigits - yIntblack.length) : '';

			// debug.log(`${xNegpos ? '' : '-'} ${xIntgray} ${xIntblack} . ${xDecimal}`);
			// debug.log(`${yNegpos ? '' : '-'} ${yIntgray} ${yIntblack} . ${yDecimal}`);

			// Build the HTML for the DRO values.
			let xValHTML = '<td style="width:70px; text-align:right">';
			xValHTML += `<span class="xyz-negpos${xNegpos}" >-</span>`; // negpos
			xValHTML += `<span class="xyz-intgray xyz-dimmed">${xIntgray}</span>`; // intgray
			xValHTML += `<span class="xyz-intblack">${xIntblack}</span></td>`; // intblack
			xValHTML += `<td>.<span class="xyz-decimal">${xDecimal}</span></td>`; // decimal

			let yValHTML = '<td style="width:70px; text-align:right">';
			yValHTML += `<span class="xyz-negpos${yNegpos}" >-</span>`; // negpos
			yValHTML += `<span class="xyz-intgray xyz-dimmed">${yIntgray}</span>`; // intgray
			yValHTML += `<span class="xyz-intblack">${yIntblack}</span></td>`; // intblack
			yValHTML += `<td>.<span class="xyz-decimal">${yDecimal}</span></td>`; // decimal

			this.$xValDOM.html(xValHTML);
			this.$yValDOM.html(yValHTML);

			this.x = x;
			this.y = y;

			return true;

		}

	},
	updateDroLimits() {

		const { dro, machLimits, unit, intomm, droLimitMinDecDigits: minDigits, droLimitMaxDecDigits: maxDigits } = this;
		const keys = Object.keys(machLimits);
		let limits = {};

		for (let i = 0; i < keys.length; i++) {

			const keyItem = keys[i];
			const limitItem = machLimits[keyItem];
			limits[keyItem] = [ ...limitItem ];

			for (let j = 0; j < limitItem.length; j++) {

				if (unit === 'mm')  // If units are in Millimeters [mm]
					limits[keyItem][j] = limitItem[j] * intomm;

				limits[keyItem][j] = Math.roundTo(limits[keyItem][j], maxDigits);

				if (!limits[keyItem][j].toString().includes('.') && minDigits > 0)  // If the number has no decimal place
					limits[keyItem][j] = `${limits[keyItem][j]}.${'0'.repeat(minDigits)}`;

			}

		}

		dro.$xLimitLabel.find('.min-limit-label').text(limits.x[0]);  // X Axis DRO limits
		dro.$xLimitLabel.find('.max-limit-label').text(limits.x[1]);
		dro.$yLimitLabel.find('.min-limit-label').text(limits.y[0]);  // Y Axis DRO limits
		dro.$yLimitLabel.find('.max-limit-label').text(limits.y[1]);

	},
	calc: {

		/**
		 *  Value displayed by the calculator readout.
		 *  @type {String}
		 */
		value: '',
		/**
		 *  JQuery DOM references to make updating the DRO more efficient.
		 *  @type {JQuery Reference}
		 */
		valDOM: $('#strippit-calc > div.calc-display-well > h2.calc-value table tr'),
		/**
		 *  Specifies how many digits should be shown before the decimal place by default.
		 *  @type {Number}
		 */
		intgrayDigits: 3,
		/**
		*  Specifies how many digits should be shown before the decimal place by default.
		*  @type {Number}
		*/
		decgrayDigits: 3,

		valToInt() {  // The valToInt method converts the calculator value stored as a string into an integer

		},

		uiFunction(data) {

			const { value } = this;

			if (data === 'plusminus')  // If the plus/minus button was pressed
				this.updateDOM(value.includes('-') ? value.substring(1) : `-${value}`);  // Toggle the calculator value between positive and negitive

			else if (data === 'clear')  // If the clear button was pressed
				this.updateDOM('');  // Clear the calculator value

			else if (data === 'backspace')  // If the backspace button was pressed
				this.updateDOM(value.substr(0, value.length - 1));  // Remove the last character from the calculator value

			else if (data === 'decimal' && !value.includes('.'))  // If the decimal button was pressed and the value does not already include a decimal point
				this.updateDOM(`${value}.`);  // Add a decimal point to the calculator value

		},
		uiNumber(data) {

			const { value } = this;

			if (data === '0' && (value === '0' || value === '-0'))  // If there is already a leading zero, do not add another leading zero (Note: A leading zero is required to set axes to the zero position)
				return false;

			if (data === '.' && (value === '' || value === '-'))  // If adding a decimal point to an empty value
				return this.updateDOM(`${value}0.`);  // Add a leading zero before decimal point

			if (!isNaN(Number(data)) && Number(data) > 0 && Number(data) <= 9 && (value === '0' || value === '-0'))  // If adding a number (1-9) and there is a leading zero
				return this.updateDOM(`${value.substr(0, value.length - 1)}${data}`);  // Remove the leading zero then add the number (1-9)

			return this.updateDOM(`${value}${data}`);

		},
		updateDOM(val) {

			if (val === this.value)  // If this is a redundant DOM update
				return false;

			if (val === '100954771') {  // Passcode for opening dev tools

				ipc.send('open-dev-tools');
				val = '';

			}

			if (val === '100954774') {  // Passcode for restarting the SPJS

				publish('/connection-widget/spjs-send', { Msg: 'restart', Comment: 'Back Door Command' });
				val = '';

			}

			if (val === '100954775')  // Passcode for reloading the page
				location.reload();

			const [ valInt, valDec ] = val.split('.');
			const { intgrayDigits, decgrayDigits } = this;

			// Parse the position value into format for DRO.
			const Negpos = val.includes('-') ? '' : ' xyz-dimmed';
			const Intblack = valInt.includes('-') ? valInt.substring(1) : valInt;
			const Intgray = Intblack.length < intgrayDigits ? '0'.repeat(intgrayDigits - Intblack.length) : '';
			const dpDimmed = val.includes('.') ? '' : ' xyz-dimmed';
			const Decimal = valDec || '';
			// const Decimal = valSplit[1] ? valSplit[1] : '';
			const decimalIntgray = Decimal.length < decgrayDigits ? '0'.repeat(decgrayDigits - Decimal.length) : '';

			// // debug.log(`${ Negpos ? '' : '-' } ${Intgray} ${Intblack} ${ dpDimmed ? '' : '.' } ${Decimal} ${decimalIntgray}`);

			// Build the HTML for the DRO values.
			let valHTML = '<td style="width:70px; text-align:right">';
			valHTML += `<span class="xyz-negpos${Negpos}" >-</span>`; 	// negpos
			valHTML += `<span class="xyz-intgray xyz-dimmed">${Intgray}</span>`; // intgray
			valHTML += `<span class="xyz-intblack">${Intblack}</span></td>`; // intblack
			valHTML += `<td><span class="${dpDimmed}">.</span>`; // decimal point
			valHTML += `<span class="xyz-decimal">${Decimal}</span>`; // decimal
			valHTML += `<span class="xyz-decimal xyz-dimmed">${decimalIntgray}</span></td>`; // decimal intgray

			this.valDOM.html(valHTML);  // Push the new HTML to the DOM.
			this.value = val;

			return true;

		}
	},
	flashLimitWarning(axis) {

		// The number of times to flash the warning on and off.
		const flashTimes = 4;
		const delay = 250;
		const warningClass = 'bg-danger';
		const $limitLabel = this.dro[`$${axis}LimitLabel`];

		for (let i = 0; i < flashTimes; i++) {

			setTimeout(() => $limitLabel.addClass(warningClass), delay * 2 * i);
			setTimeout(() => $limitLabel.removeClass(warningClass), delay * ((2 * i) + 1));

		}

	},
	/**
	 *  @param {String} axis (eg. 'x' or 'y')
	 */
	setAxis(axis) {

		const { port, calc, savePosition, machLimits } = this;
		const { value } = calc;
		const { commandCount } = savePosition;
		let [ lowLimit, highLimit ] = machLimits[axis];

		if (this.unit === 'mm') {  // If the units mode is in millimeters [mm]

			lowLimit *= this.intomm;  // Convert the machine limits from inches [in] to millimeters [mm]
			highLimit *= this.intomm;

		}

		const valInt = Number(value);

		if (!port)  // if the port name is invaid
			return false;

		if (value === '' || value === '-')  // If the calculator value is empty
			return false;

		if (valInt < lowLimit || valInt > highLimit) {  // If the value exceeds machine limits

			this.flashLimitWarning(axis);  // Flash a limits warning in the DRO
			return false;

		}

		const Axis = axis.toLowerCase();
		const Value = (value.indexOf('.') === value.length - 1) ? value.substr(0, value.length - 1) : value;  // Remove trailing decimal place
		const Comment = 'SetAxis';
		savePosition.sendAxisCommand(port, { Axis, Value, Comment });

		calc.updateDOM('');  // Clear the value in the calculator so that the next value can be entered

		if (axis === 'x')  // If setting the x-axis
			savePosition.saveNextPos(Number(Value));  // Save the position to the next available position slot

		return true;

	},

	savePosition: {
		writeToSaveFile: false,
		/**
		 *  Stores current unit.
		 *  Eg. 'inch' or 'mm'
		 *  @type {String}
		 */
		unit: '',
		/**
		 *  The current active position as seen on the DOM buttons.
		 *  @type {Number}
		 */
		currentPos: null,
		/**
		 *  Maximum number of position slots shown to the user at any give time.
		 *  @type {Number}
		 */
		maxVisible: 28,
		/**
		 *  Maximum position available.
		 *  @type {Number}
		 */
		maxPositions: 99,
		/**
		 *  This flag is set when the save position button is pressed.
		 *  @type {Boolean}
		 */
		saveSelection: false,
		/**
		 *  This flag is set when the clear position button is pressed.
		 *  @type {Boolean}
		 */
		clearSelection: false,
		/**
		 *  Stores the x-axis position values for each save position slot.
		 *  Value of null signifies an empty position slot.
		 *  @type {Array}
		 */
		posData: [],
		/**
		 *  Stores a count of the number of commands have been sent to a device on the SPJS from this widget.
		 *  This is used to send line numers with GCode move commands.
		 *  @type {Number}
		 */
		commandCount: 0,
		/**
		 *  Stores the unix time of the last set position.
		 *  Used to ensure that the set next position is not cycled too fast.
		 *  @type {Number}
		 */
		setPosTime: 0,
		/**
		 *  Minimum interval between set positions in Milliseconds [ms].
		 *  Prevents a backup of commands to the controller resulting in 'haunted' motion.
		 *  @type {Number}
		 */
		minSetPosInterval: 650,
		/**
		 *  Number of decimal places to round saved position values to.
		 *  @type {Number}
		 */
		savedValueDecimalPlaces: 8,
		/**
		 *  Number of decimal places to round values to when send command to device.
		 *  @type {Number}
		 */
		sendValueDecimalPlaces: 4,
		/**
		 *  Delay between sending feedstop command and machine axis position commands in Milliseconds [ms].
		 *  @type {Number}
		 */
		sendAfterFeedstopDelay: 150,
		savePosFileName: 'config/Saved_Positions.cson',
		xMotionFlag: false,
		yMotionFlag: false,
		retargetCount: 0,
		targetPosition: {
			x: null,
			y: null
		},
		/**
		 *  Maximum number of times that a retarget can be attempted.
		 *  @type {Number}
		 */
		maxRetargetAttempts: 2,
		targetTolerance: 0.002,

		initialize() {

			const { maxVisible, maxPositions, savePosFileName, savedValueDecimalPlaces } = this;

			this.currentPos = null;
			this.posData = [];

			for (let i = 0; i < maxPositions; i++)
				this.posData.push(null);

			fsCSON.readFile(savePosFileName, (err, data) => {  // Read saved position data from previous session

				if (err) {  // If there was an error reading the file

					const fileData = {
						unit: this.unit,
						posData: this.posData
					}

					fsCSON.writeFileSafe(savePosFileName, fileData);
					this.buildPositionButtons();

					this.writeToSaveFile = true;

					return false;

				}

				const { unit, posData } = data;
				this.unit = unit;

				for (let i = 0; i < posData.length && i < maxPositions; i++) {

					if (posData[i] === null)
						this.posData[i] = posData[i];

					else
						this.posData[i] = Math.roundTo(posData[i], savedValueDecimalPlaces);

				}

				this.buildPositionButtons();
				this.writeToSaveFile = true;

			});

		},
		buildPositionButtons() {

			const { posData, maxVisible, maxPositions } = this;
			let HTML = '';

			for (let i = 0; i < maxPositions; i++) {  // Build HTML for each button

				const posNum = i + 1;
				const hiddenClass = i >= maxVisible ? ' hidden' : '';
				const filledClass = posData[i] === null ? '' : ' slot-filled';
				HTML += `<span btn-signal="position" btn-data="${posNum}" class="btn btn-xl btn-default pos-${posNum}${hiddenClass}${filledClass}">${posNum}</span>`

			}

			$('#strippit-savepos .position-btns').html(HTML);  // Add position buttons to DOM

		},
		setPrevPos(port) {

			const { currentPos, maxPositions, posData } = this;

			if (!port)  // If the port argument is invalid
				return debug.error('The port argument is invalid.');

			if (currentPos === null)  // If no position slot is active
				return false;

			for (let i = 0; i < maxPositions; i++) {

				const posItem = currentPos - ((i % maxPositions) + 1);
				// debug.log(`slot: ${posItem}`);

				if (posItem <= 0)  // If the position is invalid
					break;

				if (posData[posItem - 1] !== null)  // If this slot has saved position value
					return this.setPos(port, posItem);

			}

			for (let i = maxPositions; i > currentPos; i--) {

				if (posData[i - 1] !== null)  // If this slot has saved position value
					return this.setPos(port, i);

			}

			return true;

		},
		setNextPos(port) {

			const { currentPos, maxPositions, posData } = this;

			if (!port)  // If the port argument is invalid
				return debug.error('The port argument is invalid.');

			if (currentPos === null)  // If no position slot is active
				return false;

			for (let i = 1; i < maxPositions; i++) {

				const posItem = (((i + currentPos) - 1) % maxPositions) + 1;
				// debug.log(`slot: ${posItem}`);

				if (posData[posItem - 1] !== null)  // If this slot has no saved position
					return this.setPos(port, posItem);

			}

			return true;

		},
		setPos(port, pos) {

			const { setPosTime, minSetPosInterval, maxPositions, posData, commandCount, xMotionFlag, yMotionFlag, sendValueDecimalPlaces } = this;
			const currentTime = Date.now();

			if (currentTime - setPosTime < minSetPosInterval)  // If a position was just recently set
				return false;

			this.setPosTime = currentTime;

			if (!port)  // If the port argument is invalid
				return debug.error('The port argument is invalid.');

			if (typeof pos === 'undefined' || isNaN(pos) || pos <= 0 || pos > maxPositions)  // If the pos argument is invalid
				return debug.error('Attempted to set a saved position that is out of range.');

			this.saveFunc('off');
			this.deleteFunc('off');

			if (posData[pos - 1] === null)  // If no position data is saved to the requested slot
				return false;

			const Axis = 'x';
			const Value = posData[pos - 1];
			const Comment = 'SavePos';
			this.sendAxisCommand(port, { Axis, Value, Comment });

			this.updateBtnStatus(pos, 'active');  // Hilite the position button as active

			return true;

		},

		/**
		 *  Save a given value to the next available position slot following the active position slot.
		 *  @param {Number} value Value to be saved to the following position slot.
		 */
		saveNextPos(value) {

			const { currentPos, maxVisible, maxPositions, posData } = this;
			let referencePos = currentPos;

			if (currentPos === null)
				referencePos = 1;

			for (let i = 0; i < maxPositions; i++) {

				const posIndex = (i + (referencePos - 1)) % maxPositions;
				// debug.log(`slot: ${posIndex}`);

				if (posData[posIndex] === null)
					return this.savePosition(posIndex + 1, value);

			}

			return false;

		},
		/**
		 *  Save position data to a position slot.
		 *  @param {Number} pos   The position slot number as seen on the DOM button.
		 *  @param {Number} value The position value to be saved to the position slot.
		 */
		savePosition(pos, value) {

			const { maxPositions, currentPos } = this;

			this.saveFunc('off');
			this.deleteFunc('off');

			if (typeof pos === 'undefined' || isNaN(pos) || pos <= 0 || pos > maxPositions)  // If the pos argument is invalid
				return debug.error('Attempted to set a saved position that is out of range.');

			this.posData[pos - 1] = value;  // Save the value to the selected position
			this.updateBtnStatus(pos, 'active');  // Apply 'filled' and 'active' hiliting to the respective position slot

			this.updatePositionsToFile();

		},
		/**
		 *  Delete position slot data.
		 *  @param {Number} pos The position slot number as seen on the DOM button.
		 */
		deletePos(pos) {

			const { maxPositions, posData, currentPos } = this;

			this.saveFunc('off');
			this.deleteFunc('off');

			if (typeof pos === 'undefined' || isNaN(pos) || pos <= 0 || pos > maxPositions)  // If the pos argument is invalid
				debug.error('Attempted to delete a saved position that is out of range.');

			this.posData[pos - 1] = null;
			this.updateBtnStatus(pos, 'empty');  // Remove filled hiliting from the position slot

			this.updatePositionsToFile();

		},

		/**
		 *  Activates or deactivates the save position state.
		 *  @param {String} task (Eg. 'toggle' or 'on' or 'off')
		 */
		saveFunc(task) {

			const { saveSelection } = this;
			let flag = task;

			if (task !== 'toggle' && task !== 'on' && task !== 'off')
				return debug.error('Invalid task argument value.');

			else if ((task === 'on' && saveSelection) || (task === 'off' && !saveSelection))  // If this is a redundant update
				return;

			if (flag === 'toggle' && saveSelection)
				flag = 'off';

			else if (flag === 'toggle' && !saveSelection)
				flag = 'on';

			if (flag === 'on') {  // If turn on save selection flag

				this.saveSelection = true;
				$('#strippit-savepos .btn-saveto').addClass('btn-active');  // Add active hiliting from the save button

			} else {  // If turn off save selection flag

				this.saveSelection = false;
				$('#strippit-savepos .btn-saveto').removeClass('btn-active');  // Remove active hiliting from the save button

			}

			return this.saveSelection;

		},
		/**
		 *  Activates or deactivates the delete position state.
		 *  @param {String} task (Eg. 'toggle' or 'on' or 'off')
		 */
		deleteFunc(task) {

			const { deleteSelection } = this;
			let flag = task;

			if (task !== 'toggle' && task !== 'on' && task !== 'off')
				return debug.error('Invalid task argument value.');

			else if ((task === 'on' && deleteSelection) || (task === 'off' && !deleteSelection))  // If this is a redundant update
				return;

			if (flag === 'toggle' && deleteSelection)
				flag = 'off';

			else if (flag === 'toggle' && !deleteSelection)
				flag = 'on';

			if (flag === 'on') {  // If turn on delete selection flag

				this.deleteSelection = true;
				$('#strippit-savepos .btn-delete').addClass('btn-active');  // Add active hiliting from the delete button

			} else {  // If turn off delete selection flag

				this.deleteSelection = false;
				$('#strippit-savepos .btn-delete').removeClass('btn-active');  // Remove active hiliting from the delete button

			}

			return this.deleteSelection;

		},
		/**
		 *  Clear all saved position data.
		 */
		clearAll() {

			const { maxVisible, maxPositions } = this;

			for (let i = 0; i < maxPositions; i++)  // Delete the position data in each position slot
				this.deletePos(i + 1);

			this.saveFunc('off');
			this.deleteFunc('off');
			this.updatePositionsToFile();

		},
		/**
		 *  Applies and removes hiliting to save position buttons.
		 *  @param {Number} position The position slot number to update hiliting.
		 *  @param {String} task 	 (Eg. 'active' or 'inactive' or 'filled' or 'empty')
		 *                            'active' automatically implies 'filled'
		 *                            'empty' automatically implies 'inactive'
		 */
		updateBtnStatus(position, task) {

			const { maxVisible, maxPositions, posData, currentPos } = this;
			const $targetBtn = $(`#strippit-savepos .position-btns .pos-${position}`);
			const unlisted = position > maxVisible;

			if (task === 'active') {

				if (position !== currentPos && currentPos !== null)
					this.updateBtnStatus(currentPos, 'inactive');  // Remove hiliting from currently active position slot

				if (unlisted) {

					$(`#strippit-savepos .position-btns .pos-${maxVisible}`).addClass('hidden');
					$targetBtn.removeClass('hidden');

				}

				this.updateBtnStatus(position, 'filled');

				this.currentPos = position;
				$targetBtn.addClass('slot-active');  // Hilite the position slot as active

			} else if (task === 'inactive') {

				$targetBtn.removeClass('slot-active');  // Remove active hiliting
				this.currentPos = null;

				if (unlisted) {

					$targetBtn.addClass('hidden');
					$(`#strippit-savepos .position-btns .pos-${maxVisible}`).removeClass('hidden');

				}

			} else if (task === 'filled') {

				$targetBtn.addClass('slot-filled');  // Hilite the position slot as filled

			} else if (task === 'empty') {

				if (position === currentPos)  // If this position slot is active
					this.updateBtnStatus(position, 'inactive');  // Remove hiliting from the position slot

				$targetBtn.removeClass('slot-filled');  // Remove filled hiliting

			}

		},

		/**
		 *  @param {String} port     Device to send commands to.
		 *  @param {String} Axis     (eg. 'x' or 'y').
		 *  @param {Number} Value    Axis value for machine to move to.
		 *  @param {String} IdPrefix Id prefix in the console log.
		 *  @param {String} Comment  Command comment in console log.
		 */
		sendAxisCommand(port, { Axis, Value, IdPrefix, Comment }) {

			const { commandCount, xMotionFlag, yMotionFlag, targetPosition, sendValueDecimalPlaces, sendAfterFeedstopDelay } = this;

			const axis = Axis === 'x' ? 'Z' : 'Y';
			const value = Math.roundTo(Value, sendValueDecimalPlaces);
			const Data = [
				{ Msg: `N${commandCount}0 M08`, Pause: 50 },
				{ Msg: `N${commandCount}1 G0 ${axis}${value}`, Pause: 100 },
				{ Msg: `N${commandCount}2 M09`, Pause: 50 }
			];

			if (!yMotionFlag && Axis !== 'y' && value !== targetPosition[Axis.toLowerCase()]) {  // If the y-axis is not moving and this is not a y-axis command

				publish('/connection-widget/port-feedstop', port);
				setTimeout(() => { publish('/connection-widget/port-sendjson', port, { Data, IdPrefix, Comment }); }, sendAfterFeedstopDelay);  // Send move command to the device on the SPJS to move to the saved position (Note that the z-axis is used instead of the x-axis)

			} else {  // If the y-axis is in motion

				publish('/connection-widget/port-sendjson', port, { Data, IdPrefix, Comment });  // Send move command to the device on the SPJS to move to the saved position (Note that the z-axis is used instead of the x-axis)

			}

			this.targetPosition[Axis.toLowerCase()] = value;
			this.retargetCount = 0;
			this.commandCount += 1;  // Keep track of the number of commands that have been sent

		},

		updatePositionsToFile() {

			const { posData, unit, savePosFileName, savedValueDecimalPlaces } = this;

			fsCSON.updateFile(savePosFileName, (data) => {

				let roundedPosData = [];

				for (let i = 0; i < posData.length; i++)
					roundedPosData[i] = Math.roundTo(posData[i], savedValueDecimalPlaces);

				data.unit = unit;
				data.posData = roundedPosData;
				return data;

			});

		}

	}

})	/* arrow-function */
);	/* define */
