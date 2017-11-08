const {app, BrowserWindow, ipcMain} = require('electron')
const path = require('path');
const AutoLaunch = require('auto-launch');
const settings = require('electron-settings');
const Circuit = require('circuit-sdk');
const config = require('./config');
const SdkProxy = require('./sdkProxy');
const TrayManager = require('./trayManager');
const EventEmitter = require('events');
const emitter = new EventEmitter();

// Expose to renderers via remote
global.isDevMode = !!process.execPath.match(/dist[\\/]electron/i);
global.sdkLogLevel = config.sdkLogLevel || Circuit.Enums.LogLevel.Debug;

let domain;
let sdkProxy;

// App ready lifecycle hook. Entry point for app.
app.on('ready', run);

async function run() {
  try {
    initializeSettings();

    // Class proxying Circuit API calls to renderer process. The reason
    // a renderer process is used for Circuit API calls is to be able
    // to use Chromiums WebRTC stack and therefore make Circuit calls.
    const oauthConfig = config.domains.find(item => item.domain === domain);
    sdkProxy = new SdkProxy(oauthConfig);

    // Create Circuit icon and conversation avatars in tray. TrayManager
    // will start initialization when user is logged on to Circuit.
    // async due to image processing
    await TrayManager.init(sdkProxy, emitter);

    // Create hidden window as Circuit API wrapper. Using a renderer instead
    // of the main process allows using Chromium's WebRTC stack to make
    // Circuit calls.
    await logon();
  } catch (err) {
    console.error(err);
  }
}

// Logon
function logon() {
  return sdkProxy.logon()
    .then(user => console.log(`Logged on as ${user.displayName}`))
    .catch(console.error);
}

// Invoked by tray
emitter.on('logon', logon);

// Logout invoked by tray
emitter.on('logout', () => {
  let name = sdkProxy.user.displayName;
  sdkProxy.logout()
    .then(() => console.log(`${name} logged out`))
    .catch(console.error);
});

function initializeSettings() {
  if (!settings.get('domain')) {
    settings.set('domain', config.domains[0].domain);
    settings.set('tray', {
      favorites: true,
      custom: []
    });
  }
  domain = settings.get('domain');
}

// autolaunch
let appLauncher = new AutoLaunch({
    name: 'Circuit Chat',
    path: app.getPath('exe'),
    isHidden: false,
    mac: {
        useLaunchAgent: true
    }
});
appLauncher.enable();

ipcMain.on('re-login', () => {
  sdkProxy.logout()
    .then(run)
    .catch(console.error);
});

app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
});
