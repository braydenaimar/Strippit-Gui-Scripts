/* StatusBar Widget JavaScript */

define(['jquery'], function($) {
	return {
		id: "statusbar-widget",
		name: "StatusBar",
		shortName: null,
		desc: "",
		publish: { // This widget owns and publishes these signals.
		},
		subscribe: { // This widget owns and subscribes to these signals.
			'/status': ""
		},
		foreignPublish: {
			'/main/widget-loaded': ""
		},
		foreignSubscribe: {},

		// items: ['Status', 'Error', 'EStop', 'COM', 'SPJS'],
		// allHilites: "bg-default bg-success bg-info bg-warning bg-danger",

		// Ex. { 'COM10': { value: "COM10", hilite: "success" } }
		statusMeta: {
			'status': { value: "Status", hilite: null },
			'error': { value: "Error", hilite: null },
			'estop': { value: "E-Stop", hilite: null },
			'SPJS': { value: "SPJS", hilite: null }
		},

		// TODO: Eliminate unnecessary DOM updates.

		initBody: function() {
			console.group(this.name + ".initBody()");

			console.log("statusMeta:" + gui.parseObject(this.statusMeta, 2));
			var statusbarHtml = '<ul class="list-inline">';

			$.each(this.statusMeta, function(statusMetaIndex, statusMetaItem) {
				statusbarHtml += '<li class="' + statusMetaIndex;
				statusbarHtml += (statusMetaItem.hilite) ? ' bg-' + statusMetaItem.hilite:'';
				statusbarHtml += '">' + statusMetaItem.value + '</li>';
				statusbarHtml += (statusMetaIndex == "SPJS") ? '</ul>':'<span class="' + statusMetaIndex + '">|</span>';
			});

			$('#statusbar-widget').append(statusbarHtml);

			subscribe('/' + this.id + '/add', this, this.addStatus.bind(this));
			subscribe('/' + this.id + '/remove', this, this.removeStatus.bind(this));
			subscribe('/' + this.id + '/value', this, this.updateStatusValue.bind(this));
			subscribe('/' + this.id + '/hilite', this, this.updateStatusHilite.bind(this));

			publish('/main/widget-loaded', this.id);
		},
		addStatus: function(item, value, hilite, locationItem) {
			// Prop. locationItem [string] [optional] - The name of the status item that the new item will be located to the left of,
			// console.log("Statusbar add: " + item + "\n  value: " + value + "\n  hilite: " + hilite + "\n  locationItem: " + locationItem);
			console.log("Statusbar -AddStatus-" + gui.parseObject(arguments, 2));
			// console.log("Statusbar -statusMeta-" + gui.parseObject(this.statusMeta, 2));
			var that = this;
			// TODO: Check that it has not already been created.
			if (this.statusMeta[item] !== undefined) {
				// this.updateStatusValue(item, value);
				// this.updateStatusHilite(item, hilite);
				return false;
			}

			this.statusMeta[item] = { value: value, hilite: hilite };

			var statusHtml = '<li class="' + item;
			statusHtml += (hilite) ? ' bg-' + hilite:'';
			statusHtml += '">' + value + '</li><span class="' + item + '">|</span>';

			if (locationItem === undefined) {
				$('#' + this.id + ' ul.list-inline').prepend(statusHtml);
				return false;
			} else if (typeof locationItem === "string") {
				// locationItem = [item, locationItem];
				$('#' + this.id + ' li.' + locationItem).before(statusHtml);
				return false;
			} else if (locationItem.indexOf(item) == -1) {
				console.warn("The item '" + item + "' is not in the locationItem array.");
				locationItem.unshift(item);
			}
			for(var i = locationItem.indexOf(item) + 1; i < locationItem.length; i++) {
				// console.log("i: " + i);
				if (that.statusMeta[locationItem[i]] !== undefined) {
					// console.log("  locationItem[i]: " + locationItem[i]);
					$('#' + this.id + ' li.' + locationItem[i]).before(statusHtml);
					return false;
				}
			}

		},
		removeStatus: function(item) {
			// console.log("Statusbar remove: " + gui.parseObject(item));
			console.log("Statusbar -RemoveStatus-" + gui.parseObject(arguments, 2));
			var that = this;

			// If the item argument is [string]
			if (typeof item === "string") {
				item = [item];
				// if (this.statusMeta[item] === undefined) return true;
				// this.statusMeta[item] = undefined;
				// $('#' + this.id + ' .' + item).remove();
			}

			for(var i = 0; i < item.length; i++) {
				// console.log("  statusMeta[item[i]]:", that.statusMeta[item[i]]);
				if (that.statusMeta[item[i]] !== undefined) {
					that.statusMeta[item[i]] = undefined;
					$('#' + that.id + ' .' + item[i]).remove();
					// console.log("    statusMeta[item[i]]:", that.statusMeta[item[i]]);
				}
			}
			// console.log("Statusbar -statusMeta-" + gui.parseObject(this.statusMeta, 2));
		},
		updateStatusValue: function(item, value) {
			// console.log("Statusbar value: " + gui.parseObject(item) + " -> " + value + " [" + typeof item + "] Array: " + Array.isArray(item));
			console.log("Statusbar -UpdateValue-" + gui.parseObject(arguments, 2));
			// console.log("Statusbar " + item + " value -> " + value);
			var that = this;

			// If the item argument is [string]
			if (typeof item === "string") {
				item = [item];
			}

			for(var i = 0; i < item.length; i++) {
				that.statusMeta[item[i]].value = value;
				$('#' + that.id + ' li.' + item[i]).text(value);
			}
		},
		updateStatusHilite: function(item, hilite) {
			// console.log("Statusbar hilite: " + gui.parseObject(item) + " -> " + hilite + " [" + typeof item + "] Array: " + Array.isArray(item));
			console.log("Statusbar -UpdateHilite-" + gui.parseObject(arguments, 2));
			// console.log("Statusbar -statusMeta-" + gui.parseObject(this.statusMeta, 2));
			var that = this;

			// If the item argument is [string], turn it into an array.
			if (typeof item === "string") {
				item = [item];
			}

			for(var i = 0; i < item.length; i++) {
				if (that.statusMeta[item[i]].hilite) {
					$('#' + that.id + ' li.' + item[i]).removeClass("bg-" + that.statusMeta[item[i]].hilite);
				}
				that.statusMeta[item[i]].hilite = hilite;
				if (hilite !== null) {
					$('#' + that.id + ' li.' + item[i]).addClass("bg-" + hilite);
				}
			}
			// console.log("Statusbar -statusMeta-" + gui.parseObject(this.statusMeta, 2));
		}
	};
});
