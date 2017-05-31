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
	 *  These are the physical hardware limits of the machine (inch).
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

		debug.group(`${this.name}.initBody()`);

		subscribe('/main/window-resize', this, this.resizeWidgetDom.bind(this));
		subscribe('/main/widget-visible', this, this.visibleWidget.bind(this));

		subscribe('/connection-widget/recvPortList', this, this.recvPortList.bind(this));
		subscribe('/connection-widget/recvPortData', this, this.recvPortData.bind(this));

		this.initButtons();
		this.initKeyboardShortcuts();

		const { posMax } = this.savepos;

		for (let i = 0; i < posMax; i++)  // Initialize the array for saving positions
			this.savepos.savedPos.push(null);

		publish('/main/widget-loaded', this.id);

		setTimeout(() => {  // Wait for the DOM to load before editing the min/max labels in the DOM

			this.dro.$xLimitLabel.find('.min-limit-label').text(this.machLimits.x[0]);
			this.dro.$xLimitLabel.find('.max-limit-label').text(this.machLimits.x[1]);
			this.dro.$yLimitLabel.find('.min-limit-label').text(this.machLimits.y[0]);
			this.dro.$yLimitLabel.find('.max-limit-label').text(this.machLimits.y[1]);

		}, 1000);

		return true;

	},
	initButtons() {

		$('#strippit-inmm').on('click', 'span.btn', () => {  // Initialize the inch/mm button

			debug.log('Button -in/mm-');

			// inch - G20
			// mm - G21
			const { port } = this;
			const Msg = (this.unit === 'inch') ? 'G21' : 'G20';

			if (port)  // If got a valid port
				publish('/connection-widget/port-sendjson', port, { Msg });  // Send a unit change message to the device

		});

		$('#strippit-feedstop').on('click', 'span.btn', () => {  // Initialize the Feedstop button

			debug.log('Button -Feedstop-');

			const { port } = this;

			if (port) {  // If got a valid port

				publish('/connection-widget/port-feedstop', port);  // Send a feedhold message to the device

				setTimeout(() => {

					publish('/connection-widget/port-sendjson', port, { Msg: [ 'M09', 'M09' ], IdPrefix: 'fstop', Pause: 200 });  // Drop solenoid finger

				}, 2500);

			}

		});

		$('#strippit-dro').on('click', 'span.btn', (evt) => {  // Initialize the DRO buttons

			const btnData = $(evt.currentTarget).attr('btn-data');

			this.setAxis(btnData);

		});

		$('#strippit-savepos').on('click', 'span.btn', (evt) => {  // Initialize the Save Position buttons

			const btnSignal = $(evt.currentTarget).attr('btn-signal');
			const btnData = $(evt.currentTarget).attr('btn-data');

			if (btnSignal === 'control') {

				if (btnData === 'prev') {

					this.savepos.setPrevPos(this.port);

				} else if (btnData === 'next') {

					this.savepos.setNextPos(this.port);

				} else if (btnData === 'save') {

					this.savepos.saveFunc('toggle');
					this.savepos.deleteFunc('off');

				} else if (btnData === 'delete') {

					this.savepos.saveFunc('off');
					this.savepos.deleteFunc('toggle');

				} else if (btnData === 'clear') {

					this.savepos.clearAll();

				}


			} else if (btnSignal === 'position') {  // If a position slot was selected

				const { machPosition } = this;
				const { saveSelection, deleteSelection } = this.savepos;

				if (saveSelection)
					this.savepos.savePos(Number(btnData), machPosition.x);

				else if (deleteSelection)
					this.savepos.deletePos(Number(btnData));

				else
					this.savepos.setPos(this.port, Number(btnData));

			}

		});

		// Initialize the Calculator buttons.
		$('#strippit-calc').on('click', 'span.btn', (evt) => {

			const btnSignal = $(evt.currentTarget).attr('btn-signal');
			const btnData = $(evt.currentTarget).attr('btn-data');

			// If a function button was pressed (eg. plus/minus, clear, backspace, add, etc.).
			if (btnSignal === 'function')
				this.calc.uiFunction(btnData);

			else if (btnSignal === 'number')
				this.calc.uiNumber(btnData);


		});

	},
	initKeyboardShortcuts() {

		Mousetrap.bind('v', () => this.savepos.setNextPos(this.port));  // Advance to next saved position on punch

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

		debug.log('Got serial port list, portMeta, and diffs.');

		this.portList = PortList;
		this.portMeta = PortMeta;
		this.portListDiffs = Diffs;

		if (Diffs.closed && Diffs.closed.includes(this.port)) {  // If the port was removed/disconnected

			this.port = '';
			this.dro.updateDOM(0, 0);

		}

	},
	recvPortData(port, { Msg, Data }) {

		// The recvPortData method receives port data from devices on the SPJS.

		debug.log(`Got data from '${port}':\nLine: ${Msg}\nData: ${Data}\nData:`, Data);

		let updateDRO = false;
		let updateUnit = false;

		if (Data && Data.sr && typeof Data.sr.posz !== 'undefined') {  // If the data includes position info

			debug.log('Got x-axis postion update.');

			updateDRO = true;
			this.machPosition.x = Data.sr.posz;  // Update the stored position in the widget

		} else if (Data && Data.r && Data.r.sr && typeof Data.r.sr.posz !== 'undefined') {  // Response from a status report request

			debug.log('Got x-axis postion update.');

			updateDRO = true;
			this.machPosition.x = Data.r.sr.posz;  // Update the stored position in the widget

		}

		if (Data && Data.sr && typeof Data.sr.posy !== 'undefined') {  // If the data includes position info

			debug.log('Got y-axis postion update.');

			updateDRO = true;
			this.machPosition.y = Data.sr.posy;  // Update the stored position in the widget

		} else if (Data && Data.r && Data.r.sr && typeof Data.r.sr.posy !== 'undefined') {  // Response from a status report request

			debug.log('Got y-axis postion update.');

			updateDRO = true;
			this.machPosition.y = Data.r.sr.posy; // Update the stored position in the widget

		}

		if (Data && Data.sr && typeof Data.sr.unit !== 'undefined') {  // Got units information

			const { unit: unitData } = Data.sr;

			debug.log('Got unit mode update.');

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

		if (updateDRO) {  // If a position update was received

			this.port = port;
			this.dro.updateDOM(this.machPosition.x, this.machPosition.y);  // Update the DRO based on the new data

		}

		if (updateUnit) {  // If a unit update was received

			const { unit, intomm, mmtoin } = this;
			const { posMax, savedPos } = this.savepos;
			const convFactor = (unit === 'mm') ? intomm : mmtoin;

			for (let i = 0; i < posMax; i++) {  // Perform a unit conversion on each position slot

				if (savedPos[i] === null)  // If this position slot is empty
					continue;

				this.savepos.savedPos[i] = savedPos[i] * convFactor;

			}

			if (this.unit === 'mm') {  // Units are millimeters [mm]

				this.dro.$xLimitLabel.find('.min-limit-label').text(this.machLimits.x[0] * convFactor);
				this.dro.$xLimitLabel.find('.max-limit-label').text(this.machLimits.x[1] * convFactor);
				this.dro.$yLimitLabel.find('.min-limit-label').text(this.machLimits.y[0] * convFactor);
				this.dro.$yLimitLabel.find('.max-limit-label').text(this.machLimits.y[1] * convFactor);

			} else {  // Units are inches [in]

				this.dro.$xLimitLabel.find('.min-limit-label').text(this.machLimits.x[0]);
				this.dro.$xLimitLabel.find('.max-limit-label').text(this.machLimits.x[1]);
				this.dro.$yLimitLabel.find('.min-limit-label').text(this.machLimits.y[0]);
				this.dro.$yLimitLabel.find('.max-limit-label').text(this.machLimits.y[1]);

			}

			$('#strippit-dro .x-axis .dro-pos-well .dro-dim').text(this.unit);  // Update the unit in the DRO
			$('#strippit-dro .y-axis .dro-pos-well .dro-dim').text(this.unit);

			$('#strippit-calc .calc-display-well .dro-dim').text(this.unit);  // Update the unit in the calculator readout

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

		// xDOM: {
		// 	negpos: $('#strippit-dro > div.x-axis h2.dro-pos span.xyz-negpos'),
		// 	intgray: $('#strippit-dro > div.x-axis h2.dro-pos span.xyz-intgray'),
		// 	intblack: $('#strippit-dro > div.x-axis h2.dro-pos span.xyz-intblack'),
		// 	intdecimal: $('#strippit-dro > div.x-axis h2.dro-pos span.xyz-intdecimal')
		// },
		// yDOM: {
		// 	negpos: $('#strippit-dro > div.y-axis h2.dro-pos span.xyz-negpos'),
		// 	intgray: $('#strippit-dro > div.y-axis h2.dro-pos span.xyz-intgray'),
		// 	intblack: $('#strippit-dro > div.y-axis h2.dro-pos span.xyz-intblack'),
		// 	intdecimal: $('#strippit-dro > div.y-axis h2.dro-pos span.xyz-intdecimal')
		// },

		// Specifies how many digits should be shown before the decimal place by default.
		intgrayDigits: 3,
		// Updates the DRO values in the DOM.
		updateDOM(x, y) {

			if (x === this.x && y === this.y) {

				debug.log('Redundant DRO update.');

				return false;

			}

			debug.log('Updating DRO DOM values.');

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

			debug.log(`${xNegpos ? '' : '-'} ${xIntgray} ${xIntblack} . ${xDecimal}`);
			debug.log(`${yNegpos ? '' : '-'} ${yIntgray} ${yIntblack} . ${yDecimal}`);

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

			// debug.log(`${ Negpos ? '' : '-' } ${Intgray} ${Intblack} ${ dpDimmed ? '' : '.' } ${Decimal} ${decimalIntgray}`);

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

	setAxis(axis) {

		const { port } = this;
		const { value } = this.calc;
		const { commandCount } = this.savepos;
		let [ lowLimit, highLimit ] = this.machLimits[axis];

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

		const position = (value.indexOf('.') === value.length - 1) ? value.substr(0, value.length - 1) : value;  // Remove trailing decimal place

		const Data = [
			{ Msg: 'M08', Pause: 150 },
			{ Msg: `N${commandCount} G0 ${axis === 'x' ? 'Z' : axis.toUpperCase()}${position}`, Pause: 100 },
			{ Msg: 'M09', Pause: 150 }
		];

		publish('/connection-widget/port-sendjson', port, { Data });

		this.savepos.commandCount += 1;  // Keep track of the number of commands that have been sent

		this.calc.updateDOM('');  // Clear the value in the calculator so that the next value can be entered

		if (axis === 'x')  // If setting the x-axis
			this.savepos.saveNextPos(Number(position));  // Save the position to the next available position slot

		return true;

	},

	savepos: {
		/**
		 *  The current active position.
		 *  @type {[type]}
		 */
		currentPos: null,
		/**
		 *  Number of available save positions.
		 *  @type {Number}
		 */
		posMax: 12,
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
		 *  Stores the position values for each save position slot.
		 *  @type {Array}
		 */
		savedPos: [],
		/**
		 *  Stores a count of the number of commands have been sent to a device on the SPJS from this widget.
		 *  This is used to send line numers with GCode move commands.
		 *  @type {number}
		 */
		commandCount: 1,

		setPrevPos(port) {

			if (this.currentPos === null)  // If no position slot is active
				return false;

			for (let i = 0; i < this.posMax; i++) {

				const posItem = this.currentPos - ((i % this.posMax) + 1);

				debug.log(`slot: ${posItem}`);

				if (posItem <= 0)  // If the position is invalid
					return false;

				if (this.savedPos[posItem - 1] !== null)  // If this slot has no saved position
					return this.setPos(port, posItem);

			}

			return true;

		},
		setNextPos(port) {

			if (this.currentPos === null)  // If no position slot is active
				return false;

			for (let i = 1; i < this.posMax; i++) {

				const posItem = (((i + this.currentPos) - 1) % this.posMax) + 1;

				debug.log(`slot: ${posItem}`);

				if (this.savedPos[posItem - 1] !== null)  // If this slot has no saved position
					return this.setPos(port, posItem);

			}

			return true;

		},
		setPos(port, pos) {

			if (typeof pos === 'undefined' || isNaN(pos) || pos <= 0 || pos > this.posMax)  // If the pos argument is invalid
				return debug.error('Attempted to set a saved position that is out of range.');

			this.saveFunc('off');
			this.deleteFunc('off');

			if (this.savedPos[pos - 1] === null)  // If no position data is saved to the requested slot
				return false;

			const Data = [
				{ Msg: 'M08', Pause: 150 },
				{ Msg: `N${this.commandCount} G0 Z${this.savedPos[pos - 1]}`, Pause: 100 },
				{ Msg: 'M09', Pause: 150 }
			];

			publish('/connection-widget/port-sendjson', port, { Data });  // Send move command to the device on the SPJS to move to the saved position (Note that the z-axis is used instead of the x-axis)

			this.commandCount += 1;  // Keep track of the number of commands that have been sent

			if (this.currentPos !== null)  // If another position slot is active.
				$(`#strippit-savepos span.pos-${this.currentPos}`).removeClass('slot-active');  // Deactivate the currently active position slot

			this.currentPos = pos;  // Make this position slot active

			$(`#strippit-savepos span.pos-${pos}`).addClass('slot-active');  // Apply 'active' hiliting to the respective position slot

			return true;

		},

		saveNextPos(value) {  // Save the given value to the next available position slot (with reference to currently selected position)

			let refPos = this.currentPos;

			if (this.currentPos === null)
				refPos = 1;

			for (let i = 0; i < this.posMax; i++) {

				const posItem = (i + refPos) % this.posMax;

				debug.log(`slot: ${posItem}`);

				if (this.savedPos[posItem - 1] === null)
					return this.savePos(posItem, value);

			}

			return false;

		},
		/**
		 *  Save position data to a position slot.
		 *  @param  {Number} pos   The position slot number as seen on the DOM button.
		 *  @param  {Number} value The position value to be saved to the position slot.
		 */
		savePos(pos, value) {

			if (typeof pos === 'undefined' || isNaN(pos) || pos <= 0 || pos > this.posMax)  // If the pos argument is invalid
				return debug.error('Attempted to set a saved position that is out of range.');

			this.saveFunc('off');
			this.deleteFunc('off');

			this.savedPos[pos - 1] = value;  // Save the value to the selected position

			if (this.currentPos !== null)  // If another position slot is active
				$(`#strippit-savepos span.pos-${this.currentPos}`).removeClass('slot-active');  // Deactivate the currently active position slot

			this.currentPos = pos;  // Make this position slot active

			$(`#strippit-savepos span.pos-${pos}`).addClass('slot-filled');  // Apply 'filled' and 'active' hiliting to the respective position slot
			$(`#strippit-savepos span.pos-${pos}`).addClass('slot-active');

			debug.table(this.savedPos);

		},
		deletePos(pos) {  // Delete the position data for the given position slot

			if (typeof pos === 'undefined' || isNaN(pos) || pos <= 0 || pos > this.posMax)  // If the pos argument is invalid
				debug.error('Attempted to delete a saved position that is out of range.');

			this.saveFunc('off');
			this.deleteFunc('off');

			if (this.savedPos[pos - 1] === null)  // If this is a redundant update
				return false;

			this.savedPos[pos - 1] = null;

			$(`#strippit-savepos span.pos-${pos}`).removeClass('slot-filled'); // Remove filled hiliting from the respective position slot

			if (pos === this.currentPos) {  // If removing the currently selected position slot

				this.currentPos = null;
				$(`#strippit-savepos span.pos-${pos}`).removeClass('slot-active');

			}

			debug.table(this.savedPos);

			return true;

		},

		saveFunc(data) {

			// Arg. (eg. 'toggle' or 'on' or 'off').

			const { saveSelection } = this;
			let flag = data;

			if (data !== 'toggle' && data !== 'on' && data !== 'off')
				return debug.error('Invalid data argument value.');

			else if ((data === 'on' && saveSelection) || (data === 'off' && !saveSelection))  // If this is a redundant update
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
		deleteFunc(data) {

			// Arg. (eg. 'toggle' or 'on' or 'off').

			const { deleteSelection } = this;
			let flag = data;

			if (data !== 'toggle' && data !== 'on' && data !== 'off')
				return debug.error('Invalid data argument value.');

			else if ((data === 'on' && deleteSelection) || (data === 'off' && !deleteSelection))  // If this is a redundant update
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

		clearAll() {  // Clear all the saved position data

			for (let i = 0; i < this.posMax; i++)  // Delete the position data in each position slot
				this.deletePos(i + 1);

			this.saveFunc('off');
			this.deleteFunc('off');

		}

	}

})	/* arrow-function */
);	/* define */
