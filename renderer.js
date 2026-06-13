// renderer.js - Frontend controller for One Click

// DOM Elements
const modeScreen = document.getElementById('mode-screen');
const modeWebsite = document.getElementById('mode-website');
const captureBtn = document.getElementById('capture-btn');
const settingsBtn = document.getElementById('settings-btn');
const closeSettingsBtn = document.getElementById('close-settings-btn');
const saveSettingsBtn = document.getElementById('save-settings-btn');
const clearHistoryBtn = document.getElementById('clear-history-btn');

const settingsModal = document.getElementById('settings-modal');
const geminiApiKeyInput = document.getElementById('gemini-api-key');
const geminiModelSelect = document.getElementById('gemini-model-select');

const statusDot = document.querySelector('.status-dot');
const statusText = document.getElementById('status-text');

const resultsPanel = document.getElementById('results-panel');
const contentTypeBadge = document.getElementById('content-type-badge');
const resultTimestamp = document.getElementById('result-timestamp');
const sourceLinkContainer = document.getElementById('source-link-container');
const resultSourceUrl = document.getElementById('result-source-url');
const summaryText = document.getElementById('summary-text');
const keyPointsList = document.getElementById('key-points-list');
const actionItemsList = document.getElementById('action-items-list');
const importantDetailsList = document.getElementById('important-details-list');
const screenshotPreviewContainer = document.getElementById('screenshot-preview-container');
const resultScreenshotImg = document.getElementById('result-screenshot-img');

const historyList = document.getElementById('history-list');

// State Variables
let currentLogs = [];
let appPaths = null;

// App Initialization
document.addEventListener('DOMContentLoaded', async () => {
  // Load Configurations
  loadSettings();

  // Load History
  loadHistory();

  // Fetch App Paths from main process
  try {
    appPaths = await window.api.getAppPaths();
    console.log('App Paths:', appPaths);
  } catch (err) {
    console.error('Failed to get app paths:', err);
  }

  // Event Listeners
  settingsBtn.addEventListener('click', openSettings);
  closeSettingsBtn.addEventListener('click', closeSettings);
  saveSettingsBtn.addEventListener('click', saveSettings);
  clearHistoryBtn.addEventListener('click', clearHistory);
  captureBtn.addEventListener('click', handleCapture);

  // Close modal when clicking outside card
  settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
      closeSettings();
    }
  });
});

// --- Settings Logic ---

function loadSettings() {
  const apiKey = localStorage.getItem('gemini_api_key') || '';
  const model = localStorage.getItem('gemini_model') || 'gemini-2.5-flash';
  
  geminiApiKeyInput.value = apiKey;
  geminiModelSelect.value = model;

  if (!apiKey) {
    updateStatus('error', 'API Key Missing');
    setTimeout(() => {
      openSettings();
    }, 500);
  } else {
    updateStatus('ready', 'Ready');
  }
}

function openSettings() {
  settingsModal.classList.remove('hidden');
}

function closeSettings() {
  settingsModal.classList.add('hidden');
}

function saveSettings() {
  const apiKey = geminiApiKeyInput.value.trim();
  const model = geminiModelSelect.value;

  localStorage.setItem('gemini_api_key', apiKey);
  localStorage.setItem('gemini_model', model);

  closeSettings();

  if (apiKey) {
    updateStatus('ready', 'Ready');
  } else {
    updateStatus('error', 'API Key Missing');
  }
}

// --- UI Helper Logic ---

function updateStatus(state, message) {
  statusText.textContent = message;
  
  statusDot.className = 'status-dot'; // Reset class
  if (state === 'ready') {
    statusDot.classList.add('status-ready');
  } else if (state === 'loading') {
    statusDot.classList.add('status-loading');
  } else if (state === 'error') {
    statusDot.classList.add('status-error');
  }
}

function setUILoading(isLoading) {
  if (isLoading) {
    captureBtn.classList.add('loading');
    modeScreen.disabled = true;
    modeWebsite.disabled = true;
    clearHistoryBtn.disabled = true;
  } else {
    captureBtn.classList.remove('loading');
    modeScreen.disabled = false;
    modeWebsite.disabled = false;
    clearHistoryBtn.disabled = false;
  }
}

// --- Capture and Analysis Engine ---

