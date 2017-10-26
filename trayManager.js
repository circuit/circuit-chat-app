'use strict';

const path = require('path');
const {ipcMain, Tray, nativeImage} = require('electron');
const sharp = require('sharp');
const Circuit = require('circuit-sdk');
const TrayItem = require('./trayItem');
const CircuitTray = require('./circuitTray');

let _client, _config, _emitter;
let _trayItems = [];

async function create(client, config, emitter) {
  _client = client;
  _config = config;
  _emitter = emitter;

  // Create Circuit tray icon
  await CircuitTray.create(client, emitter);

  client.addEventListener('connectionStateChanged', evt => {
    CircuitTray.setTitle('');
    CircuitTray.updateMenu();

    if (evt.state === Circuit.Enums.ConnectionState.Disconnected) {
      removeTrays();
    } else if (evt.state === Circuit.Enums.ConnectionState.Connected) {
      // Get loggedOn user since 'loggedOnUser' property is not yet available
      // right after the connected event.
      _client.getLoggedOnUser().then(init);
    } else if (evt.state === Circuit.Enums.ConnectionState.Reconnecting) {
      CircuitTray.setTitle(evt.state);
    }
  });
}

async function init() {
  removeTrays();

  let conversations = await getConversations();

  // Initialize the trayItems in parallel
  let promises = conversations.reverse().map(c => {
    let trayItem = new TrayItem(c, _client);
    _trayItems.push(trayItem);
    return trayItem.init();
  });

  // When done, create each Tray in the same order
  await Promise.all(promises);
  _trayItems.forEach(trayItem => trayItem.createTray());
}

function removeTrays() {
  _trayItems.forEach(trayItem => trayItem.destroy());
  _trayItems = [];
}

async function getConversations() {
  let conversations;

  if (_config.conversations && _config.conversations.length) {
    // Conversations are defined, use those
    conversations = await _client.getConversationsByIds(_config.conversations);
  } else {
    // No conversations defined, so take the first five direct favorites
    // Note there is a bug in the SDK right now in which the order of the
    // returned conversations doesn't match the order of the passed in IDs.
    let conversationsIds = await _client.getFavoriteConversationIds();
    conversations = await _client.getConversationsByIds(conversationsIds);
    conversations = conversations.slice(0, 5);
  }

  // Only support direct conversations at the moment
  conversations = conversations.filter(c => c.type === Circuit.Enums.ConversationType.DIRECT);

  // Get the peer user object for each conversation and attach it to the conversation
  let userIds = conversations
    .map(c => c.participants[0] === _client.loggedOnUser.userId ? c.participants[1] : c.participants[0])

  let users = await _client.getUsersById(userIds);

  for (let i = 0; i < conversations.length; i++) {
    conversations[i].peerUser = users[i];
  }
  return conversations;
}

ipcMain.on('call', (e, userId) => {
  // TODO: forward request to a dedicated hidden BrowserWindow that is using the SDK
  // This window is able to use WebRTC. This probably means that all SDK calls should
  // go through that window rather than the main thread.
  _client.makeCall(userId);
});

module.exports = {
    create,
    init
};
