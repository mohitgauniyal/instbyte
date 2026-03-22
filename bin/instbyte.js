#!/usr/bin/env node

"use strict";

const path = require("path");
const fs = require("fs");

// ========================
// DATA DIRECTORY SETUP
// ========================
// When run via npx or global install, we want data to live
// in the user's current working directory, not inside the
// npm cache or global node_modules.
//
// When run via Docker, INSTBYTE_DATA and INSTBYTE_UPLOADS may
// already be set via environment variables — respect those and
// don't override them.

if (!process.env.INSTBYTE_DATA) {
    process.env.INSTBYTE_DATA = path.join(process.cwd(), "instbyte-data");
}

if (!process.env.INSTBYTE_UPLOADS) {
    process.env.INSTBYTE_UPLOADS = path.join(process.env.INSTBYTE_DATA, "uploads");
}

const dataDir = process.env.INSTBYTE_DATA;
const uploadsDir = process.env.INSTBYTE_UPLOADS;

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// ========================
// BOOT
// ========================
process.env.INSTBYTE_BOOT = '1';
require("../server/server.js");