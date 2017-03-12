/* Settings Widget JavaScript */

define(['jquery'], function($) {
return { // eslint-disable-line indent
	id: 'settings-widget',
	name: 'Settings',
	shortName: null,
	btnTheme: 'default',
	// glyphicon glyphicon-cog
	icon: 'fa fa-cogs',
	desc: '',
	publish: {},
	subscribe: {},
	foreignPublish: {
		'/main/widget-loaded': ''
	},
	foreignSubscribe: {
		'/main/all-widgets-loaded': ''
	},

	widgetDom: ['settings-panel'],
	widgetVisible: false,

	initBody: function() {
		console.group(this.name + '.initBody()');

		subscribe('/main/window-resize', this, this.resizeWidgetDom.bind(this));
		subscribe('/main/widget-visible', this, this.visibleWidget.bind(this));

		publish('/main/widget-loaded', this.id);
	},
	resizeWidgetDom: function() {
		// console.log("Resize " + this.id + " window");
		if (!this.widgetVisible) return false;
		var that = this;
		var containerHeight = $('#' + this.id).height();
		// console.log("containerHeight: " + containerHeight);
		var marginSpacing = 0;
		var panelSpacing = 0;

		$.each(this.widgetDom, function(panelIndex, panel) {
			// console.log("  panelIndex:", panelIndex, "\n  panel:", panel);
			marginSpacing += Number($('#' + that.id + ' .' + panel).css('margin-top').replace(/px/g, ''));

			if (panelIndex == that.widgetDom.length -1) {
				marginSpacing += Number($('#' + that.id + ' .' + panel).css('margin-bottom').replace(/px/g, ''));
				var panelHeight = containerHeight - (marginSpacing + panelSpacing);
				$('#' + that.id + ' .' + panel).css({'height': (panelHeight) + 'px'});
				// console.log("    panelHeight: " + panelHeight);
			} else {
				panelSpacing += Number($('#' + that.id + ' .' + panel).css('height').replace(/px/g, ''));
			}
		});
	},
	visibleWidget: function(wgtVisible, wgtHidden) {
		if (wgtVisible == this.id) {
			this.widgetVisible = true;
			console.log(this.id + ' is now visible.\n  widgetVisible: ' + this.widgetVisible);
			this.resizeWidgetDom();
		} else if (wgtHidden == this.id) {
			this.widgetVisible = false;
			console.log(this.id + ' is now hidden.\n  widgetVisible: ' + this.widgetVisible);
		}
	}


	/* Connection Module
	WebSocket:
		-Set the default port to open SPJS on.
		-Set the reconnect delay.

	SPJS:
		-Set auto request list (ie. keep getting list if not connected to any ports).
		-Set the request list delay interval.

	Console Log:
		-Set the max and min line limits.
		-Set the placeholder for the spjs and port logs.
		-Default SPJS and port log message type filtering.
		-Style settings for each message type (ie. text color and hilite color).
		-Check mark style settings for command verification.
		-Show newly opened port log (true - auto show the console log of a newly opened port; [false] - do not change the active console log).

	Device Meta:
		-Add and remove devices from deviceMeta object.
		-Edit parameters of each device.
		-Add and remove vid/pids.
		-Change default meta index.


	*/

	/*

	Revert back to default settings button.
	Save changes button.
	Cancel button.

	*/
};
});
