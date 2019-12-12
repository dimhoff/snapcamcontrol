#!/bin/sh
# compile_single_page_sh - Merge all parts into a single file HTML document and
#                          minimize page size.
#
# Requirements:
#  - [inliner](https://github.com/remy/inliner)
#  - [terser](https://github.com/terser-js/terser)
#
# Copyright (c) 2019 David Imhoff <dimhoff.devel <at> gmail.com>
# 
# Permission is hereby granted, free of charge, to any person obtaining a copy
# of this software and associated documentation files (the "Software"), to deal
# in the Software without restriction, including without limitation the rights
# to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
# copies of the Software, and to permit persons to whom the Software is
# furnished to do so, subject to the following conditions:
# 
# The above copyright notice and this permission notice shall be included in
# all copies or substantial portions of the Software.
# 
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
# IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
# FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
# AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
# LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
# OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
# SOFTWARE.
TERSER=/tmp/node_modules/.bin/terser
INLINER=/tmp/node_modules/.bin/inliner

# Install required packages:
#  > mkdir /tmp/node_modules/
#  > cd /tmp/node_modules/
#  > npm install terser@3.14.1 inliner

cleanup() {
	if [ -d "$OUTDIR" ]; then
		rm -f "$OUTDIR"/*
		rmdir "$OUTDIR"
	fi
}

OUTDIR=`mktemp -d `
if [ ! -d "$OUTDIR" ]; then
	echo "Failed to make temporary directory"
	exit 1
fi

trap cleanup EXIT

"$TERSER" snapcamcontrol.js > "$OUTDIR"/snapcamcontrol.js
"$TERSER" busy_screen.js > "$OUTDIR"/busy_screen.js
cp busy_screen.css "$OUTDIR"
cp snapcamcontrol.html "$OUTDIR"

cd "$OUTDIR"
"$INLINER" --preserve-comments snapcamcontrol.html > snapcamcontrol-compiled.html

cd -
cp "$OUTDIR"/snapcamcontrol-compiled.html .