async function handleCapture() {
  const apiKey = localStorage.getItem('gemini_api_key');
  if (!apiKey) {
    alert('Please enter your Gemini API Key in the Settings first!');
    openSettings();
    return;
  }

  const mode = document.querySelector('input[name="capture-mode"]:checked').value;
  setUILoading(true);

  try {
    if (mode === 'screen') {
      updateStatus('loading', 'Capturing Screen...');
      const response = await window.api.captureScreen();
      
      if (!response.success) {
        throw new Error('Screen capture failed: ' + response.error);
      }

      updateStatus('loading', 'Analyzing Screenshot...');
      await analyzeScreenshot(response.base64, response.filePath, response.timestamp);
    } else {
      updateStatus('loading', 'Querying Active Browser...');
      const browserResponse = await window.api.getActiveBrowserData();
      
      if (!browserResponse.success) {
        throw new Error(browserResponse.error || 'Failed to detect active Safari or Chrome window.');
      }

      const { browser, title, url, timestamp } = browserResponse;
      updateStatus('loading', `Extracting content from ${browser}...`);

      let webpageText = '';
      let fetchSuccess = false;

      // Try to fetch HTML content of the webpage through backend to avoid CORS
      if (url && !url.startsWith('chrome://') && !url.startsWith('file://') && !url.startsWith('about:')) {
        try {
          const fetchResponse = await window.api.fetchUrl(url);
          if (fetchResponse.success) {
            webpageText = cleanHtml(fetchResponse.html);
            fetchSuccess = true;
          }
        } catch (fetchErr) {
          console.warn('Failed to fetch HTML content directly:', fetchErr);
        }
      }

      updateStatus('loading', 'Analyzing Webpage...');
      await analyzeWebpage(title, url, webpageText, fetchSuccess, timestamp);
    }
  } catch (error) {
    console.error('Error during capture:', error);
    updateStatus('error', error.message);
    alert(error.message);
  } finally {
    setUILoading(false);
  }
}

// Strip HTML code and extract clean, readable text
function cleanHtml(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  // Remove scripts, stylesheets, nav elements, footers, headers
  const uselessTags = doc.querySelectorAll('script, style, svg, nav, header, footer, iframe, noscript, dialog');
  uselessTags.forEach(tag => tag.remove());
  
  let text = doc.body ? doc.body.innerText : doc.documentElement.innerText;
  
  // Clean whitespace formatting
  text = text.replace(/\s+/g, ' ').trim();
  
  // Return the first 16,000 characters to stay within reasonable prompt sizes
  return text.substring(0, 16000);
}

// --- Gemini API Calls ---

const GEMINI_JSON_SCHEMA = {
  type: "OBJECT",
  properties: {
    contentType: {
      type: "STRING",
      description: "Automatically detected content type. Must be exactly one of: 'article', 'homework', 'email', 'documentation', or 'other'."
    },
    summary: {
      type: "STRING",
      description: "A short summary (2 to 5 sentences) outlining the core content."
    },
    keyPoints: {
      type: "ARRAY",
      items: { type: "STRING" },
      description: "3 to 5 key bullet points or primary concepts."
    },
    actionItems: {
      type: "ARRAY",
      items: { type: "STRING" },
      description: "List of tasks, checklist items, or required actions (e.g. reply to person, solve problem). Empty array if there are no action items."
    },
    importantDetails: {
      type: "ARRAY",
      items: { type: "STRING" },
      description: "Critical details like dates, deadlines, phone numbers, email addresses, pricing, or instructions."
    }
  },
  required: ["contentType", "summary", "keyPoints", "actionItems", "importantDetails"]
};

async function queryGemini(payload) {
  const apiKey = localStorage.getItem('gemini_api_key');
  const model = localStorage.getItem('gemini_model') || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  // Configure for structured JSON output
  payload.generationConfig = {
    responseMimeType: "application/json",
    responseSchema: GEMINI_JSON_SCHEMA
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || `Gemini API returned HTTP status ${response.status}`);
  }

  const result = await response.json();
  const textResponse = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textResponse) {
    throw new Error('Empty response from Gemini API.');
  }

  return JSON.parse(textResponse);
}

