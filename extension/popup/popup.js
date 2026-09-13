var PATTERN_LABELS = {
  fake_urgency: "Fake Urgency",
  confirmshaming: "Confirmshaming",
  pre_ticked_checkbox: "Pre-ticked Checkbox",
  visual_interference: "Visual Interference",
  social_proof_manipulation: "Fake Social Proof",
  privacy_zuckering: "Hidden Tracker",
  fake_countdown: "Fake Countdown"
};

var content = document.getElementById("content");
var status = document.getElementById("status");

function setStatus(value) {
  status.textContent = value;
}

function clearContent() {
  while (content.firstChild) {
    content.removeChild(content.firstChild);
  }
}

function createButton(label, className, handler) {
  var button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.className = className;
  button.addEventListener("click", handler);
  return button;
}

function showConsent() {
  clearContent();
  setStatus("CONSENT NEEDED");

  var panel = document.createElement("div");
  panel.className = "panel";

  var heading = document.createElement("h2");
  heading.textContent = "Enable analytics?";
  panel.appendChild(heading);

  var description = document.createElement("p");
  description.className = "muted";
  description.textContent = "Share detected pattern reports to improve Dark Connector. You can change this later in extension settings.";
  panel.appendChild(description);

  var actions = document.createElement("div");
  actions.className = "actions";
  actions.appendChild(createButton("Allow", "primary", function() {
    chrome.storage.local.set({ analyticsConsent: true }, loadPopup);
  }));
  actions.appendChild(createButton("No thanks", "", function() {
    chrome.storage.local.set({ analyticsConsent: false }, loadPopup);
  }));
  panel.appendChild(actions);
  content.appendChild(panel);
}

function showCleanPage() {
  clearContent();
  setStatus("NO FLAGS");

  var panel = document.createElement("div");
  panel.className = "panel clean";
  panel.textContent = "✅ Clean page";
  content.appendChild(panel);
}

function sendPatternAction(type, pattern) {
  chrome.runtime.sendMessage({
    type: type,
    pattern: pattern.pattern,
    confidence: pattern.confidence,
    message: pattern.message || PATTERN_LABELS[pattern.pattern] || pattern.pattern
  });
}

function showPatterns(results) {
  clearContent();
  setStatus(results.length + " FLAG" + (results.length === 1 ? "" : "S"));

  var list = document.createElement("div");
  list.className = "pattern-list";

  results.forEach(function(pattern) {
    var card = document.createElement("article");
    card.className = "pattern-card";

    var heading = document.createElement("div");
    heading.className = "pattern-heading";

    var name = document.createElement("span");
    name.className = "pattern-name";
    name.textContent = PATTERN_LABELS[pattern.pattern] || pattern.message || pattern.pattern || "Unknown pattern";
    heading.appendChild(name);

    var confidence = document.createElement("span");
    confidence.className = "confidence";
    confidence.textContent = Math.round(Number(pattern.confidence || 0) * 100) + "%";
    heading.appendChild(confidence);
    card.appendChild(heading);

    var actions = document.createElement("div");
    actions.className = "pattern-actions";
    actions.appendChild(createButton("Confirm", "confirm", function() {
      sendPatternAction("CONFIRM_PATTERN", pattern);
    }));
    actions.appendChild(createButton("False alarm", "false-alarm", function() {
      sendPatternAction("FALSE_ALARM", pattern);
    }));
    card.appendChild(actions);
    list.appendChild(card);
  });

  content.appendChild(list);
}

function showError() {
  clearContent();
  setStatus("ERROR");

  var panel = document.createElement("div");
  panel.className = "panel";
  panel.textContent = "Unable to read this page. Try refreshing the tab.";
  content.appendChild(panel);
}

function loadResults() {
  chrome.runtime.sendMessage({ type: "GET_RESULTS" }, function(results) {
    if (chrome.runtime.lastError) {
      showError();
      return;
    }
    if (!Array.isArray(results) || results.length === 0) {
      showCleanPage();
      return;
    }
    showPatterns(results);
  });
}

function loadPopup() {
  chrome.storage.local.get("analyticsConsent", function(settings) {
    if (typeof settings.analyticsConsent === "undefined") {
      showConsent();
      return;
    }
    loadResults();
  });
}

loadPopup();
