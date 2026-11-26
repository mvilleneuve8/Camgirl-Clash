const { app, BrowserWindow } = require("electron");
const path = require("node:path");

const isDev = !app.isPackaged;

function resolveAppIcon() {
  const candidates = [
    path.join(__dirname, "..", "build", "icon.png"),
    path.join(__dirname, "..", "build", "icon.ico"),
  ];
  return candidates.find((p) => {
    try {
      return require("node:fs").existsSync(p);
    } catch {
      return false;
    }
  });
}

function createWindow() {
  const icon = resolveAppIcon();
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    title: "Jerkmate Camgirl Clash",
    autoHideMenuBar: true,
    ...(icon ? { icon } : {}),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    win.loadURL("http://localhost:5173");
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    // loadFile keeps relative asset URLs (./battle-board.png) resolving inside dist/.
    win.loadFile(path.join(__dirname, "..", "web", "index.html"));
  }

  win.webContents.on("did-fail-load", (_e, code, desc, url) => {
    console.error("Failed to load", { code, desc, url });
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
