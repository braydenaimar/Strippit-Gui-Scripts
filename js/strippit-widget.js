/* Tool Widget JavaScript */

define(['jquery'], function($) {
return {
	id: 'strippit-widget',
	name: 'Strippit',
	shortName: 'Strippit',
	btnTheme: 'default',
	icon: 'fa fa-home', // fa-scribd
	desc: 'The user interface for controlling the Strippit punch press.',
	publish: {},
	subscribe: {},
	foreignPublish: {
		'/main/widget-loaded': ''
	},
	foreignSubscribe: {
		'/main/all-widgets-loaded': ''
	},

	widgetDom: ['strippit-panel'],
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

		publish('/main/widget-loaded', this.id);
	},
	resizeWidgetDom: function() {
		// console.log('Resize ' + this.id + ' window');
		if (!this.widgetVisible) return false;
		var that = this;
		var containerHeight = $('#' + this.id).height();
		// console.log('containerHeight: ' + containerHeight);
		var marginSpacing = 0;
		var panelSpacing = 0;

		$.each(this.widgetDom, function(panelIndex, panel) {
			let panelDom = $(`#${that.id} .${panel}`)
			// console.log('  panelIndex:', panelIndex, '\n  panel:', panel);
			marginSpacing += Number(panelDom.css('margin-top').replace(/px/g, ''));

			if (panelIndex == that.widgetDom.length -1) {
				marginSpacing += Number(panelDom.css('margin-bottom').replace(/px/g, ''));

				let panelHeight = containerHeight - (marginSpacing + panelSpacing);
				panelDom.css({'height': (panelHeight) + 'px'});
				// console.log('    panelHeight: ' + panelHeight);
			} else {
				panelSpacing += Number(panelDom.css('height').replace(/px/g, ''));
			}
		});
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

	recvPortList(portList, portMeta, diffs) {
		console.log('Got serial port list, portMeta, and diffs.');
		this.portList = portList;
		this.portMeta = portMeta;
		this.portListDiffs = diffs;
	},
	recvRawPortData(port, data) {
		console.log(`Got data from '${port}': ${data}\nData:`, data);
	}

};	/* return */
});	/* define */
