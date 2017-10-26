const {app, BrowserWindow, ipcMain} = require('electron')
const path = require('path')
const Circuit = require('circuit-sdk');
const settings = require('electron-settings');
const config = require('./config')[process.env.system || 'sandbox'];
const oauth = require('./oauth')(config.oauth);
const TrayManager = require('./trayManager');
const EventEmitter = require('events');
const emitter = new EventEmitter();

let window;

Circuit.logger.setLevel(Circuit.Enums.LogLevel.Debug);

// Create Circuit SDK client instance
let client = new Circuit.Client({
  client_id: config.oauth.client_id,
  domain: config.oauth.domain
});

// temporary: since _client.getConversationsByIds doesn't return the conversations in the same order
client.getConversationsByIds = convIds => Promise.all(convIds.map(client.getConversationById));

function logon() {
  return oauth.getToken()
    .then(token => client.logon({accessToken: token}))
    .then(user => console.log(`Logged on as ${user.displayName}`))
    .catch(err => {
      if (err && err.message !== 'window was closed by user') {
        // Session timed out, but token is still valid. This may happen if the
        // OAuth TTL is shorter than the session timeout, especially if the user
        // did not choose `This is a private computer` on the login page.
        oauth.clearToken();
        return logon();
      }
      return Promise.reject(err);
    });
}

emitter.on('logon-request', logon);

app.on('ready', async () => {
  try {
    await TrayManager.create(client, config, emitter);
    await logon()
  } catch (err) {
    console.error(err);
    return;
  }
});

app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
