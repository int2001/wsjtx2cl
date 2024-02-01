// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// No Node.js APIs are available in this process because
// `nodeIntegration` is turned off. Use `preload.js` to
// selectively enable features needed in the rendering
// process.


// Shorthand for document.querySelector.
var cfg={};

const {ipcRenderer} = require('electron')

const bt_save=select("#save");
const bt_quit=select("#quit");
const bt_test=select("#test");
var oldCat={ vfo: 0, mode: "SSB" };

$(document).ready(function() {

	cfg=ipcRenderer.sendSync("get_config", '');
	$("#cloudlog_url").val(cfg.cloudlog_url);
	$("#cloudlog_key").val(cfg.cloudlog_key.trim());
	$("#cloudlog_id").val(cfg.cloudlog_id);
	$("#flrig_host").val(cfg.flrig_host.trim());
	$("#flrig_port").val(cfg.flrig_port.trim());
	$("#flrig_ena").prop("checked", cfg.flrig_ena);

	bt_save.addEventListener('click', () => {
		cfg.cloudlog_url=$("#cloudlog_url").val().trim();
		cfg.cloudlog_key=$("#cloudlog_key").val().trim();
		cfg.cloudlog_id=$("#cloudlog_id").val().trim();
		cfg.flrig_host=$("#flrig_host").val().trim();
		cfg.flrig_port=$("#flrig_port").val().trim();
		cfg.flrig_ena=$("#flrig_ena").is(':checked');
		x=ipcRenderer.sendSync("set_config", cfg);
		console.log(x);
	});

	bt_quit.addEventListener('click', () => {
		x=ipcRenderer.sendSync("quit", '');
	});

	bt_test.addEventListener('click', () => {
		cfg.cloudlog_url=$("#cloudlog_url").val().trim();
		cfg.cloudlog_key=$("#cloudlog_key").val().trim();
		cfg.cloudlog_id=$("#cloudlog_id").val().trim();
		x=(ipcRenderer.sendSync("test", cfg));
		if (x.payload.status == 'created') {
			$("#test").removeClass('btn-primary');
			$("#test").removeClass('btn-danger');
			$("#test").addClass('btn-success');
			$("#msg2").hide();
			$("#msg2").html("");
		} else {
			$("#test").removeClass('btn-primary');
			$("#test").removeClass('btn-success');
			$("#test").addClass('btn-danger');
			$("#msg2").show();
			$("#msg2").html("Test failed. Reason: "+x.payload.reason);
		}
		console.log(x);
	});

	getsettrx();

	$("#flrig_ena").on( "click",function() {
		getsettrx();
	});

	setInterval(updateUtcTime, 1000);
	window.onload = updateUtcTime;
});

function select(selector) {
	return document.querySelector(selector);
}

window.TX_API.onUpdateMsg((value) => {
	$("#msg").html(value);
	$("#msg2").html("");
});

window.TX_API.onUpdateTX((value) => {
	if (value.created) {
		$("#log").html('<div class="alert alert-success" role="alert">'+value.qsos[0].TIME_ON+" "+value.qsos[0].CALL+" ("+value.qsos[0].GRIDSQUARE+") on "+value.qsos[0].BAND+" (R:"+value.qsos[0].RST_RCVD+" / S:"+value.qsos[0].RST_SENT+') - OK</div>');
	} else {
		$("#log").html('<div class="alert alert-danger" role="alert">'+value.qsos[0].TIME_ON+" "+value.qsos[0].CALL+" ("+value.qsos[0].GRIDSQUARE+") on "+value.qsos[0].BAND+" (R:"+value.qsos[0].RST_RCVD+" / S:"+value.qsos[0].RST_SENT+') - Error<br/>Reason: '+value.fail.payload.reason+'</div>');
	}
})


async function get_trx() {
	let currentCat={};
	currentCat.vfo=await getInfo('rig.get_vfo');
	currentCat.mode=await getInfo('rig.get_mode');
	$("#current_trx").html((currentCat.vfo/(1000*1000))+" MHz / "+currentCat.mode);
	if (!(isDeepEqual(oldCat,currentCat))) {
		// console.log(currentCat);
		console.log(await informWavelog(currentCat));
	} 
	oldCat=currentCat;
	return currentCat;
}

async function getInfo(which) {
    const response = await fetch(
        "http://"+$("#flrig_host").val()+':'+$("#flrig_port").val(),
        {
            method: 'POST',
            // mode: 'no-cors',
                        headers: {
                'Accept': 'application/json, application/xml, text/plain, text/html, *.*',
                'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8'
            },
            body: '<?xml version="1.0"?><methodCall><methodName>'+which+'</methodName></methodCall>'
        });
        const data = await response.text();
	var parser = new DOMParser();
        var xmlDoc = parser.parseFromString(data, "text/xml");
        var qrgplain = xmlDoc.getElementsByTagName("value")[0].textContent;
        return qrgplain;
}

async function getsettrx() {
	if ($("#flrig_ena").is(':checked')) {
		x=await get_trx();
		setTimeout(() => {
			getsettrx();
		}, 1000);
	}
}

const isDeepEqual = (object1, object2) => {

	const objKeys1 = Object.keys(object1);
	const objKeys2 = Object.keys(object2);

	if (objKeys1.length !== objKeys2.length) return false;

	for (var key of objKeys1) {
		const value1 = object1[key];
		const value2 = object2[key];

		const isObjects = isObject(value1) && isObject(value2);

		if ((isObjects && !isDeepEqual(value1, value2)) ||
		    (!isObjects && value1 !== value2)
		   ) {
			   return false;
		   }
	}
	return true;
};

const isObject = (object) => {
	return object != null && typeof object === "object";
};

async function informWavelog(CAT) {
	let data={ radio: "WLGate", key: cfg.cloudlog_key, frequency: (CAT.vfo), mode: CAT.mode };
	let x=await fetch(cfg.cloudlog_url + '/api/radio', {
		method: 'POST',
		headers: {
			Accept: 'application.json',
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(data)
	});
	return x;
}

function updateUtcTime() {
	const now = new Date();

	const hours = ('0' + now.getUTCHours()).slice(-2);
	const minutes = ('0' + now.getUTCMinutes()).slice(-2);
	const seconds = ('0' + now.getUTCSeconds()).slice(-2);

	const formattedTime = `${hours}:${minutes}:${seconds}z`;

	document.getElementById('utc').innerHTML = formattedTime;
}