async function analyzeScreenshot(base64Image, filePath, timestamp) {
  const promptText = `Analyze the provided screenshot of the user's screen.
  
  First, identify the context and classify the content.
  - If it is an article or blog post: classify as 'article', focus heavily on key insights.
  - If it shows assignment questions, quiz, study portal: classify as 'homework', extract deadlines and tasks.
  - If it shows an email inbox or specific email thread: classify as 'email', summarize the thread and extract actions needed.
  - If it shows coding IDE, API reference, developer docs: classify as 'documentation', explain technical details.
  - Otherwise, classify as 'other'.

  Make sure to fill out the JSON fields correctly. Ensure action items are concise.`;

  const payload = {
    contents: [
      {
        parts: [
          { text: promptText },
          {
            inlineData: {
              mimeType: "image/png",
              data: base64Image
            }
          }
        ]
      }
    ]
  };

  const analysisResult = await queryGemini(payload);
  
  // Save to History Log (don't save base64 in localStorage to keep it small, save filePath instead)
  saveHistoryItem({
    id: 'capture_' + timestamp,
    timestamp: timestamp,
    mode: 'screen',
    title: 'Screen Capture',
    url: null,
    filePath: filePath,
    analysis: analysisResult
  });

  // Display results
  displayResult(analysisResult, timestamp, { mode: 'screen', base64: base64Image });
  updateStatus('ready', 'Analysis Complete');
}

async function analyzeWebpage(title, webpageUrl, cleanText, fetchSuccess, timestamp) {
  let promptText = `Analyze the provided webpage.
  Webpage Title: "${title}"
  Webpage URL: "${webpageUrl}"\n\n`;

  if (fetchSuccess) {
    promptText += `Webpage Content:\n${cleanText}\n\n`;
  } else {
    promptText += `Note: The text content of this page could not be scraped directly. (This might be a private webpage, local app, or require authentication).\n\n`;
  }

  promptText += `Classify and analyze the page based on the title, URL, and any available content.
  - If it is an article/blog: classify as 'article', focus on key insights.
  - If it shows assignment portal, educational page: classify as 'homework', extract tasks/deadlines.
  - If it is an email app (Gmail, etc.): classify as 'email', extract required actions.
  - If it shows developer docs/GitHub/code: classify as 'documentation', explain technical details.
  - Otherwise: classify as 'other'.
  
  If the page is private and content is empty, describe that this is a private page in the summary, and suggest the user use Screen Mode to analyze the visual content. Ensure to return a valid JSON structure.`;

  const payload = {
    contents: [
      {
        parts: [
          { text: promptText }
        ]
      }
    ]
  };

  const analysisResult = await queryGemini(payload);

  saveHistoryItem({
    id: 'capture_' + timestamp,
    timestamp: timestamp,
    mode: 'website',
    title: title || 'Webpage Capture',
    url: webpageUrl,
    filePath: null,
    analysis: analysisResult
  });

  displayResult(analysisResult, timestamp, { mode: 'website', url: webpageUrl });
  updateStatus('ready', 'Analysis Complete');
}

// --- Result Rendering ---

function displayResult(analysis, timestamp, mediaSource) {
  resultsPanel.classList.remove('hidden');

  // Format Content Type Badge
  contentTypeBadge.className = 'badge';
  const type = analysis.contentType.toLowerCase();
  contentTypeBadge.classList.add(`badge-${type}`);
  contentTypeBadge.textContent = analysis.contentType;

  // Format Timestamp
  const date = new Date(timestamp);
  resultTimestamp.textContent = date.toLocaleString();

  // Source URL Link
  if (mediaSource.mode === 'website' && mediaSource.url) {
    sourceLinkContainer.classList.remove('hidden');
    resultSourceUrl.href = mediaSource.url;
    resultSourceUrl.textContent = mediaSource.url.substring(0, 45) + (mediaSource.url.length > 45 ? '...' : '');
  } else {
    sourceLinkContainer.classList.add('hidden');
  }

  // Summary
  summaryText.textContent = analysis.summary;

  // Key Takeaways List
  keyPointsList.innerHTML = '';
  if (analysis.keyPoints && analysis.keyPoints.length > 0) {
    analysis.keyPoints.forEach(point => {
      const li = document.createElement('li');
      li.textContent = point;
      keyPointsList.appendChild(li);
    });
  } else {
    keyPointsList.innerHTML = '<li>No major points extracted.</li>';
  }

  // Action Items List
  actionItemsList.innerHTML = '';
  if (analysis.actionItems && analysis.actionItems.length > 0 && analysis.actionItems[0] !== 'None') {
    analysis.actionItems.forEach((item, index) => {
      const li = document.createElement('li');
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = `task-${index}`;
      
      const span = document.createElement('span');
      span.textContent = item;

      li.appendChild(checkbox);
      li.appendChild(span);
      
      // Allow clicking text to toggle checkbox
      li.addEventListener('click', (e) => {
        if (e.target !== checkbox) {
          checkbox.checked = !checkbox.checked;
        }
      });

      actionItemsList.appendChild(li);
    });
  } else {
    actionItemsList.innerHTML = '<li class="no-actions">No action items found.</li>';
  }

  // Important Details List
  importantDetailsList.innerHTML = '';
  if (analysis.importantDetails && analysis.importantDetails.length > 0) {
    analysis.importantDetails.forEach(detail => {
      const li = document.createElement('li');
      li.textContent = detail;
      importantDetailsList.appendChild(li);
    });
  } else {
    importantDetailsList.innerHTML = '<li>No critical numbers, dates, or specifications listed.</li>';
  }

  // Screenshot Reference
  if (mediaSource.mode === 'screen') {
    screenshotPreviewContainer.classList.remove('hidden');
    if (mediaSource.base64) {
      resultScreenshotImg.src = `data:image/png;base64,${mediaSource.base64}`;
    } else if (mediaSource.filePath) {
      // Load on demand from main process
      loadScreenshotOnDemand(mediaSource.filePath);
    }
  } else {
    screenshotPreviewContainer.classList.add('hidden');
    resultScreenshotImg.src = '';
  }

  // Auto scroll result panel into view
  resultsPanel.scrollIntoView({ behavior: 'smooth' });
}

