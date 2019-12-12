/**
 * snapcamcontrol.js - Control utility for iON SnapCam(TM)
 *
 * Copyright (c) 2019 David Imhoff <dimhoff.devel <at> gmail.com>
 *
 * This work is licensed under the Creative Commons
 * Attribution-NonCommercial-ShareAlike 4.0 International License.
 * To view a copy of this license, visit
 * http://creativecommons.org/licenses/by-nc-sa/4.0/ or send a letter to
 * Creative Commons, PO Box 1866, Mountain View, CA 94042, USA.
 */
"use strict";

busyScreenInit();

const UUID_SERVICE = "1b7e8251-2877-41c3-b46e-cf057c562023";
const UUID_NOTIFY = "8ac32d3f-5cb9-4d44-bec2-ee689169f626";
const UUID_CMD = "5e9bf2a8-f93f-4481-a67e-3b2f4a07891a";

const MAX_FRAME_SIZE = 20;
const MAX_SEND_RETRY = 3;
const BLE_RESPONSE_TIMEOUT = 5000;

const utf8Encoder = new TextEncoder('utf-8');
const utf8Decoder = new TextDecoder('utf-8');

const ackFrame = utf8Encoder.encode('{"ret":1}');

var bleDevice = null;
var cmdCharacteristic = null;
var notifyCharacteristic = null;
var bleResponseQueue = [];
var deviceState = 0;
var disconnecting = false;

function log(msg) {
  const logOutput = document.getElementById("outLog");

  if (logOutput.textContent.length != 0) {
    logOutput.textContent += '\n';
  }

  logOutput.textContent += msg;
  logOutput.scrollTo(0, logOutput.scrollTopMax ? logOutput.scrollTopMax : 65535);
}

function buf2hex(buf) {
  const convert = (x) => ('00' + x.toString(16)).slice(-2);

  if (buf instanceof DataView) {
    return Array.prototype.map.call(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength), convert).join('');
  } else if (buf instanceof ArrayBuffer) {
    return Array.prototype.map.call(new Uint8Array(buf), convert).join('');
  } else {
    return Array.prototype.map.call(buf, convert).join('');
  }
}

function buf2asc(buf) {
  const convert = (x) => {
    if (x == 0x5c) {
      return '\\\\';
    } else if (x > 0x1f && x < 0x7f) {
      return String.fromCodePoint(x);
    } else { 
      return '\\x' + ('00' + x.toString(16)).slice(-2);
    }
  }

  if (buf instanceof DataView) {
    return Array.prototype.map.call(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength), convert).join('');
  } else if (buf instanceof ArrayBuffer) {
    return Array.prototype.map.call(new Uint8Array(buf), convert).join('');
  } else {
    return Array.prototype.map.call(buf, convert).join('');
  }
}

function handleBtnDisconnectClick(evt) {
  disconnecting = true;
  bleDevice.gatt.disconnect();
}

async function handleBtnConnectClick(evt) {
  let options = {
    filters: [{
      services: [ UUID_SERVICE ]
    }]
  };

  if (! navigator.bluetooth) {
        alert('The Bluetooth API is not supported in this browser.');
        return;
  }

  try {
    log('Requesting Bluetooth Device...');
    try {
      bleDevice = await navigator.bluetooth.requestDevice(options);
    } catch(e)  {
      if (e instanceof DOMException && e.name == 'NotFoundError') {
        return; // User pressed cancel button, abort
      }
      throw e;
    }

    log('> Name:             ' + bleDevice.name);
    log('> Id:               ' + bleDevice.id);

    bleDevice.addEventListener('gattserverdisconnected', handleBleDisconnected);

    disconnecting = false;
    log('Connecting to GATT Server...');
    document.busyScreen.show('Connecting to ' + bleDevice.name + '...');
    const server = await bleDevice.gatt.connect();

    log('Getting Service...');
    document.busyScreen.setMsg('Getting Service...');
    const service = await server.getPrimaryService(UUID_SERVICE);

    log('Getting Command Characteristic...');
    document.busyScreen.setMsg('Getting Command Characteristic...');
    cmdCharacteristic = await service.getCharacteristic(UUID_CMD);

    log('Getting Notification Characteristic...');
    document.busyScreen.setMsg('Getting Notification Characteristic...');
    notifyCharacteristic = await service.getCharacteristic(UUID_NOTIFY);

    log('Starting notifications...');
    document.busyScreen.setMsg('Starting notifications...');
    notifyCharacteristic.addEventListener('characteristicvaluechanged', handleNotificationChanged);
    await notifyCharacteristic.startNotifications();

    // Get information from device
    await updateInfo();

    // Hide wifi instructions
    document.getElementById('wifiInstructions').classList.add('hidden');

    // Show settings page
    document.getElementById("connectPage").classList.add('hidden');
    document.getElementById("settingsPage").classList.remove('hidden');

    log('Done!');
  } catch(e)  {
    console.log(e);
    alert("Failed to connect to device: " + e);

    if (bleDevice != null && bleDevice.gatt.connected) {
      bleDevice.gatt.disconnect();
    }
  } finally {
    document.busyScreen.hide();
  }
}

