var KNOWN_TRACKERS = {
  "facebook.net": "Facebook Pixel active",
  "google-analytics.com": "Google Analytics active",
  "hotjar.com": "Hotjar recording active",
  "clarity.ms": "Clarity recording active",
  "criteo.com": "Criteo tracker active"
};

function findPreTickedCheckboxes() {
  var results = [];
  document.querySelectorAll('input[type="checkbox"]:checked').forEach(function(element) {
    var label = document.querySelector('label[for="' + element.id + '"]') || element.closest("label");
    var text = label ? label.innerText.toLowerCase() : "";
    if (["newsletter", "subscribe", "offers", "insurance", "marketing"].some(function(word) {
      return text.includes(word);
    })) {
      results.push({ element: element, pattern: "pre_ticked_checkbox", confidence: 0.92, message: "Pre-ticked Checkbox" });
    }
  });
  return results;
}

function findCountdownTimers() {
  var results = [];
  ["[class*=timer]", "[class*=countdown]", "[id*=timer]", "[id*=countdown]"].forEach(function(selector) {
    document.querySelectorAll(selector).forEach(function(element) {
      results.push({ element: element, pattern: "fake_countdown", confidence: 0.85, message: "Countdown Timer" });
    });
  });
  return results;
}

function findConfirmshaming() {
  var results = [];
  var phrases = ["no thanks, i hate", "no thanks, i don", "i don't want to save", "nahi chahiye"];
  document.querySelectorAll("a,button,label,span").forEach(function(element) {
    var text = (element.innerText || "").toLowerCase().trim();
    if (text && text.length < 100 && phrases.some(function(phrase) {
      return text.includes(phrase);
    })) {
      results.push({ element: element, pattern: "confirmshaming", confidence: 0.94, message: "Confirmshaming" });
    }
  });
  return results;
}

function findVisualInterference() {
  var results = [];
  var acceptTexts = ["accept", "accept all", "agree", "allow all"];
  var rejectTexts = ["reject", "reject all", "decline", "necessary only"];
  var buttons = Array.from(document.querySelectorAll("button,a[role=button]"));
  var acceptButton = null;
  var rejectButton = null;
  buttons.forEach(function(button) {
    var text = (button.innerText || "").toLowerCase().trim();
    if (acceptTexts.includes(text)) acceptButton = button;
    if (rejectTexts.includes(text)) rejectButton = button;
  });
  if (acceptButton && rejectButton) {
    var acceptSize = parseFloat(window.getComputedStyle(acceptButton).fontSize) || 14;
    var rejectSize = parseFloat(window.getComputedStyle(rejectButton).fontSize) || 14;
    if (acceptSize > rejectSize * 1.3) {
      results.push({ element: rejectButton, pattern: "visual_interference", confidence: 0.88, message: "Visual Interference" });
    }
  }
  return results;
}

function findFakeUrgency() {
  var results = [];
  var phrases = [
    /only \d+ (rooms?|left|seats?)/i,
    /we have \d+ left/i,
    /selling fast/i,
    /in high demand/i,
    /sirf \d+ (bacha|left)/i
  ];
  document.querySelectorAll("p,span,div,strong,small").forEach(function(element) {
    var text = (element.innerText || "").trim();
    if (text.length > 0 && text.length < 200 && phrases.some(function(phrase) {
      return phrase.test(text);
    })) {
      results.push({ element: element, pattern: "fake_urgency", confidence: 0.82, message: "Fake Urgency" });
    }
  });
  return results;
}

function findSocialProof() {
  var results = [];
  var phrases = [
    /\d+ (people|guests?) (just )?(booked|viewed)/i,
    /someone just booked/i,
    /\d+ (are )?viewing this/i
  ];
  document.querySelectorAll("p,span,div,small").forEach(function(element) {
    var text = (element.innerText || "").trim();
    if (text.length > 0 && text.length < 150 && phrases.some(function(phrase) {
      return phrase.test(text);
    })) {
      results.push({ element: element, pattern: "social_proof_manipulation", confidence: 0.79, message: "Fake Social Proof" });
    }
  });
  return results;
}

function findTrackers() {
  var results = [];
  document.querySelectorAll("script[src]").forEach(function(element) {
    var source = (element.src || "").toLowerCase();
    Object.keys(KNOWN_TRACKERS).forEach(function(domain) {
      if (source.includes(domain)) {
        results.push({ element: element, pattern: "privacy_zuckering", confidence: 0.98, message: KNOWN_TRACKERS[domain] });
      }
    });
  });
  return results;
}

function highlightElement(element, message) {
  if (!element || element.dataset.dcFlagged === "true") return;
  element.dataset.dcFlagged = "true";
  element.style.outline = "2px solid #a78bfa";
  element.style.outlineOffset = "2px";
  if (window.getComputedStyle(element).position === "static") element.style.position = "relative";
  var tooltip = document.createElement("div");
  tooltip.className = "dc-tooltip";
  tooltip.textContent = "Dark Connector: " + message;
  element.appendChild(tooltip);
}

function saveReportStatus(message) {
  chrome.storage.local.set({ dcLastReportStatus: message });
}

function runDetection() {
  var all = [].concat(
    findPreTickedCheckboxes(),
    findCountdownTimers(),
    findConfirmshaming(),
    findVisualInterference(),
    findFakeUrgency(),
    findSocialProof(),
    findTrackers()
  );
  var seen = new Map();
  all.forEach(function(result) {
    if (!result.element) return;
    if (!seen.has(result.element) || seen.get(result.element).confidence < result.confidence) {
      seen.set(result.element, result);
    }
  });

  var allResults = Array.from(seen.values());
  var newResults = allResults.filter(function(result) {
    return result.element.dataset.dcFlagged !== "true";
  });
  newResults.forEach(function(result) {
    highlightElement(result.element, result.message);
  });
  if (allResults.length > 0) {
    try {
      chrome.runtime.sendMessage({
        type: "DETECTION_RESULTS",
        results: allResults.map(function(result) {
          return {
            pattern: result.pattern,
            confidence: result.confidence,
            message: result.message
          };
        }),
        url: window.location.hostname,
        reportResults: newResults.map(function(result) {
          return { pattern: result.pattern, confidence: result.confidence };
        })
      });
    } catch (error) {
      saveReportStatus("Could not update extension results.");
    }
  }
}

var detectionTimer = null;
var observer = new MutationObserver(function(mutations) {
  if (!mutations.some(function(mutation) {
    return mutation.addedNodes && mutation.addedNodes.length > 3;
  })) return;
  clearTimeout(detectionTimer);
  detectionTimer = setTimeout(runDetection, 2000);
});
observer.observe(document.body || document.documentElement, {
  childList: true,
  subtree: true,
  attributes: false,
  characterData: false
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", runDetection, { once: true });
} else {
  runDetection();
}
