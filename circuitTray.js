'use strict';

const path = require('path');
const opn = require('opn');
const {BrowserWindow, Menu, nativeImage, Tray} = require('electron');
const sharp = require('sharp');
const Circuit = require('circuit-sdk');

let _circuitTray;
let _client;
let _emitter;
let _signinTemplate, _signoutTemplate;

async function create(client, emitter) {
  _client = client;
  _emitter = emitter;

  // Create Circuit tray
  let buffer = await sharp(path.join(__dirname, 'assets/circuit.png'))
    .resize(18, 18)
    .background({r: 0, g: 0, b: 0, alpha: 0})
    .extend({top: 1, bottom: 1, left: 2, right: 2})
    .png()
    .toBuffer();

  _circuitTray = new Tray(nativeImage.createFromBuffer(buffer));
  _circuitTray.setToolTip('Circuit Tray App');

  _signinTemplate = [
    {
      label: 'Open Circuit',
      click () { opn(`https://${client.domain}`, {app: 'google chrome'}); }
    },
    {
      label: 'Preferences...',
      click () { showPreferences(); }
    },
    {
      label: 'About',
      click () { showAbout(); }
    },
    {type: 'separator'},
    {
      id: 'signin',
      label: 'Sign in',
      click () { signin(); }
    },
    {type: 'separator'},
    {role: 'quit'}
  ];

  _signoutTemplate = _signinTemplate.map(t => {
    if (t.id === 'signin') {
      return {
        label: 'Sign out',
        click () { signout(); }
      }
    }
    return t;
  });

  updateMenu();
  console.log('Created Circuit tray');
}

function setTitle(title) {
  _circuitTray.setTitle(title);
}

function updateMenu() {
  let menu = _client.connectionState !== Circuit.Enums.ConnectionState.Connected ? _signinTemplate : _signoutTemplate;
  let contextMenu = Menu.buildFromTemplate(menu);
  _circuitTray.setContextMenu(contextMenu);
}

function showPreferences() {
  let window = new BrowserWindow({
    width: 400,
    height: 300,
    show: false,
    resizable: false,
  });

  window.loadURL(`file://${path.join(__dirname, 'preferences/index.html')}`);

  window.show();
  window.focus();
}

function showAbout() {
  let window = new BrowserWindow({
    width: 400,
    height: 300,
    show: false,
    resizable: false,
  });

  window.loadURL(`file://${path.join(__dirname, 'about/index.html')}`);

  window.show();
  window.focus();
}

function signin() {
  _emitter.emit('logon-request');
}

function signout() {
  return _client.logout();
}

module.exports = {
    create,
    setTitle,
    updateMenu
};