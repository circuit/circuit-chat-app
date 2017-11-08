# Circuit Chat app

Chat with your favorite users quickly via this native tray application. This native application (Windows & Mac) uses the electron framework to creates tray icons for up to five users and allow chat and calling via Circuit.

## Features

* Configure up to 5 direct conversations to show as tray. By default the first 5 favorites are used.
* Show presence in tray avatar and detailed presence on chat window.
* Chat :)
* Make direct calls
* Mac and Windows (Linux should work too, but not tested)

## Goals of this example
* Usage of [Circuit JS SDK](https://github.com/circuit/circuit-sdk) in a desktop app based on [electron](https://electron.atom.io/)
* Specifically how to use the SDK in a renderer process so that the Circuit WebRTC APIs can be used
* Demonstrate simple cross-platform implementation using electron


## Screenshots
<div style="display:inline">
<img height="400px" src="https://dl.dropboxusercontent.com/s/txmtj7ezf3bm58m/mac.png?dl=0"/>
<img height="400px" src="https://dl.dropboxusercontent.com/s/9hyqk00wu9js8mu/win10.png?dl=0"/>
</div>

> On Windows the tray is probably not the best solution for this. Taskbar might be better.

## Architecture

The Circuit WebRTC APIs are not available in the Cirucit Node.JS SDK due to the fact that Node.js does not contain a WebRTC stack. Electron is made up of Node.js and Chromium and therefore within a Chromium renderer process the Circuit WebRTC APIs can be used.

This chat app opens individual chat windows for each user which means either every chat window needs it own JS SDK & login etc, or a common renderer process is used as single SDK access. The later is chosen as this only requires a single websocket connection to the Circuit servers (/renderer/circuit/index.js).

The suggested OAuth authentication method for desktop application is Authorization Code, and since the browser JS SDK does not support the authentication part is done in the main process (/main/oauth.js). Once authenticated and the access token is available, the token is handed over to a proxy class that acts as intermediate between main process APIs calls and the Circuit SDK renderer.


### Components

#### Main process components
* index.js: Entry point of app. Manages lifecycle events.
* oauth.js: Handles OAuth 2.0 Authorization Code flow and returns access token
* sdkProxy.js: Proxy Circuit SDK API calls and events for main process modules and to renderer windows
* trayManager.js: Manages the main Circuit tray item and maintains a list individual user trays (trayItems)
* trayCircuit.js: The main Circuit tray with its context menu
* trayItem.js: Manages the chat window for this tray

#### Renderer process components/windows
* /circuit: Circuit SDK adapter
* /preferences: Preferences window
* /about: About window


## Build and run

```bash
    git clone https://github.com/circuit/circuit-chat-app.git
    cd circuit-chat-app
    cp config.json.template config.json
    // Add your client_id and client_secret to config.json
    npm install
    npm start
```


### Package app
```bash
    npm dist
```


## Packaged installer downloads
* [Mac](https://dl.dropboxusercontent.com/s/5mja0yclj5v0bmq/Circuit%20Chat-1.0.0.dmg?dl=0)
* [Windows](https://dl.dropboxusercontent.com/s/9hyqk00wu9js8mu/win10.png?dl=0) (only Windows 10 tested)