async function updateInfo() {
  let response = null;

  // Device Name
  log('Querying Device Name...');
  document.busyScreen.setMsg('Querying Device Name...');
  document.getElementById('inpDeviceName').value = bleDevice.name;

  // Product Version
  log('Querying Product Version...');
  document.busyScreen.setMsg('Querying Product Version...');
  response = await sendCommand(25, {}, true);
  document.getElementById('outProductVersion').value = response.ver;


  // Storage info
  log('Querying Storage Info...');
  document.busyScreen.setMsg('Querying Storage Info...');
  response = await sendCommand(24, {}, true);
  document.getElementById('outStorageTotal').value = parseInt(response.total, 16);
  document.getElementById('outStorageFree').value = parseInt(response.free, 16);

  // Battery info
  log('Querying Battery Info...');
  document.busyScreen.setMsg('Querying Battery Info...');
  response = await sendCommand(27, {}, true);
  setBatteryLevel(parseInt(response.battery));
}

function setBatteryLevel(lvl) {
  const batteryDisplayEl = document.getElementById('batteryDisplay');
  const batteryParts = batteryDisplayEl.getElementsByTagName('SPAN');

  for (let i = 0; i < batteryParts.length; i++) {
    if (i < lvl) {
      batteryParts[i].style.backgroundColor = 'green';
    } else {
      batteryParts[i].style.backgroundColor = 'initial';
    }
  }
}

function handleBleDisconnected(evt) {
  if (!disconnecting) {
    log('The device has disconnected');
    alert('The device has disconnected');
  } else {
    log('Successfully disconnected from device');
    disconnecting = false;
  }

  // Switch back to connect page
  document.getElementById("settingsPage").classList.add('hidden');
  document.getElementById("connectPage").classList.remove('hidden');
}

async function handleNotificationChanged(evt) {
  let respBuf = evt.target.value;
  log('enqueue[' + bleResponseQueue.length + ']: ' + buf2asc(respBuf));

  bleResponseQueue.push(respBuf);

  document.dispatchEvent(new Event(
        "bleNotificationReceived",
        {"bubbles": false, "cancelable": false}
      ));
}

async function handleBtnTakeImageClick(evt) {
  try {
    document.busyScreen.show("Taking image...");
    await sendCommand(14);
  } catch(e)  {
    log('Failed to Take Picture: ' + e);
    alert('Failed to Take Picture: ' + e);
  } finally {
    document.busyScreen.hide();
  }
}

async function handleBtnTimelapseClick(evt) {
  const timelapseButton = document.getElementById('btnTimelapse');
  const recordButton = document.getElementById('btnRecordVideo');
  const photoButton = document.getElementById('btnTakeImage');

  try {
    if (deviceState == 0) {
      document.busyScreen.show("Starting Timelapse...");
      await sendCommand(12);
      timelapseButton.innerText = 'Stop Timelapse';
      photoButton.disabled = recordButton.disabled = true;
      deviceState = 1;
    } else {
      document.busyScreen.show("Stopping Timelapse...");
      await sendCommand(13);
      timelapseButton.innerText = 'Start Timelapse';
      photoButton.disabled = recordButton.disabled = false;
      deviceState = 0;
    }
  } catch(e)  {
    log('Failed to Toggle Timelapse: ' + e);
    alert('Failed to Toggle Timelapse: ' + e);
  } finally {
    document.busyScreen.hide();
  }
}

