/**
 * busy_screen.js - Fullscreen busy waiting screen
 *
 * Copyright (c) 2019 David Imhoff <dimhoff.devel <at> gmail.com>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
"use strict";

/**
 * Add busy screen functionality to page
 *
 * Adds necessary elements to document and add document.busyScreen object.
 */
function busyScreenInit() {
  if (document.getElementById("busyScreen")) {
    throw new Error("It is only possible to construct one BusyScreen per document");
  }

  // Build busySpinner with cascade of 4 div's
  let busySpinnerEl = document.createElement("DIV");
  for (let i=0; i<4; i++) {
    let parentEl = document.createElement("DIV");
    parentEl.appendChild(busySpinnerEl);
    busySpinnerEl = parentEl;
  }
  busySpinnerEl.id = 'busySpinner';

  // Text Message element
  let busyMsgTxtEl = document.createElement("SPAN");
  busyMsgTxtEl.id = "busyMsgTxt";

  // Message element
  let busyMsgEl = document.createElement("DIV");
  busyMsgEl.id = "busyMsg";
  busyMsgEl.appendChild(busyMsgTxtEl);

  // Vertical centration box
  let centerBoxEl = document.createElement("DIV");
  centerBoxEl.appendChild(busySpinnerEl);
  centerBoxEl.appendChild(busyMsgEl);

  // The fullscreen overlay
  let busyScreenEl = document.createElement("DIV");
  busyScreenEl.id = "busyScreen";
  busyScreenEl.style.display = 'none';
  busyScreenEl.appendChild(centerBoxEl);

  // Add to document
  document.body.appendChild(busyScreenEl);

  // Add to document object
  document.busyScreen = {
    show: function(msg='') {
      busyMsgTxtEl.innerText = msg;
      busyScreenEl.style.display = 'block';
    },
    setMsg: function(msg) {
      busyMsgTxtEl.innerText = msg;
    },
    hide: function(msg='') {
      busyScreenEl.style.display = 'none';
    }
  };
}