async function loadScreenshotOnDemand(filePath) {
  resultScreenshotImg.src = ''; // Clear old image
  try {
    const response = await window.api.readScreenshotFile(filePath);
    if (response.success) {
      resultScreenshotImg.src = `data:image/png;base64,${response.base64}`;
    } else {
      console.error('Failed to read image file:', response.error);
    }
  } catch (err) {
    console.error('Error reading screenshot file:', err);
  }
}

// --- History Log Management ---

function loadHistory() {
  const rawLogs = localStorage.getItem('insight_history_logs');
  currentLogs = rawLogs ? JSON.parse(rawLogs) : [];
  renderHistoryList();
}

function saveHistoryItem(item) {
  currentLogs.unshift(item);
  localStorage.setItem('insight_history_logs', JSON.stringify(currentLogs));
  renderHistoryList();
}

function renderHistoryList() {
  historyList.innerHTML = '';

  if (currentLogs.length === 0) {
    historyList.innerHTML = `
      <div class="no-history">
        <p>No captures yet.</p>
        <span>Your 1-click captures will appear here.</span>
      </div>
    `;
    return;
  }

  currentLogs.forEach(log => {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'history-item';
    itemDiv.dataset.id = log.id;

    // Get Content Type Icon emoji
    let emoji = '🔍';
    const type = log.analysis.contentType.toLowerCase();
    if (type === 'article') emoji = '📄';
    else if (type === 'homework') emoji = '📝';
    else if (type === 'email') emoji = '✉️';
    else if (type === 'documentation') emoji = '💻';

    const date = new Date(log.timestamp);
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    itemDiv.innerHTML = `
      <div class="history-item-header">
        <span class="history-item-title">${emoji} ${log.title}</span>
        <span class="history-item-time">${timeStr}</span>
      </div>
      <div class="history-item-preview">${log.analysis.summary}</div>
    `;

    itemDiv.addEventListener('click', () => {
      // Highlight selected history item
      document.querySelectorAll('.history-item').forEach(el => el.classList.remove('active'));
      itemDiv.classList.add('active');
      
      // Load selected capture into the result viewer
      if (log.mode === 'screen') {
        displayResult(log.analysis, log.timestamp, { mode: 'screen', filePath: log.filePath });
      } else {
        displayResult(log.analysis, log.timestamp, { mode: 'website', url: log.url });
      }
    });

    historyList.appendChild(itemDiv);
  });
}

function clearHistory() {
  if (currentLogs.length === 0) return;

  const confirmClear = confirm('Are you sure you want to clear all history records? This cannot be undone.');
  if (confirmClear) {
    currentLogs = [];
    localStorage.setItem('insight_history_logs', JSON.stringify([]));
    renderHistoryList();
    
    // Hide results panel
    resultsPanel.classList.add('hidden');
    updateStatus('ready', 'History cleared');
  }
}
