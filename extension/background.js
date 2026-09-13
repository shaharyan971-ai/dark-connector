chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  if (message.type === "DETECTION_RESULTS") {
    var tabId = sender.tab ? sender.tab.id : null;
    if (!tabId) { sendResponse({ ok: false }); return false; }
    var count = message.results ? message.results.length : 0;
    
    try {
      chrome.action.setBadgeText({ text: count > 0 ? String(count) : "", tabId: tabId });
      chrome.action.setBadgeBackgroundColor({ color: count > 0 ? "#FF3B3B" : "#10B981", tabId: tabId });
    } catch(e) {}
    
    var obj = {}; obj["tab_" + tabId] = message.results;
    chrome.storage.session.set(obj);
    sendResponse({ ok: true });
    return false;
  }
  if (message.type === "GET_RESULTS") {
    chrome.tabs.query({ active: true, currentWindow: true }).then(function(tabs) {
      if (!tabs || !tabs[0]) { sendResponse([]); return; }
      chrome.storage.session.get("tab_" + tabs[0].id, function(data) {
        sendResponse(data["tab_" + tabs[0].id] || []);
      });
    }).catch(function() { sendResponse([]); });
    return true;
  }
});
chrome.tabs.onRemoved.addListener(function(tabId) {
  chrome.storage.session.remove("tab_" + tabId);
});
