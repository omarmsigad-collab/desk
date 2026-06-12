const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

let mainWindow;

// Ensure captures folder exists in the app's userData directory
const capturesDir = path.join(app.getPath('userData'), 'captures');
if (!fs.existsSync(capturesDir)) {
  fs.mkdirSync(capturesDir, { recursive: true });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 950,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0F0F1A', // Premium deep dark background
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile('index.html');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', function () {
  if (mainWindow === null) {
    createWindow();
  }
});

// IPC Handler: Screen Capture
ipcMain.handle('capture-screen', async () => {
  try {
    if (mainWindow) {
      mainWindow.hide();
      // Wait for window to disappear completely from the screen
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    const timestamp = Date.now();
    const fileName = `capture_${timestamp}.png`;
    const filePath = path.join(capturesDir, fileName);
    
    // Execute silent screenshot command on macOS
    await new Promise((resolve, reject) => {
      exec(`screencapture -x "${filePath}"`, (error, stdout, stderr) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
    
    // Restore the app window
    if (mainWindow) {
      mainWindow.show();
    }
    
    // Read captured file and convert to base64
    const imageBuffer = fs.readFileSync(filePath);
    const base64 = imageBuffer.toString('base64');
    
    return {
      success: true,
      filePath: filePath,
      base64: base64,
      timestamp: timestamp
    };
  } catch (error) {
    if (mainWindow) {
      mainWindow.show();
    }
    return {
      success: false,
      error: error.message
    };
  }
});

// IPC Handler: Get Active Browser Tab Info
ipcMain.handle('get-active-browser-data', async () => {
  try {
    if (mainWindow) {
      mainWindow.hide();
      // Wait for focus to return to the previously active application
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    
    const appleScript = `
      tell application "System Events"
          set frontmostApp to name of first application process whose frontmost is true
      end tell

      if frontmostApp is "Google Chrome" then
          tell application "Google Chrome"
              set activeUrl to URL of active tab of front window
              set activeTitle to title of active tab of front window
              return "Chrome|" & activeTitle & "|" & activeUrl
          end tell
      else if frontmostApp is "Safari" then
          tell application "Safari"
              set activeUrl to URL of front document
              set activeTitle to name of front document
              return "Safari|" & activeTitle & "|" & activeUrl
          end tell
      else
          return "Error: Frontmost app is " & frontmostApp & ", which is not Safari or Chrome."
      end if
    `;
    
    // Execute AppleScript using osascript
    const result = await new Promise((resolve, reject) => {
      exec(`osascript -e ${JSON.stringify(appleScript)}`, (error, stdout, stderr) => {
        if (error) {
          reject(error);
        } else {
          resolve(stdout.trim());
        }
      });
    });
    
    // Restore the app window
    if (mainWindow) {
      mainWindow.show();
    }
    
    if (result.startsWith('Error:')) {
      return {
        success: false,
        error: result
      };
    }
    
    const parts = result.split('|');
    if (parts.length < 3) {
      return {
        success: false,
        error: "Malformed AppleScript response: " + result
      };
    }

    const [browser, title, url] = parts;
    return {
      success: true,
      browser,
      title,
      url,
      timestamp: Date.now()
    };
  } catch (error) {
    if (mainWindow) {
      mainWindow.show();
    }
    return {
      success: false,
      error: error.message
    };
  }
});

// IPC Handler: Read Local Image File
ipcMain.handle('read-screenshot-file', async (event, filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      const buffer = fs.readFileSync(filePath);
      return {
        success: true,
        base64: buffer.toString('base64')
      };
    } else {
      return {
        success: false,
        error: 'File not found on disk: ' + filePath
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});

// IPC Handler: Get paths
ipcMain.handle('get-app-paths', async () => {
  return {
    userData: app.getPath('userData'),
    captures: capturesDir
  };
});

// IPC Handler: Fetch URL HTML content bypass CORS
ipcMain.handle('fetch-url', async (event, url) => {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const html = await response.text();
    return {
      success: true,
      html: html
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});
