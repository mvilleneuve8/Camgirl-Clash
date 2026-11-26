// Preload bridge kept minimal — game is a static web UI.
const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("desktopApp", {
  platform: process.platform,
});
