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
var flpoller;

$(document).ready(function() {

	cfg=ipcRenderer.sendSync("get_config", '');
	$("#cloudlog_url").val(cfg.cloudlog_url);
	$("#cloudlog_key").val(cfg.cloudlog_key.trim());
	$("#cloudlog_id").val(cfg.cloudlog_id.trim());
	$("#flrig_host").val(cfg.flrig_host.trim());
	$("#flrig_port").val(cfg.flrig_port.trim());
	$("#flrig_ena").prop("checked", cfg.flrig_ena);

	bt_save.addEventListener('click', () => {
		cfg.cloudlog_url=$("#cloudlog_url").val().trim();
		cfg.cloudlog_key=$("#cloudlog_key").val().trim();
		cfg.cloudlog_id=$("#cloudlog_id").val().trim();
		cfg.flrig_host=$("#flrig_host").val().trim();
		cfg.flirg_port=$("#flrig_port").val().trim();
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
			$("#test").removeClass('alert-danger');
			$("#test").addClass('alert-success');
			$("#msg2").html("");
		} else {
			$("#test").removeClass('btn-primary');
			$("#test").removeClass('alert-success');
			$("#test").addClass('alert-danger');
			$("#msg2").html("Test failed. Reason: "+x.payload.reason);
		}
		console.log(x);
	});

	getsettrx();

	$("#flrig_ena").on( "click",function() {
		getsettrx();
	});
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
	let x={};
	x.vfo=await getInfo('rig.get_vfo');
	x.mode=await getInfo('rig.get_mode');
	return x;
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
		console.log(x);
		setTimeout(() => {
			getsettrx();
		}, 1000);
	}
}