async function handleBtnRecordVideoClick(evt) {
  const timelapseButton = document.getElementById('btnTimelapse');
  const recordButton = document.getElementById('btnRecordVideo');
  const photoButton = document.getElementById('btnTakeImage');

  try {
    if (deviceState == 0) {
      document.busyScreen.show("Starting Video...");
      await sendCommand(6);
      recordButton.innerText = 'Stop Video';
      photoButton.disabled = timelapseButton.disabled = true;
      deviceState = 1;
    } else {
      document.busyScreen.show("Stopping Video...");
      await sendCommand(7);
      recordButton.innerText = 'Start Video';
      photoButton.disabled = timelapseButton.disabled = false;
      deviceState = 0;
    }
  } catch(e)  {
    log('Failed to Toggle Video Recording: ' + e);
    alert('Failed to Toggle Video Recording: ' + e);
  } finally {
    document.busyScreen.hide();
  }
}

function handleCbEnableDebugClick(evt) {
  const debugDiv = document.getElementById('divDebugItems');
  if (evt.target.checked) {
    debugDiv.classList.remove('hidden');
  } else {
    debugDiv.classList.add('hidden');
  }
}

async function handleBtnRawSend(evt) {
  try {
    document.busyScreen.show("Sending Raw Frame...");
    let argsValue = document.getElementById('inpRawArgs').value;
    if (argsValue.length == 0) {
      argsValue = '{}';
    }

    const cmd = parseInt(document.getElementById('inpRawCmd').value);
    const args = JSON.parse(argsValue);
    const expectResponse = document.getElementById('inpRawResponse').checked;

    await sendCommand(cmd, args, expectResponse);
  } catch(e)  {
    log('Failed to execute Raw Send: ' + e);
    alert('Failed to execute Raw Send: ' + e);
  } finally {
    document.busyScreen.hide();
  }
}

async function handleInpDeviceNameChange(evt) {
  const newName = evt.target.value;
  try {
    document.busyScreen.show("Changing Device Name...");
    await sendCommand(2, {Name: newName});
  } catch(e)  {
    log('Failed to set Device Name: ' + e);
    alert('Failed to set Device Name: ' + e);
  } finally {
    document.busyScreen.hide();
  }
}

async function handleCbAutoRotationChange(evt) {
  const value = evt.target.checked ? "On" : "Off";
  try {
    document.busyScreen.show("Setting Auto Rotation...");
    await sendCommand(1, {AutoRotation: value});
  } catch(e)  {
    log('Failed to set Auto Rotation: ' + e);
    alert('Failed to set Auto Rotation: ' + e);
  } finally {
    document.busyScreen.hide();
  }
}

async function handleSelVideoResChange(evt) {
  const value = evt.target.value;
  try {
    document.busyScreen.show("Setting Video Mode...");
    await sendCommand(4, {VideoMode: value});
  } catch(e)  {
    log('Failed to set Video Resolution: ' + e);
    alert('Failed to set Video Resolution: ' + e);
  } finally {
    document.busyScreen.hide();
  }
}

async function handleSelPhotoResChange(evt) {
  const value = evt.target.value;
  try {
    document.busyScreen.show("Setting Photo Mode...");
    await sendCommand(5, {PhotoMode: value});
  } catch(e)  {
    log('Failed to set Photo Resolution: ' + e);
    alert('Failed to set Photo Resolution: ' + e);
  } finally {
    document.busyScreen.hide();
  }
}

async function handleSelTimelapseIvalChange(evt) {
  const value = evt.target.value;
  try {
    document.busyScreen.show("Setting Timelapse Interval...");
    await sendCommand(11, {second: value});
  } catch(e)  {
    log('Failed to set Timelapse Interval: ' + e);
    alert('Failed to set Timelapse Interval: ' + e);
  } finally {
    document.busyScreen.hide();
  }
}

