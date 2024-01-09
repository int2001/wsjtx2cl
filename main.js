// Modules to control application life and create native browser window
const {app, BrowserWindow, globalShortcut } = require('electron/main');
const path = require('node:path');
const {ipcMain} = require('electron')
let mainWindow;
let msgbacklog=[];

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
	// Create the browser window.
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

	// Open the DevTools.
	// mainWindow.webContents.openDevTools()
	return mainWindow;
}
// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
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


app.whenReady().then(() => {
	mainWindow=createWindow();
	globalShortcut.register('Control+Shift+I', () => { return false; });
	app.on('activate', function () {
		// On macOS it's common to re-create a window in the app when the
		// dock icon is clicked and there are no other windows open.
		if (BrowserWindow.getAllWindows().length === 0) createWindow()
	});
	mainWindow.webContents.once('dom-ready', function() {
		if (msgbacklog.length>0) {
			mainWindow.webContents.send('updateMsg',msgbacklog.pop());
		}
	});
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', function () {
	// if (process.platform !== 'darwin') app.quit()
	app.quit();
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

running();

function running() {
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
			})

			req.on('timeout', () => {
				rej=true;
				req.destroy();
				reject(new Error('Request time out'));
			})

			req.on('error', (e) => {
				rej=true;
				console.error(e);
			});

			req.write(postData);
			req.end();
		});

	}

	var WServer = udp.createSocket('udp4');
	WServer.on('error', function(err) {
		try {
			mainWindow.webContents.send('updateMsg','Some other Tool which Block Port 2333 is running!');
		} catch(e) {
			msgbacklog.push('Some other Tool which Block Port 2333 is running!');
		}
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
				x.payload=JSON.parse(e);
				x.status='bug';
			}
			if (x.status == 'created') {
				adobject.created=true;
			} else {
				adobject.created=false;
				adobject.fail=x;
			}
			mainWindow.webContents.send('updateTX', adobject);
			mainWindow.webContents.send('updateMsg','');
		} else {
			mainWindow.webContents.send('updateMsg','<div class="alert alert-danger" role="alert">Set ONLY Secondary UDP-Server to Port 2333 at WSTJ-X</div>');
		}
	});

	try {
		WServer.bind(2333);
		msgbacklog.push('Waiting for QSO / Listening on UDP 2333');
	} catch(e) {
		mainWindow.webContents.send('updateMsg','Some other Tool blocks Port 2333!');
	}
}
