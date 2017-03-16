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

		console.group(`${this.name}.initBody()`);

		subscribe('/main/window-resize', this, this.resizeWidgetDom.bind(this));
		subscribe('/main/widget-visible', this, this.visibleWidget.bind(this));

		subscribe('/connection-widget/recvPortList', this, this.recvPortList.bind(this));
		subscribe('/connection-widget/recvPortData', this, this.recvPortData.bind(this));

		this.initButtons();

		// Initialize the array for saving positions.
		for (let i = 0; i < this.savepos.posMax; i++) {

			this.savepos.savedPos.push(null);

		}

		publish('/main/widget-loaded', this.id);

		return true;

	},
	initButtons() {

		// Initialize the inch/mm button.
		$('#strippit-inmm').on('click', 'span.btn', (evt) => {

			console.log('Button -in/mm-');

			// inch - G20
			// mm - G21

			const Msg = (this.unit === 'inch') ? 'G21' : 'G20';

			// If got a valid port, send a unit change message to the device.
			if (this.port !== '') {

				publish('/connection-widget/port-sendjson', this.port, { Msg });

			}

		});

		// Initialize the Feedstop button.
		$('#strippit-feedstop').on('click', 'span.btn', (evt) => {

			console.log('Button -Feedstop-');

			// If got a valid port, send a feedhold message to the device.
			if (this.port !== '') {

				publish('/connection-widget/port-feedstop', this.port);

			}

		});

		// Initialize the DRO buttons.
		$('#strippit-dro').on('click', 'span.btn', (evt) => {

			// const btnSignal = $(this).attr('btn-signal');
			const btnData = $(evt.currentTarget).attr('btn-data');

			this.setAxis(btnData);

		});

		// Initialize the Save Position buttons.
		$('#strippit-savepos').on('click', 'span.btn', (evt) => {

			const btnSignal = $(evt.currentTarget).attr('btn-signal');
			const btnData = $(evt.currentTarget).attr('btn-data');

			if (btnSignal === 'control') {

				if (btnData === 'prev') {

					this.savepos.setPrevPos(this.port);

				} else if (btnData === 'next') {

					this.savepos.setNextPos(this.port);

				// If the save button was pressed, toggle the save position flag.

				} else if (btnData === 'save') {

					this.savepos.saveFunc('toggle');
					this.savepos.deleteFunc('off');

				// If the clear button was pressed, toggle the delete position flag.

				} else if (btnData === 'delete') {

					this.savepos.saveFunc('off');
					this.savepos.deleteFunc('toggle');

				} else if (btnData === 'clear') {

					this.savepos.clearAll();

				}

			// If a position slot was selected.

			} else if (btnSignal === 'position') {

				if (this.savepos.saveSelection) {

					this.savepos.savePos(Number(btnData), this.machPosition.x);

				} else if (this.savepos.deleteSelection) {

					this.savepos.deletePos(Number(btnData));

				} else {

					this.savepos.setPos(this.port, Number(btnData));

				}

			}

		});

		// Initialize the Calculator buttons.
		$('#strippit-calc').on('click', 'span.btn', (evt) => {

			const btnSignal = $(evt.currentTarget).attr('btn-signal');
			const btnData = $(evt.currentTarget).attr('btn-data');

			// If a function button was pressed (eg. plus/minus, clear, backspace, add, etc.).
			if (btnSignal === 'function') {

				this.calc.uiFunction(btnData);

			} else if (btnSignal === 'number') {

				this.calc.uiNumber(btnData);

			}

		});

	},
	resizeWidgetDom() {

		/* eslint-disable prefer-const */

		// If this widget is not visible, do not bother updating the DOM elements.
		if (!this.widgetVisible) return false;

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

		return true;

	},
	visibleWidget(wgtVisible, wgtHidden) {

		if (wgtVisible === this.id) {

			console.log(`${this.id} is now visible.`);

			this.widgetVisible = true;

			this.resizeWidgetDom();

		} else if (wgtHidden === this.id) {

			console.log(`${this.id} is now hidden.`);

			this.widgetVisible = false;

		}

	},

	recvPortList({ PortList, PortMeta, Diffs }) {

		console.log('Got serial port list, portMeta, and diffs.');

		this.portList = PortList;
		this.portMeta = PortMeta;
		this.portListDiffs = Diffs;

		// If the port was removed/disconnected.
		if (Diffs.closed && Diffs.closed.includes(this.port)) {

			this.port = '';

			this.dro.updateDOM(0, 0);

		}

	},
	recvPortData(port, { Msg, Data }) {

		// The recvPortData method receives port data from devices on the SPJS.

		console.log(`Got data from '${port}':\nLine: ${Msg}\nData: ${Data}\nData:`, Data);

		let updateDRO = false;
		let updateUnit = false;

		// If the data includes position info, update the stored position in the widget.
		if (Data && Data.sr && typeof Data.sr.posz !== 'undefined') {

			console.log('Got x-axis postion update.');
			updateDRO = true;

			this.machPosition.x = Data.sr.posz;

		// Get this when a getting a response from a status report request.

		} else if (Data && Data.r && Data.r.sr && typeof Data.r.sr.posz !== 'undefined') {

			console.log('Got x-axis postion update.');
			updateDRO = true;

			this.machPosition.x = Data.r.sr.posz;

		}

		// If the data includes position info, update the stored position in the widget.
		if (Data && Data.sr && typeof Data.sr.posy !== 'undefined') {

			console.log('Got y-axis postion update.');
			updateDRO = true;

			this.machPosition.y = Data.sr.posy;

		// Get this when a getting a response from a status report request.

		} else if (Data && Data.r && Data.r.sr && typeof Data.r.sr.posy !== 'undefined') {

			console.log('Got y-axis postion update.');
			updateDRO = true;

			this.machPosition.y = Data.r.sr.posy;

		}

		// If the data includes unit mode info, update the stored motion mode.
		if (Data && Data.sr && typeof Data.sr.unit !== 'undefined') {

			const { unit: unitData } = Data.sr;

			console.log('Got unit mode update.');

			// inches
			if (unitData === 0 && this.unit !== 'inch') {

				updateUnit = true;

				this.unit = 'inch';

			// mm

			} else if (unitData === 1 && this.unit !== 'mm') {

				updateUnit = true;

				this.unit = 'mm';

			}

		} else if (Data && Data.r && Data.r.sr && typeof Data.r.sr.unit !== 'undefined') {

			// inches
			if (Data.r.sr.unit === 0 && this.unit !== 'inch') {

				updateUnit = true;

				this.unit = 'inch';

			// mm

			} else if (Data.r.sr.unit === 1 && this.unit !== 'mm') {

				updateUnit = true;

				this.unit = 'mm';

			}

		}

		// If a position update was received, update the DRO values in the DRO DOM.
		if (updateDRO) {

			this.port = port;

			// Update the DRO based on the new data.
			this.dro.updateDOM(this.machPosition.x, this.machPosition.y);

		}

		if (updateUnit) {

			// const factor = (this.unit === 'mm') ? 25.4 : 0.0393700787401575;
			const convFactor = (this.unit === 'mm') ? this.intomm : this.mmtoin;
			const { posMax, savedPos } = this.savepos;

			// Perform a unit conversion on each position slot.
			for (let i = 0; i < posMax; i++) {

				// If this position slot is empty, skip the unit conversion on this position slot.
				if (savedPos[i] === null) continue;

				this.savepos.savedPos[i] = savedPos[i] * convFactor;

			}

			// Update the unit in the DRO.
			$('#strippit-dro .x-axis .dro-pos-well .dro-dim').text(this.unit);
			$('#strippit-dro .y-axis .dro-pos-well .dro-dim').text(this.unit);

			// Update the unit in the calculator.
			$('#strippit-calc .calc-display-well .dro-dim').text(this.unit);

		}

	},

	dro: {
		// Stores the position values from the last update (used to prevent redundant DOM updates).
		x: 0,
		y: 0,
		// Stores JQuery DOM references to make updating the DRO more efficient.
		xValDOM: $('#strippit-dro > div.x-axis > div.dro-pos-well > h2.dro-pos table tr'),
		yValDOM: $('#strippit-dro > div.y-axis > div.dro-pos-well > h2.dro-pos table tr'),
		xDOM: {
			negpos: $('#strippit-dro > div.x-axis h2.dro-pos span.xyz-negpos'),
			intgray: $('#strippit-dro > div.x-axis h2.dro-pos span.xyz-intgray'),
			intblack: $('#strippit-dro > div.x-axis h2.dro-pos span.xyz-intblack'),
			intdecimal: $('#strippit-dro > div.x-axis h2.dro-pos span.xyz-intdecimal')
		},
		yDOM: {
			negpos: $('#strippit-dro > div.y-axis h2.dro-pos span.xyz-negpos'),
			intgray: $('#strippit-dro > div.y-axis h2.dro-pos span.xyz-intgray'),
			intblack: $('#strippit-dro > div.y-axis h2.dro-pos span.xyz-intblack'),
			intdecimal: $('#strippit-dro > div.y-axis h2.dro-pos span.xyz-intdecimal')
		},
		// Specifies how many digits should be shown before the decimal place by default.
		intgrayDigits: 3,
		// Updates the DRO values in the DOM.
		updateDOM(x, y) {

			if (x === this.x && y === this.y) {

				console.log('Redundant DRO update.');

				return false;

			}

			console.log('Updating DRO DOM values.');

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

			console.log(`${xNegpos ? '' : '-'} ${xIntgray} ${xIntblack} . ${xDecimal}`);
			console.log(`${yNegpos ? '' : '-'} ${yIntgray} ${yIntblack} . ${yDecimal}`);

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

			this.xValDOM.html(xValHTML);
			this.yValDOM.html(yValHTML);

			this.x = x;
			this.y = y;

			return true;

		}
	},

	calc: {

		// Stores the value displayed in the calculator as a string.
		value: '',
		// Stores JQuery DOM references to make updating the DRO more efficient.
		valDOM: $('#strippit-calc > div.calc-display-well > h2.calc-value table tr'),
		// Specifies how many digits should be shown before the decimal place by default.
		intgrayDigits: 3,
		// Specifies how many digits should be shown after the decimal place by default.
		decgrayDigits: 3,

		valToInt() {
			// The valToInt method converts the calculator value stored as a string into an integer.

		},

		uiFunction(data) {

			const { value } = this;

			// If the plus/minus button was pressed, toggle the calculator value between positive and negitive.
			if (data === 'plusminus') {

				this.updateDOM(value.includes('-') ? value.substring(1) : `-${value}`);

			// If the clear button was pressed, clear the calculator value.

			} else if (data === 'clear') {

				this.updateDOM('');

			// If the backspace button was pressed, remove the last character from the calculator value.

			} else if (data === 'backspace') {

				this.updateDOM(value.substr(0, value.length - 1));

			// If the decimal button was pressed and the value does not already include a decimal point, add a decimal point to the calculator value.

			} else if (data === 'decimal' && !value.includes('.')) {

				this.updateDOM(`${value}.`);

			}

		},
		uiNumber(data) {

			const { value } = this;

			// If there is already a leading zero, do not add another leading zero (Note: A leading zero is required to set axes to the zero position).
			if (data === '0' && (value === '0' || value === '-0')) return false;

			// If adding a decimal point to an empty value, add a leading zero before decimal point.
			if (data === '.' && (value === '' || value === '-')) {

				return this.updateDOM(`${value}0.`);

			}

			// If adding a number (1-9) and there is a leading zero, remove the leading zero then add the number (1-9).
			if (!isNaN(Number(data)) && Number(data) > 0 && Number(data) <= 9 && (value === '0' || value === '-0')) {

				return this.updateDOM(`${value.substr(0, value.length - 1)}${data}`);

			}

			return this.updateDOM(`${value}${data}`);

		},
		updateDOM(val) {

			// If this is a redundant DOM update, abort the DOM update.
			if (val === this.value) return false;

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

			// console.log(`${ Negpos ? '' : '-' } ${Intgray} ${Intblack} ${ dpDimmed ? '' : '.' } ${Decimal} ${decimalIntgray}`);

			// Build the HTML for the DRO values.
			let valHTML = '<td style="width:70px; text-align:right">';
			valHTML += `<span class="xyz-negpos${Negpos}" >-</span>`; 	// negpos
			valHTML += `<span class="xyz-intgray xyz-dimmed">${Intgray}</span>`; // intgray
			valHTML += `<span class="xyz-intblack">${Intblack}</span></td>`; // intblack
			valHTML += `<td><span class="${dpDimmed}">.</span>`; // decimal point
			valHTML += `<span class="xyz-decimal">${Decimal}</span>`; // decimal
			valHTML += `<span class="xyz-decimal xyz-dimmed">${decimalIntgray}</span></td>`; // decimal intgray

			// console.log(valHTML);

			// Push the new HTML to the DOM.
			this.valDOM.html(valHTML);

			this.value = val;

			return true;

		}
	},

	setAxis(axis) {

		const { port } = this;
		let [ lowLimit, highLimit ] = this.machLimits[axis];
		const { value } = this.calc;

		// If the units mode is in mm, convert the machine limits from inches to mm.
		if (this.unit === 'mm') {

			lowLimit *= this.intomm;
			highLimit *= this.intomm;

		}

		const valInt = Number(value);

		// If the port name is not valid, do not set the position.
		if (!port) return false;

		// If the value is empty, do not set the position.
		if (value === '' || value === '-') return false;

		if (valInt < lowLimit || valInt > highLimit) {

			// Flash a warning.

			return false;

		}

		const position = (value.indexOf('.') === value.length - 1) ? value.substr(0, value.length - 1) : value;

		// Note that the z-axis is used instead of the x-axis.
		// const Msg = `N${commandCount} G0 ${axis === 'x' ? 'Z' : axis.toUpperCase()}${position}`;

		const Data = [
			{ Msg: 'M08', Pause: 150 },
			{ Msg: `N${this.savepos.commandCount} G0 ${axis === 'x' ? 'Z' : axis.toUpperCase()}${position}`, Pause: 100 },
			{ Msg: 'M09', Pause: 150 }
		];

		publish('/connection-widget/port-sendjson', port, { Data });

		// Keep track of the number of commands that have been sent.
		this.savepos.commandCount += 1;

		// Clear the value in the calculator so that the next value can be entered.
		this.calc.updateDOM('');

		// If setting the x-axis, save the position to the next available position slot.
		if (axis === 'x') this.savepos.saveNextPos(Number(position));

		return true;

	},

	savepos: {
		// The active position.
		currentPos: null,
		// The number of available positions.
		posMax: 12,
		// Set this flag when the save position button is pressed.
		saveSelection: false,
		clearSelection: false,
		savedPos: [],
		/**
		 *  Stores a count of the number of commands have been sent to a device on the SPJS from this widget.
		 *  This is used to send line numers with GCode move commands.
		 *
		 *  @type {number}
		 */
		commandCount: 1,

		setPrevPos(port) {

			// If there is no active postion slot, abort this method.
			if (this.currentPos === null) return false;

			for (let i = 0; i < this.posMax; i++) {

				const posItem = this.currentPos - ((i % this.posMax) + 1);

				console.log(`slot: ${posItem}`);

				// HACK: posItem goes below 1.
				if (posItem <= 0) return false;

				if (this.savedPos[posItem - 1] !== null) {

					return this.setPos(port, posItem);

				}

			}

			return true;

		},
		setNextPos(port) {

			// If there is no active postion slot, abort this method.
			if (this.currentPos === null) return false;

			for (let i = 1; i < this.posMax; i++) {

				const posItem = (((i + this.currentPos) - 1) % this.posMax) + 1;

				console.log(`slot: ${posItem}`);

				if (this.savedPos[posItem - 1] !== null) {

					return this.setPos(port, posItem);

				}

			}

			return true;

		},
		setPos(port, pos) {

			// If the pos argument is not valid, abort this method.
			if (typeof pos === 'undefined' || isNaN(pos) || pos <= 0 || pos > this.posMax) throw new Error('Attempted to set a saved position that is out of range.');

			this.saveFunc('off');
			this.deleteFunc('off');

			// If this is an invalid update, skip the update.
			if (this.savedPos[pos - 1] === null) return false;

			const Data = [
				{ Msg: 'M08', Pause: 150 },
				{ Msg: `N${this.commandCount} G0 Z${this.savedPos[pos - 1]}`, Pause: 100 },
				{ Msg: 'M09', Pause: 150 }
			];

			// Send move command to the device on the SPJS to move to the saved position (Note that the z-axis is used instead of the x-axis).
			publish('/connection-widget/port-sendjson', port, { Data });

			// Keep track of the number of commands that have been sent.
			this.commandCount += 1;

			// If another position slot is active, deactivate the currently active position slot.
			if (this.currentPos !== null) {

				$(`#strippit-savepos span.pos-${this.currentPos}`).removeClass('slot-active');

			}

			// Make this position slot active.
			this.currentPos = pos;

			// Apply 'active' hiliting to the respective position slot.
			$(`#strippit-savepos span.pos-${pos}`).addClass('slot-active');

			return true;

		},

		saveNextPos(value) {

			// The saveNextPos method saves the given value to the next available position slot (with reference to currently selected position).

			let refPos = this.currentPos;

			if (this.currentPos === null) {

				refPos = 1;

			}

			for (let i = 0; i < this.posMax; i++) {

				const posItem = (i + refPos) % this.posMax;

				console.log(`slot: ${posItem}`);

				if (this.savedPos[posItem - 1] === null) {

					return this.savePos(posItem, value);

				}

			}

			return false;

		},
		savePos(pos, value) {

			// If the pos argument is not valid, abort this method.
			if (typeof pos === 'undefined' || isNaN(pos) || pos <= 0 || pos > this.posMax) throw new Error('Attempted to set a saved position that is out of range.');

			this.saveFunc('off');
			this.deleteFunc('off');

			// Save the value to the selected position.
			this.savedPos[pos - 1] = value;

			// If another position slot is active, deactivate the currently active position slot.
			if (this.currentPos !== null) {

				$(`#strippit-savepos span.pos-${this.currentPos}`).removeClass('slot-active');

			}

			// Make this position slot active.
			this.currentPos = pos;

			// Apply 'filled' and 'active' hiliting to the respective position slot.
			$(`#strippit-savepos span.pos-${pos}`).addClass('slot-filled');
			$(`#strippit-savepos span.pos-${pos}`).addClass('slot-active');

			console.table(this.savedPos);

		},
		deletePos(pos) {

			// The deletePos method deletes the position data for the given position slot.

			// If the pos argument is not valid, abort this method.
			if (typeof pos === 'undefined' || isNaN(pos) || pos <= 0 || pos > this.posMax) throw new Error('Attempted to delete a saved position that is out of range.');

			this.saveFunc('off');
			this.deleteFunc('off');

			// If this is a redundant update, skip the update.
			if (this.savedPos[pos - 1] === null) return false;

			this.savedPos[pos - 1] = null;

			// Remove filled hiliting from the respective position slot.
			$(`#strippit-savepos span.pos-${pos}`).removeClass('slot-filled');

			// If removing the currently selected position slot.
			if (pos === this.currentPos) {

				this.currentPos = null;

				$(`#strippit-savepos span.pos-${pos}`).removeClass('slot-active');

			}

			console.table(this.savedPos);

			return true;

		},

		saveFunc(data) {

			// Arg. (eg. 'toggle' or 'on' or 'off').

			if (data !== 'toggle' && data !== 'on' && data !== 'off') throw new Error('Invalid data argument value.');

			// If this is a redundant update, skip the update.
			if ((data === 'on' && this.saveSelection) || (data === 'off' && !this.saveSelection)) return undefined;

			// turn off
			if (data === 'toggle' && this.saveSelection) {

				data = 'off';

			} else if (data === 'toggle' && !this.saveSelection) {

				data = 'on';

			}

			if (data === 'on') {

				this.saveSelection = true;

				// Remove active hiliting from the save button.
				$('#strippit-savepos .btn-saveto').addClass('btn-active');

			} else {

				this.saveSelection = false;

				// Remove active hiliting from the save button.
				$('#strippit-savepos .btn-saveto').removeClass('btn-active');

			}

			return this.saveSelection;

		},
		deleteFunc(data) {

			// Arg. (eg. 'toggle' or 'on' or 'off').

			if (data !== 'toggle' && data !== 'on' && data !== 'off') throw new Error('Invalid data argument value.');

			// If this is a redundant update, skip the update.
			if ((data === 'on' && this.deleteSelection) || (data === 'off' && !this.deleteSelection)) return undefined;

			// Turn off
			if (data === 'toggle' && this.deleteSelection) {

				data = 'off';

			} else if (data === 'toggle' && !this.deleteSelection) {

				data = 'on';

			}

			if (data === 'on') {

				this.deleteSelection = true;

				// Remove active hiliting from the save button.
				$('#strippit-savepos .btn-delete').addClass('btn-active');

			} else {

				this.deleteSelection = false;

				// Remove active hiliting from the save button.
				$('#strippit-savepos .btn-delete').removeClass('btn-active');

			}

			return this.deleteSelection;

		},

		clearAll() {
			// The clearAll method clears all the saved position data.

			// Delete the position data in each position slot.
			for (let i = 0; i < this.posMax; i++) {

				this.deletePos(i + 1);

			}

			this.saveFunc('off');
			this.deleteFunc('off');

		}

	}

})	/* arrow-function */
);	/* define */