async function handleBtnSyncTimeClick(evt) {
  try {
    document.busyScreen.show("Synchronizing device clock...");

    // Get time and format as: YYYYmmddHHMMss
    const pad = (n) => (n < 10) ?  '0' + n : n.toString();
    const now = new Date();
    const dateStr = now.getFullYear() +
      pad(now.getMonth() + 1) +
      pad(now.getDate()) +
      pad(now.getHours()) +
      pad(now.getMinutes()) +
      pad(now.getSeconds());

    log("Setting time to: " + dateStr);

    await sendCommand(15, {time: dateStr});
  } catch(e)  {
    log('Failed to set Date/Time: ' + e);
    alert('Failed to set Date/Time: ' + e);
  } finally {
    document.busyScreen.hide();
  }
}

async function handleBtnEnableWifiClick(evt) {
  let resp = null;
  try {
    log("Getting AP info...");
    document.busyScreen.show("Getting AP info...");
    resp = await sendCommand(18, {}, true);
    document.getElementById("outWifiSSID").value = resp.ssid;
    document.getElementById("outWifiPass").value = resp.pwd;

    log("Getting IP address...");
    document.busyScreen.show("Getting IP address...");
    resp = await sendCommand(29, {}, true);
    const lnkEl = document.getElementById("lnkWifiPage");
    lnkEl.innerText = lnkEl.href = 'http://' + resp.ip + '/';

    log("Enabling WiFi...");
    document.busyScreen.show("Enabling WiFi...");
    await sendCommand(22);
    // NOTE: If sending a new command directly after this one, WiFi does not get enabled...

    document.getElementById('wifiInstructions').classList.remove('hidden');
  } catch(e)  {
    log('Failed to Enable WiFi: ' + e);
    alert('Failed to Enable WiFi: ' + e);
  } finally {
    document.busyScreen.hide();
  }
}


function makeCommandFrames(cmd, args) {
  // Generate JSON of command and arguments
  let cmdFields = Object.assign({}, args);
  cmdFields['Type'] = cmd;

  const cmdJSON = JSON.stringify(cmdFields);

  // Get binary buffers of strings
  const cmdBuf = utf8Encoder.encode(cmdJSON);
  const lenBuf = utf8Encoder.encode(cmdBuf.length.toString(16));

  // Calculate checksum
  let chksum = 0;
  for (let b of cmdBuf) {
    chksum += b;
  }
  chksum &= 0xf;

  // Construct frame buffer
  const frameBuf = new Uint8Array(1 + lenBuf.length + cmdBuf.length + 5);
  frameBuf[0] = 0xff;
  frameBuf.set(lenBuf, 1);
  frameBuf.set(cmdBuf, 1 + lenBuf.length);
  frameBuf.set(utf8Encoder.encode("CRC:" + chksum.toString(16)), 1 + lenBuf.length + cmdBuf.length);

  // Split buffer into 20-byte chunks
  let frames = [];
  for (let i=0; i < frameBuf.length; i += MAX_FRAME_SIZE) {
    frames.push(frameBuf.subarray(i, i + MAX_FRAME_SIZE));
  }

  return frames;
}

class BleTimeoutError extends Error {
  constructor(...params) {
    super(...params);

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, BleTimeoutError);
    }
  }
}

async function receiveResponse() {
  while (bleResponseQueue.length == 0) {
    await new Promise(function(resolve, reject) {
        var cancelled = false;

        // Timeout
        var timeoutId = setTimeout(function() {
          cancelled = true;
          reject(new BleTimeoutError("Timeout waiting for BLE response"));
        }, BLE_RESPONSE_TIMEOUT);

        // Event
        document.addEventListener('bleNotificationReceived', function() {
            if (!cancelled) { 
              clearTimeout(timeoutId);
              if (bleResponseQueue.length != 0) {
                resolve();
              }
            }
          }, { once: true });
      });
  }
  return bleResponseQueue.shift();
}

