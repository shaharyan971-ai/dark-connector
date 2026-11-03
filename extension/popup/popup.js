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

function authRequest(path, payload) {
  if (!DC_CONFIG.SUPABASE_URL || !DC_CONFIG.SUPABASE_ANON_KEY) {
    return Promise.reject(new Error("Extension auth is not configured for this deployment."));
  }
  return fetch(DC_CONFIG.SUPABASE_URL.replace(/\/+$/, "") + "/auth/v1/" + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: DC_CONFIG.SUPABASE_ANON_KEY
    },
    body: JSON.stringify(payload)
  }).then(function(response) {
    return response.json().catch(function() {
      throw new Error("Authentication service returned an unreadable response.");
    }).then(function(body) {
      if (!response.ok) {
        throw new Error(body.msg || body.message || "Authentication failed.");
      }
      return body;
    });
  });
}

function backendRequest(path, token, options) {
  if (!DC_CONFIG.BACKEND_API_URL) {
    return Promise.reject(new Error("Backend URL is not configured for this extension build."));
  }
  var requestOptions = options || {};
  var headers = Object.assign({}, requestOptions.headers || {}, {
    Authorization: "Bearer " + token
  });
  if (requestOptions.body) headers["Content-Type"] = "application/json";
  return fetch(DC_CONFIG.BACKEND_API_URL.replace(/\/+$/, "") + path, Object.assign({}, requestOptions, {
    headers: headers
  })).then(function(response) {
    return response.json().catch(function() {
      throw new Error("Backend returned an unreadable response.");
    }).then(function(body) {
      if (!response.ok) {
        throw new Error(body.detail || body.message || "Backend request failed (HTTP " + response.status + ").");
      }
      return body;
    });
  });
}

function updateSharingConsent(enabled, session) {
  backendRequest("/api/settings", session.access_token).then(function(settings) {
    settings.analytics_consent = enabled;
    return backendRequest("/api/settings", session.access_token, {
      method: "PUT",
      body: JSON.stringify(settings)
    });
  }).then(function() {
    chrome.storage.local.set({ analyticsConsent: enabled, dcLastReportStatus: "" }, loadPopup);
  }).catch(function(error) {
    chrome.storage.local.set({
      dcLastReportStatus: error instanceof Error ? error.message : "Could not update sharing preference."
    }, loadPopup);
  });
}

function signOutExtension(session) {
  var warning = "";
  backendRequest("/api/settings", session.access_token).then(function(settings) {
    settings.analytics_consent = false;
    return backendRequest("/api/settings", session.access_token, {
      method: "PUT",
      body: JSON.stringify(settings)
    });
  }).catch(function(error) {
    warning = error instanceof Error
      ? "Sharing preference could not be updated: " + error.message
      : "Sharing preference could not be updated.";
  }).then(function() {
    if (!DC_CONFIG.SUPABASE_URL || !DC_CONFIG.SUPABASE_ANON_KEY) {
      warning = "Signed out here, but the authentication session could not be revoked.";
      return Promise.resolve();
    }
    return fetch(DC_CONFIG.SUPABASE_URL.replace(/\/+$/, "") + "/auth/v1/logout", {
      method: "POST",
      headers: {
        apikey: DC_CONFIG.SUPABASE_ANON_KEY,
        Authorization: "Bearer " + session.access_token
      }
    }).then(function(response) {
      if (!response.ok) warning = "Signed out here, but the authentication session could not be revoked.";
    }).catch(function() {
      warning = "Signed out here, but the authentication service could not be reached to revoke the session.";
    });
  }).catch(function(error) {
    warning = error instanceof Error ? error.message : "The authentication session could not be revoked.";
  }).finally(function() {
    chrome.storage.local.set({
      dcSession: null,
      analyticsConsent: false,
      dcLastReportStatus: warning
    }, loadPopup);
  });
}

function setStatus(value) {
  status.textContent = value;
}

function clearContent() {
  Array.from(content.children).forEach(function(child) {
    if (child.dataset.role !== "account") child.remove();
  });
}

function createButton(label, className, handler) {
  var button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.className = className;
  button.addEventListener("click", handler);
  return button;
}

function showCleanPage() {
  clearContent();
  setStatus("NO SIGNALS");

  var panel = document.createElement("div");
  panel.className = "panel clean";
  panel.textContent = "No supported signals detected on this page.";
  content.appendChild(panel);
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

    list.appendChild(card);
  });

  content.appendChild(list);
  var notice = document.createElement("p");
  notice.className = "muted";
  notice.textContent = "Detections are heuristic signals, not proof of deceptive intent. Review the page before drawing conclusions.";
  content.appendChild(notice);
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
    if (!Array.isArray(results)) {
      showError();
      return;
    }
    if (results.length === 0) {
      showCleanPage();
      return;
    }
    showPatterns(results);
  });
}

