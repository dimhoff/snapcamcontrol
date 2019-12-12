# Control for iON SnapCam™
This web app lets you control your iON SnapCam™ from your browser.

Some of the features of iON SnapCam™ are controlled through Bluetooth using an app.
However the official app for Android is kicked out of the Play store. iON
suggests on its web page to side load the app. But I don't see side loading an
app that has been kicked out of the Play store as a serious option. I assume
there was a reason to kick it out of (or be denied from?) the Play store.

So I decided to write my own web app to control the SnapCam™.

(*SnapCam is a trademark of World Wide Licenses Limited*)

# Status
This is works-for-me™ code. If it doesn't work you'll have to fix it yourself.

# Requirements
You'll need a browser that supports the Web Bluetooth API. Currently only
Google Chrome and Opera do, on MacOS, Windows 10 and Android.

For up to date information about browser support for the Web Bluetooth API see:
https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API#Browser_compatibility

The Web Bluetooth API also requires the page to be served on a HTTPS connection
or locally.

# Usage
1. Open the [snapcamcontrol.html](https://dimhoff.github.io/snapcamcontrol.html)
2. Push the "Connect to SnapCam™" button
3. Select the device to connect to
4. The device will be connected an you'll see a settings screen

# Factory resetting
If somehow the settings get seriously messed up. Then the settings can be reset
by pressing the power button very long when the device is enabled.

# Known limitations
The protocol used by the SnapCam™ on top of Bluetooth is a bit quirky. So sometimes
commands fail or the device disappears from Bluetooth.

Web Bluetooth API is experimental technology.

I haven't found a way to obtain the current settings from the device. So the
settings you'll see after connecting to the device might not be the actual
settings of the device.

I haven't found a way to obtain the current mode(i.e. 'idle', 'filming',
'timelapse') from the device. So if the device is already taking a timelapse
when connecting to it you'll still have to press the 'start timelapse' button
first to be able to stop it.

The Bluetooth interface is to slow to constantly poll the device information.
So the storage and battery indicators aren't updated in real time.

The device can also be configured as WiFi station instead of AP through the 
'/setting/setsta/' and '/setting/setrun/' pages on WiFi. But I haven't been
able to get this to actually work.

It is not possible to stream live video. Video streaming is done through the
RTSP protocol. This protocol is not natively supported by the major browsers.
Also the implementation seems too broken, to get it to work with mplayer.
