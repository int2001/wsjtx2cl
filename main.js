// Modules to control application life and create native browser window
const {app, BrowserWindow} = require('electron/main');
const path = require('node:path');
const {ipcMain} = require('electron')
let mainWindow;

var udp = require('dgram');
var WServer = udp.createSocket('udp4');

var q={};
var defaultcfg = {
	cloudlog_url: "https://log.jo30.de/index.php/api/radio",
	cloudlog_key: "mykey",
	cloudlog_id: -1
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
		height: 500,
		resizable: false,
		webPreferences: {
			contextIsolation: false,
			nodeIntegration: true,
			enableRemoteModule: true,
			preload: path.join(__dirname, 'preload.js')
		}
	})


	mainWindow.loadFile('index.html')


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
	mainWindow=createWindow()

	app.on('activate', function () {
		// On macOS it's common to re-create a window in the app when the
		// dock icon is clicked and there are no other windows open.
		if (BrowserWindow.getAllWindows().length === 0) createWindow()
	})
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

function parseADIF(adifdata) {
	const { ADIF } = require("tcadif");
	var adiReader = ADIF.parse(adifdata);
	return adiReader.toObject();
}

function send2cloudlog(adif) {
	let clpayload={};
	clpayload.key=defaultcfg.cloudlog_key;
	clpayload.station_profile_id=defaultcfg.cloudlog_id;
	clpayload.type='adif';
	clpayload.string=adif;
	// console.log(clpayload);
	postData=JSON.stringify(clpayload);
	const https = require('https');
	var options = {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Content-Length': postData.length
		}
	};


	return new Promise((resolve, reject) => {
		const req = https.request(defaultcfg.cloudlog_url + '/api/qso',options, (res) => {

			if (res.statusCode < 200 || res.statusCode > 299) {
				reject(new Error(`HTTP status code ${res.statusCode}`));
			}

			const body = [];
			res.on('data', (chunk) => body.push(chunk));
			res.on('end', () => {
				const resString = Buffer.concat(body).toString();
				resolve(resString);
			})
		})

		req.on('error', (err) => {
			reject(err)
		})

		req.on('timeout', () => {
			req.destroy();
			reject(new Error('Request time out'));
		})

		req.on('error', (e) => {
			console.error(e);
		});

		req.write(postData);
		req.end();
	});

}

WServer.on('message',async function(msg,info){
	adobject=parseADIF(msg.toString());
	let x={};
	try {
		x = JSON.parse(await send2cloudlog(msg.toString()));
	} catch(e) {
		x.status='bug';
	}
	if (x.status == 'created') {
		adobject.created=true;
		mainWindow.webContents.send('updateTX', adobject);
	} else {
		adobject.created=false;
		mainWindow.webContents.send('updateTX', adobject);
	}
});

WServer.bind(2333);

