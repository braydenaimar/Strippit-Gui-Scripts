/* Strippit Widget JavaScript */

define(['jquery'], function($) {
return {
	id: 'strippit-widget',
	name: 'Strippit',
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

	portList: {},
	portMeta: {},
	portListDiffs: {},

	initBody: function() {

		console.group(`${this.name}.initBody()`);

		subscribe('/main/window-resize', this, this.resizeWidgetDom.bind(this));
		subscribe('/main/widget-visible', this, this.visibleWidget.bind(this));

		subscribe('/connection-widget/recvPortList', this, this.recvPortList.bind(this));
		subscribe('/connection-widget/recvRawPortData', this, this.recvRawPortData.bind(this));

		this.initButtons();

		publish('/main/widget-loaded', this.id);

	},
	initButtons() {

		// Initialize the in/mm button.
		$('#strippit-inmm').on('click', 'span.btn', function (evt) {

			console.log('Button -in/mm-');

		});

		// Initialize the Feedstop button.
		$('#strippit-feedstop').on('click', 'span.btn', function (evt) {

			console.log('Button -Feedstop-');

		});

		// Initialize the DRO buttons.
		$('#strippit-dro').on('click', 'span.btn', function (evt) {

			// const btnSignal = $(this).attr('btn-signal');
			const btnData = $(this).attr('btn-data');

			if (btnData === 'set-x') {
				console.log('Button -DRO- set-x');

			} else if (btnData === 'set-y') {
				console.log('Button -DRO- set-y');

			}

		});

		// Initialize the Save Position buttons.
		$('#strippit-savepos').on('click', 'span.btn', function (evt) {

			const btnSignal = $(this).attr('btn-signal');
			const btnData = $(this).attr('btn-data');

			if (btnSignal === 'control') {
				console.log(`Button -SavePos- ${btnData}`);

			} else if (btnSignal === 'position') {
				console.log(`Button -SavePos- Position #${btnData}`);

			}

		});

		// Initialize the Calculator buttons.
		$('#strippit-calc').on('click', 'span.btn', this.calcButton.bind(this));

	},
	resizeWidgetDom: function() {

		// If this widget is not visible, do not bother updating the DOM elements.
		if (!this.widgetVisible) return false;

		const that = this;

		let containerHeight = $(`#${this.id}`).height();
		let marginSpacing = 0;
		let panelSpacing = 0;

		for (var i = 0; i < this.widgetDom.length; i++) {

			let panel = that.widgetDom[i];
			let panelDom = $(`#${that.id} .${panel}`)

			marginSpacing += Number(panelDom.css('margin-top').replace(/px/g, ''));

			if (i == that.widgetDom.length - 1) {
				marginSpacing += Number(panelDom.css('margin-bottom').replace(/px/g, ''));

				let panelHeight = containerHeight - (marginSpacing + panelSpacing);
				panelDom.css({'height': (panelHeight) + 'px'});

			} else {
				panelSpacing += Number(panelDom.css('height').replace(/px/g, ''));

			}
		}

	},
	visibleWidget: function(wgtVisible, wgtHidden) {

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

	},
	recvRawPortData(port, { Msg, Data }) {

		console.log(`Got data from '${port}':\nLine: ${Msg}\nData: ${Data}\nData:`, Data);

		// If the data includes position info, update the DRO.
		// TODO: Pull position data from raw port data.
		machPosition.x = 0;
		machPosition.y = 0;

		// Update the DRO.
		this.dro.update(machPosition.x, machPosition.y);

	},

	// Updated from raw port data.
	machPosition: {
		x: 0,
		y: 0,
	},

	dro: {
		x: 0,
		y: 0,
		update(x, y) {

			if (x == this.x && y == this.y) {
				console.log('Redundant DRO update.');
				return false;
			}

			this.x = x;
			this.y = y;

			this.updateDOM();

			return true;
		},
		updateDOM() {

		},
	},

	saveposValx: [],
	saveposValy: [],

	// Store the value as a string.
	calcVal: '',
	calcValDom: $('#strippit-calc > div.calc-display-well > h2.calc-value'),

	// Update the displayed value in the calculator.
	calcDomUpdate(val) {

		if (val === this.calcVal) {
			console.log('Redundant calculator DOM update.');
			return false;
		}

		this.calcValDom.text(val);

	},
	calcButton(evt) {

		const btnSignal = $(this).attr('btn-signal');
		const btnData = $(this).attr('btn-data');

		if (btnSignal === 'function') {

			console.log(`Button -Calculator- ${btnData}`);

			if (btnData === 'clear') {
				this.calcDomUpdate('');
			}



		} else if (btnSignal === 'number') {

			console.log(`Button -Calculator- #${btnData}`);

		}

	}



};	/* return */
});	/* define */
