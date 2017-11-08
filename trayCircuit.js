'use strict';

const opn = require('opn');
const {BrowserWindow, ipcMain, Menu, nativeImage, Tray} = require('electron');
const sharp = require('sharp');
const settings = require('electron-settings');
const Circuit = require('circuit-sdk');

let _tray;
let _emitter;
let _sdkProxy
let _signinTemplate, _signoutTemplate;
let _iconBuffer, _iconBufferGrey;

async function create(emitter, sdkProxy) {
  _emitter = emitter;
  _sdkProxy = sdkProxy;

  // Create Circuit tray
  let icon = await sharp('file://' + __dirname + '/assets/logo.png')
    .resize(18, 18)
    .background({r: 0, g: 0, b: 0, alpha: 0})
    .extend({top: 1, bottom: 1, left: 2, right: 2})
    .png();

  _iconBuffer = await icon.toBuffer();
  _iconBufferGrey = await icon.greyscale().toBuffer();

  _tray = new Tray(nativeImage.createFromBuffer(_iconBufferGrey));
  _tray.setToolTip('Circuit Tray App');
  _tray.setHighlightMode(false);

  const domain = settings.get('domain');
  _signinTemplate = [
    {
      label: 'Open Circuit',
      click () { opn(`https://${domain}`, {app: 'google chrome'}); }
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
      click () { _emitter.emit('logon'); }
    },
    {type: 'separator'},
    {role: 'quit'}
  ];

  _signoutTemplate = _signinTemplate.map(t => {
    if (t.id === 'signin') {
      return {
        label: 'Sign out',
        click () { _emitter.emit('logout'); }
      }
    }
    return t;
  });

  sdkProxy.on('connectionStateChanged', evt => {
    let isConnected = evt.state === Circuit.Enums.ConnectionState.Connected;
    updateMenu(isConnected);
    updateIcon(isConnected);
    setTitle(evt.state === Circuit.Enums.ConnectionState.Reconnecting ? evt.state : '');
  });

  updateMenu();

  console.log('Created Circuit tray');

  return {
    destroy: () => {
      _tray.destroy();
      _tray = null;
    }
  };
}

function setTitle(title) {
  _tray && _tray.setTitle(title);
}

function updateMenu(isConnected) {
  if (_tray) {
    let menu = isConnected ? _signoutTemplate: _signinTemplate;
    let contextMenu = Menu.buildFromTemplate(menu);
    _tray.setContextMenu(contextMenu);
  }
}

function updateIcon(isConnected) {
  if (_tray) {
    _tray.setImage(isConnected ?
        nativeImage.createFromBuffer(_iconBuffer) :
        nativeImage.createFromBuffer(_iconBufferGrey));
  }
}

function showPreferences() {
  let window = new BrowserWindow({
    width: 400,
    height: 430,
    show: false,
    resizable: false,
  });

  window.loadURL('file://' + __dirname + '/preferences/index.html');

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

  window.loadURL('file://' + __dirname + '/about/index.html');

  window.show();
  window.focus();
}

module.exports = {
    create,
    setTitle,
    updateMenu
};