function showAccount(session, reportStatus) {
  var panel = document.createElement("section");
  panel.className = "panel account-panel";
  panel.dataset.role = "account";
  var row = document.createElement("div");
  row.className = "account-row";
  var heading = document.createElement("h2");
  heading.textContent = "Extension account";
  row.appendChild(heading);

  if (session && session.access_token) {
    var signOut = createButton("Sign out", "", function() {
      signOutExtension(session);
    });
    row.appendChild(signOut);
    panel.appendChild(row);

    var account = document.createElement("p");
    account.className = "account-email";
    account.textContent = session.user && session.user.email || "Signed in";
    panel.appendChild(account);

    var consent = document.createElement("p");
    consent.className = "muted";
    consent.textContent = "Pattern names, confidence scores, and the current site hostname are sent only when sharing is enabled.";
    panel.appendChild(consent);

    var consentActions = document.createElement("div");
    consentActions.className = "actions";
    var enable = createButton(
      "Sharing " + (settingsConsent ? "on" : "off") + " · change",
      settingsConsent ? "primary" : "",
      function() {
        updateSharingConsent(!settingsConsent, session);
      }
    );
    consentActions.appendChild(enable);
    panel.appendChild(consentActions);
  } else {
    panel.appendChild(row);
    var form = document.createElement("form");
    var signup = false;
    var nameLabel = document.createElement("label");
    nameLabel.textContent = "Name";
    var nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.autocomplete = "name";
    nameInput.maxLength = 120;
    nameInput.required = true;
    nameLabel.appendChild(nameInput);
    nameLabel.className = "hidden";
    form.appendChild(nameLabel);

    var emailLabel = document.createElement("label");
    emailLabel.textContent = "Email";
    var emailInput = document.createElement("input");
    emailInput.type = "email";
    emailInput.autocomplete = "email";
    emailInput.maxLength = 255;
    emailInput.required = true;
    emailLabel.appendChild(emailInput);
    form.appendChild(emailLabel);

    var passwordLabel = document.createElement("label");
    passwordLabel.textContent = "Password";
    var passwordInput = document.createElement("input");
    passwordInput.type = "password";
    passwordInput.autocomplete = "current-password";
    passwordInput.minLength = 10;
    passwordInput.maxLength = 1024;
    passwordInput.required = true;
    passwordLabel.appendChild(passwordInput);
    form.appendChild(passwordLabel);

    var error = document.createElement("p");
    error.className = "account-error";
    error.setAttribute("role", "alert");
    form.appendChild(error);
    var actions = document.createElement("div");
    actions.className = "actions";
    var submit = createButton("Sign in", "primary", function() {});
    submit.type = "submit";
    var switchMode = createButton("Create account", "", function() {
      signup = !signup;
      nameLabel.classList.toggle("hidden", !signup);
      nameInput.required = signup;
      passwordInput.autocomplete = signup ? "new-password" : "current-password";
      submit.textContent = signup ? "Create account" : "Sign in";
      switchMode.textContent = signup ? "I have an account" : "Create account";
      error.textContent = "";
    });
    actions.appendChild(submit);
    actions.appendChild(switchMode);
    form.appendChild(actions);

    form.addEventListener("submit", function(event) {
      event.preventDefault();
      submit.disabled = true;
      error.textContent = "";
      var endpoint = signup ? "signup" : "token?grant_type=password";
      var payload = signup
        ? { email: emailInput.value.trim(), password: passwordInput.value, data: { name: nameInput.value.trim() } }
        : { email: emailInput.value.trim(), password: passwordInput.value };
      authRequest(endpoint, payload).then(function(result) {
        if (!result.access_token || !result.refresh_token) {
          error.textContent = "Check your email to confirm the account, then sign in.";
          return;
        }
        return chrome.storage.local.set({
          dcSession: {
            access_token: result.access_token,
            refresh_token: result.refresh_token,
            expires_at: Date.now() + (Number(result.expires_in) || 3600) * 1000,
            user: result.user
          },
          analyticsConsent: false
        }).then(loadPopup);
      }).catch(function(caught) {
        error.textContent = caught instanceof Error ? caught.message : "Authentication failed.";
      }).finally(function() {
        submit.disabled = false;
      });
    });
    panel.appendChild(form);
    var configuration = document.createElement("p");
    configuration.className = "muted";
    configuration.textContent = "Account sign-in requires this extension build to be configured with the service's public Supabase URL and anon key.";
    panel.appendChild(configuration);
  }

  if (reportStatus) {
    var statusMessage = document.createElement("p");
    statusMessage.className = "report-status";
    statusMessage.setAttribute("role", "status");
    statusMessage.textContent = reportStatus;
    panel.appendChild(statusMessage);
  }
  content.insertBefore(panel, content.firstChild);
}

var settingsConsent = false;

function loadPopup() {
  chrome.storage.local.get(
    ["analyticsConsent", "dcSession", "dcLastReportStatus"],
    function(settings) {
      var render = function(consent, reportStatus) {
        settingsConsent = consent === true;
        showAccount(settings.dcSession, reportStatus);
        loadResults();
      };
      if (!settings.dcSession || !settings.dcSession.access_token) {
        render(false, settings.dcLastReportStatus);
        return;
      }
      backendRequest("/api/settings", settings.dcSession.access_token)
        .then(function(serverSettings) {
          chrome.storage.local.set({ analyticsConsent: serverSettings.analytics_consent });
          render(serverSettings.analytics_consent, settings.dcLastReportStatus);
        })
        .catch(function(error) {
          render(settings.analyticsConsent, error instanceof Error ? error.message : "Could not load sharing settings.");
        });
    }
  );
}

loadPopup();
