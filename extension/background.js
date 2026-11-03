importScripts("config.js");

function saveReportStatus(message) {
  chrome.storage.local.set({ dcLastReportStatus: message });
}

function readError(response, fallback) {
  return response.json().catch(function() {
    return {};
  }).then(function(body) {
    var detail = body && (body.detail || body.message || body.msg);
    return typeof detail === "string" ? detail : fallback;
  });
}

function refreshSession(session) {
  if (!DC_CONFIG.SUPABASE_URL || !DC_CONFIG.SUPABASE_ANON_KEY || !session.refresh_token) {
    return Promise.reject(new Error("Sign in again to resume report sharing."));
  }
  return fetch(DC_CONFIG.SUPABASE_URL.replace(/\/+$/, "") + "/auth/v1/token?grant_type=refresh_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: DC_CONFIG.SUPABASE_ANON_KEY
    },
    body: JSON.stringify({ refresh_token: session.refresh_token })
  }).then(function(response) {
    if (!response.ok) {
      return readError(response, "Sign in again to resume report sharing.")
        .then(function(message) { throw new Error(message); });
    }
    return response.json();
  }).then(function(result) {
    var updatedSession = {
      access_token: result.access_token,
      refresh_token: result.refresh_token,
      expires_at: Date.now() + (Number(result.expires_in) || 3600) * 1000,
      user: result.user
    };
    return new Promise(function(resolve, reject) {
      chrome.storage.local.set({ dcSession: updatedSession }, function() {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else resolve(updatedSession);
      });
    });
  });
}

function submitReport(message, session, retried) {
  if (!DC_CONFIG.BACKEND_API_URL) {
    return Promise.reject(new Error("Report sharing is not configured for this installation."));
  }
  return fetch(DC_CONFIG.BACKEND_API_URL.replace(/\/+$/, "") + "/api/report", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + session.access_token
    },
    body: JSON.stringify({
      site_url: message.url,
      patterns: message.reportResults,
      confirmed: false
    })
  }).then(function(response) {
    if (response.status === 401 && !retried) {
      return refreshSession(session).then(function(updatedSession) {
        return submitReport(message, updatedSession, true);
      });
    }
    if (!response.ok) {
      return readError(response, "Report could not be saved (HTTP " + response.status + ").")
        .then(function(error) { throw new Error(error); });
    }
    return response.json();
  });
}

function reportIfEnabled(message) {
  if (!Array.isArray(message.reportResults) || message.reportResults.length === 0) return;
  chrome.storage.local.get(["analyticsConsent", "dcSession"], function(settings) {
    if (chrome.runtime.lastError) {
      console.error("Could not read report-sharing settings.", chrome.runtime.lastError.message);
      saveReportStatus("Could not read report-sharing settings.");
      return;
    }
    if (settings.analyticsConsent !== true) return;
    if (!settings.dcSession || !settings.dcSession.access_token) {
      saveReportStatus("Sign in to your account to share detected patterns.");
      return;
    }
    submitReport(message, settings.dcSession, false).then(function() {
      saveReportStatus("");
    }).catch(function(error) {
      if (error instanceof Error && error.message.indexOf("Sign in again") === 0) {
        chrome.storage.local.set({ dcSession: null });
      }
      saveReportStatus(error instanceof Error ? error.message : "Report could not be saved.");
    });
  });
}

chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  if (message.type === "DETECTION_RESULTS") {
    var tabId = sender.tab ? sender.tab.id : null;
    if (!tabId) { sendResponse({ ok: false }); return false; }
    var count = message.results ? message.results.length : 0;
    
    Promise.all([
      chrome.action.setBadgeText({ text: count > 0 ? String(count) : "", tabId: tabId }),
      chrome.action.setBadgeBackgroundColor({ color: count > 0 ? "#7C3AED" : "#10B981", tabId: tabId })
    ]).catch(function(error) {
      console.error("Could not update the extension badge.", error);
    });
    
    var obj = {}; obj["tab_" + tabId] = message.results;
    chrome.storage.session.set(obj).then(function() {
      sendResponse({ ok: true });
    }).catch(function(error) {
      console.error("Could not save detection results.", error);
      sendResponse({ ok: false, error: "Could not save detection results." });
    });
    reportIfEnabled(message);
    return true;
  }
  if (message.type === "GET_RESULTS") {
    chrome.tabs.query({ active: true, currentWindow: true }).then(function(tabs) {
      if (!tabs || !tabs[0]) {
        sendResponse({ error: "No active tab is available." });
        return;
      }
      var key = "tab_" + tabs[0].id;
      chrome.storage.session.get(key).then(function(data) {
        sendResponse(data[key] || []);
      }).catch(function(error) {
        console.error("Could not load detection results.", error);
        sendResponse({ error: "Could not load detection results." });
      });
    }).catch(function(error) {
      console.error("Could not find the active tab.", error);
      sendResponse({ error: "Could not find the active tab." });
    });
    return true;
  }
});
chrome.tabs.onRemoved.addListener(function(tabId) {
  chrome.storage.session.remove("tab_" + tabId).catch(function(error) {
    console.error("Could not clear closed-tab results.", error);
  });
});
