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

const dataDir = path.join(process.cwd(), "instbyte-data");
const uploadsDir = path.join(dataDir, "uploads");

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Pass locations to the rest of the app via env vars
process.env.INSTBYTE_DATA = dataDir;
process.env.INSTBYTE_UPLOADS = uploadsDir;

// ========================
// BOOT
// ========================
require("../server/server.js");