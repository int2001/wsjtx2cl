const {app, BrowserWindow, globalShortcut } = require('electron/main');
const path = require('node:path');
const {ipcMain} = require('electron')
let mainWindow;
let msgbacklog=[];
var WServer;

if (require('electron-squirrel-startup')) app.quit();

var udp = require('dgram');

var q={};
var defaultcfg = {
	cloudlog_url: "https://log.jo30.de/index.php",
	cloudlog_key: "mykey",
	cloudlog_id: 0
}

const storage = require('electron-json-storage');

app.disableHardwareAcceleration(); 

storage.has('basic', function(error, hasKey) {
	if (!(hasKey)) {
		storage.set('basic', defaultcfg, function(e) {
			if (e) throw e;
		});
	} else {
		defaultcfg=storage.getSync('basic');
	}
});

function createWindow () {
	const mainWindow = new BrowserWindow({
		width: 800,
		height: 550,
		resizable: false,
		autoHideMenuBar: true,
		webPreferences: {
			contextIsolation: false,
			nodeIntegration: true,
			devTools: !app.isPackaged,
			enableRemoteModule: true,
			preload: path.join(__dirname, 'preload.js')
		}
	});
	mainWindow.setMenu(null)


	mainWindow.loadFile('index.html')
	mainWindow.setTitle(require('./package.json').name + " V" + require('./package.json').version);

	return mainWindow;
}

ipcMain.on("set_config", async (event,arg) => {
	// event.returnValue="aha";
	defaultcfg=arg;
	storage.set('basic', defaultcfg, function(e) {
		if (e) throw e;
	});
	event.returnValue=defaultcfg;
});

ipcMain.on("get_config", async (event,arg) => {
	defaultcfg=storage.getSync('basic')
	event.returnValue=defaultcfg;
});

ipcMain.on("quit", async (event,arg) => {
	app.quit();
	event.returnValue=true;
});


app.whenReady().then(() => {
	mainWindow=createWindow();
	globalShortcut.register('Control+Shift+I', () => { return false; });
	app.on('activate', function () {
		if (BrowserWindow.getAllWindows().length === 0) createWindow()
	});
	mainWindow.webContents.once('dom-ready', function() {
		if (msgbacklog.length>0) {
			mainWindow.webContents.send('updateMsg',msgbacklog.pop());
		}
	});
})

app.on('window-all-closed', function () {
	if (process.platform !== 'darwin') app.quit()
	app.quit();
})

function parseADIF(adifdata) {
	const { ADIF } = require("tcadif");
	var adiReader = ADIF.parse(adifdata);
	return adiReader.toObject();
}

function send2cloudlog(adif) {
	let clpayload={};
	clpayload.key=defaultcfg.cloudlog_key.trim();
	clpayload.station_profile_id=defaultcfg.cloudlog_id.trim();
	clpayload.type='adif';
	clpayload.string=adif;
	// console.log(clpayload);
	postData=JSON.stringify(clpayload);
	const https = require('https');
	var options = {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'User-Agent': 'SW2CL_v' + app.getVersion(),
			'Content-Length': postData.length
		}
	};


	return new Promise((resolve, reject) => {
		rej=false;
		const req = https.request(defaultcfg.cloudlog_url + '/api/qso',options, (res) => {

			if (res.statusCode < 200 || res.statusCode > 299) {
				rej=true;
			}

			const body = [];
			res.on('data', (chunk) => body.push(chunk));
			res.on('end', () => {
				const resString = Buffer.concat(body).toString();
				if (rej) {
					reject(resString);
				} else {
					resolve(resString);
				}
			})
		})

		req.on('error', (err) => {
			rej=true;
			req.destroy();
			reject('{"status":"failed","reason":"Internetproblem"}');
		})

		req.on('timeout', (err) => {
			rej=true;
			req.destroy();
			reject('{"status":"failed","reason":"timeout"}');
		})

		req.write(postData);
		req.end();
	});

}

WServer = udp.createSocket('udp4');
WServer.on('error', function(err) {
	tomsg('Some other Tool blocks Port 2333. Stop it, and restart this');
});

WServer.on('message',async function(msg,info){
	adobject=parseADIF(msg.toString());
	var plainret='';
	if (adobject.qsos.length>0) {
		let x={};
		try {
			plainret=await send2cloudlog(msg.toString());
			x = JSON.parse(plainret);
		} catch(e) {
			try {
				x.payload=JSON.parse(e);
			} catch (ee) {
				x.payload=ee;
			} finally {
				x.status='bug';
			}
		}
		if (x.status == 'created') {
			adobject.created=true;
		} else {
			adobject.created=false;
			adobject.fail=x;
		}
		mainWindow.webContents.send('updateTX', adobject);
		tomsg('');
	} else {
		tomsg('<div class="alert alert-danger" role="alert">Set ONLY Secondary UDP-Server to Port 2333 at WSTJ-X</div>');
	}
});

function tomsg(msg) {
	try {
		mainWindow.webContents.send('updateMsg',msg);
	} catch(e) {
		msgbacklog.push(msg);
	}
}

function startserver() {
	try {
		WServer.bind(2333);
		tomsg('Waiting for QSO / Listening on UDP 2333');
	} catch(e) {
		tomsg('Some other Tool blocks Port 2333. Stop it, and restart this');
	}
}

startserver();
