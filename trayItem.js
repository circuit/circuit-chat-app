'use strict';

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const request = require('request').defaults({ encoding: null });
const {BrowserWindow, Tray, nativeImage} = require('electron');
const Circuit = require('circuit-sdk');

class TrayItem {
  constructor(conversation, client) {
    this._conversation = conversation;
    this._client = client;
    this._avatarBuffer = null;
    this._tray = null;
    this._presenceState = Circuit.Enums.PresenceState.OFFLINE;
    this._hasUnread = 0;
    this._window = null;
  }

  get conversation() { return this._conversation; }

	get presenceState() { return this._presenceState; }
	set presenceState(value) {
    if (this._presenceState !== value) {
      this._presenceState = value;
      this.renderIcon();
    }
  }

	get hasUnread() { return this._hasUnread; }
	set hasUnread(value) {
    if (this._hasUnread !== value) {
      this._hasUnread = !!value;
      this.renderIcon();
    }
  }

  // Initialize the tray
  async init() {
    try {
      const roundedCorners = new Buffer('<svg><rect x="0" y="0" width="18" height="18" rx="9" ry="9"/></svg>');

      // Download the user's avatar, resize it, make round corners, position it,
      // convert to png for transparency, convert it to a nativeImage and show it.
      let file = path.join('avatars', this._conversation.peerUser.userId);

      // Download the user's avatar
      await this.download(this._conversation.peerUser.avatar, file);

      // Resize avatar, make round corners, position it and convert to png for
      // transparency and save as buffer
      this._avatarBuffer = await sharp(file)
        .resize(18, 18)
        .overlayWith(roundedCorners, {cutout: true})
        .extend({top: 1, bottom: 1, left: 2, right: 2})
        .png()
        .toBuffer();

      this.setupSdkListeners();

      // Set initial presence state
      let presence = await this._client.getPresence(this._conversation.peerUser.userId);
      this._presenceState = presence[0].state;

      // Set initial unread indicator
      this._hasUnread = this._conversation.userData.unreadItems > 0;

      // Subscribe to presence changes
      this._client.subscribePresence(this._conversation.peerUser.userId);
    } catch (err) {
      console.log(err);
    }
  }

  createTray() {
    // Create a native image from the buffer and create the tray
    let avatar = nativeImage.createFromBuffer(this._avatarBuffer);
    this._tray = new Tray(avatar);
    this._tray.setToolTip(this._conversation.peerUser.displayName);
    this.renderIcon();
    console.log(`Created tray for ${this._conversation.peerUser.displayName} (${this._presenceState})`);

    this.setupTrayListeners();
    this.createWindow();
  }

  destroy() {
    this._tray.destroy();
  }

  download(uri, filename) {
    return new Promise((resolve, reject) => {
      request.head(uri, (err, res, body) => {
        let auth = {
          'auth': {
            'bearer': this._client.accessToken
          }
        };
        request(uri, auth).pipe(fs.createWriteStream(filename)).on('close', resolve);
      });
    });
  }

  async renderIcon() {
    let buffer;

    // Presence ring
    switch (this.presenceState) {
      case Circuit.Enums.PresenceState.AVAILABLE:
      case Circuit.Enums.PresenceState.BUSY:
        let available = new Buffer('<svg width="18" height="18"><circle cx="14" cy="14" r="4" fill="#87c341"/></svg>');
        available = new Buffer('<svg><circle cx="9" cy="9" r="8" stroke="#87c341" stroke-width="2" fill="none"/></svg>');
        buffer = await sharp(this._avatarBuffer)
          .overlayWith(available)
          .png()
          .toBuffer();
        break;

      case Circuit.Enums.PresenceState.DND:
        let redRing = new Buffer('<svg><circle cx="9" cy="9" r="8" stroke="red" stroke-width="2" fill="none"/></svg>');
        buffer = await sharp(this._avatarBuffer)
          .overlayWith(redRing)
          .png()
          .toBuffer();
        break;

      default:
        buffer = await sharp(this._avatarBuffer)
          .toBuffer();
        break;
    }

    // Unread indicator
    if (this._hasUnread) {
      let unreadIndicator = new Buffer('<svg width="18" height="18"><circle cx="14" cy="4" r="4" fill="red"/></svg>');
      buffer = await sharp(buffer)
        .overlayWith(unreadIndicator)
        .png()
        .toBuffer();
    }

    let icon = nativeImage.createFromBuffer(buffer);
    this._tray.setImage(icon);
  }


  setupSdkListeners() {
    this._client.addEventListener('userPresenceChanged', evt => {
      if (evt.presenceState.userId === this._conversation.peerUser.userId) {
        // User's presence has changed. Update the tray.
        this.presenceState = evt.presenceState.state;
      }
    });

    this._client.addEventListener('itemAdded', evt => {
      if (evt.item.convId === this._conversation.convId) {
        // New item has been added, assume user doens't have the pop-down open,
        // so show the unread indicator
        this.hasUnread = true;
      }
    });

    this._client.addEventListener('conversationReadItems', evt => {
      if (evt.data.convId === this._conversation.convId) {
        // User read item(s) on another device. For simplicity just re-read
        // the conversation to get the unread count.
        this._client.getConversationById(this._conversation.convId)
          .then(c => this.hasUnread = c.userData.unreadItems > 0)
          .catch(console.error);
      }
    });
  }

  createWindow() {
    // Make the popup window for the menubar
    this._window = new BrowserWindow({
      width: 300,
      height: 350,
      show: false,
      frame: false,
      //resizable: false,
    })

    // Tell the popup window to load our index.html file
    this._window.loadURL(`file://${path.join(__dirname, 'chat/index.html')}`)

    // Only close the window on blur if dev tools isn't opened
    this._window.on('blur', () => {
      if (!this._window.webContents.isDevToolsOpened()) {
        this._window.hide()
      }
    });

    this._window.webContents.on('did-frame-finish-load', () => {
        this._window.webContents.send('conversation', this._conversation);
    });
  }

  toggleWindow() {
    if (this._window.isVisible()) {
      this._window.hide()
    } else {
      this.showWindow()
    }
  }

  showWindow() {
    const trayPos = this._tray.getBounds()
    const windowPos = this._window.getBounds()
    let x, y = 0
    if (process.platform == 'darwin') {
      x = Math.round(trayPos.x + (trayPos.width / 2) - (windowPos.width / 2))
      y = Math.round(trayPos.y + trayPos.height)
    } else {
      x = Math.round(trayPos.x + (trayPos.width / 2) - (windowPos.width / 2))
      y = Math.round(trayPos.y + trayPos.height * 10)
    }

    this._window.setPosition(x, y, false)
    this._window.show()
    this._window.focus()
  }

  setupTrayListeners() {
    this._tray.on('click', evt => this.toggleWindow());
  }

}

module.exports = TrayItem;