async function sendCommand(cmd, args={}, expectResponse=false) {
  const frames = makeCommandFrames(cmd, args);

  // TODO: Prevent running multiple times simultaniously

  // Clear response queue
  if (bleResponseQueue.length != 0) {
    log("Response queue not empty! clearing");
    bleResponseQueue.length = 0;
  }

  for (let tryCnt = 0; tryCnt < MAX_SEND_RETRY; tryCnt++) {
    try {
      // Send command frames
      for (let frame of frames) {
        log('< ' + buf2asc(frame));
        await cmdCharacteristic.writeValue(frame);

        const response = await receiveResponse();
        log('> ' + buf2asc(response));
        // TODO: verify if ACK
      }
      log("queue cnt: " + bleResponseQueue.length);

      // Get response data
      if (expectResponse) {
        let frame = await receiveResponse();
        log('R> ' + buf2asc(frame));
        if (frame.getUint8(0) != 0xff) {
          throw new Error("Incorrect response!!! (start byte)");
        }

        // Parse frame len
        let frameLen = NaN;
        let jsonOff = 2;
        if (frame.getUint8(2) == 0x7b) { // Check if JSON start('{' at index 2
          jsonOff=2;
          frameLen = parseInt(utf8Decoder.decode(new DataView(frame.buffer, 1, 2)), 16);
        } else if (frame.getUint8(3) == 0x7b) {
          jsonOff=3;
          frameLen = parseInt(utf8Decoder.decode(new DataView(frame.buffer, 1, 3)), 16);
        }
        if (frameLen == NaN) {
          throw new Error("Incorrect response!!!(Frame length)");
        }

        // Get subframes
        let respStr = utf8Decoder.decode(new DataView(frame.buffer, jsonOff));
        while (respStr.length < frameLen + 5) {
          // ACK previous sub frame
          await cmdCharacteristic.writeValue(ackFrame);

          // Receive Next sub frame
          frame = await receiveResponse();
          log('R> ' + buf2asc(frame));
          respStr += utf8Decoder.decode(frame);
        }

        const crcStr = respStr.substring(respStr.length - 5);
        if (!crcStr.startsWith('CRC:')) {
          throw new Error("Incorrect response!!!(CRC-format)");
        }

        // FIXME: ignoring checksum value, since I assume lower level have better
        // checksums... And data isn't available as Uint8Array anymore...

        log('result: ' + respStr.substring(0, respStr.length - 5));
        return JSON.parse(respStr.substring(0, respStr.length - 5));
      } else {
        return {ret:1};
      }
    } catch(e) {
      if (! (e instanceof BleTimeoutError)) {
        throw e;
      } 
      log("Retrying, try " + tryCnt+1);
    }
  }
}

document.getElementById("btnConnect").addEventListener('click', handleBtnConnectClick, false);
document.getElementById("btnDisconnect").addEventListener('click', handleBtnDisconnectClick, false);

document.getElementById("inpDeviceName").addEventListener('change', handleInpDeviceNameChange, false);
document.getElementById("cbAutoRotation").addEventListener('change', handleCbAutoRotationChange, false);
document.getElementById("selPhotoRes").addEventListener('change', handleSelPhotoResChange, false);
document.getElementById("selVideoRes").addEventListener('change', handleSelVideoResChange, false);
document.getElementById("selTimelapseIval").addEventListener('change', handleSelTimelapseIvalChange, false);
document.getElementById("btnSyncTime").addEventListener('click', handleBtnSyncTimeClick, false);

document.getElementById("btnEnableWifi").addEventListener('click', handleBtnEnableWifiClick, false);

document.getElementById("btnTakeImage").addEventListener('click', handleBtnTakeImageClick, false);
document.getElementById("btnTimelapse").addEventListener('click', handleBtnTimelapseClick, false);
document.getElementById("btnRecordVideo").addEventListener('click', handleBtnRecordVideoClick, false);

document.getElementById("cbEnableDebug").addEventListener('click', handleCbEnableDebugClick, false);
document.getElementById("btnRawSend").addEventListener('click', handleBtnRawSend, false);


document.getElementById("frmSettings").reset();
