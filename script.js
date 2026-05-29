// ============================================================
//  Solar Automation for Shelly Plug
//  Runs directly on the Shelly – no CORS, no browser needed.
//
//  Logic (SOC-Hysteresis):
//    ON  if SOC >= socOn
//    OFF if SOC <  socOff
//    Hysteresis zone (socOff <= SOC < socOn) → no change
// ============================================================

// ── CONFIGURATION ────────────────────────────────────────────

var CONFIG = {
  froniusIp:        "192.168.0.11",  // Local IP of your Fronius Inverter
  socOn:            30,              // Turn ON at or above this SOC (%)
  socOff:           25,              // Turn OFF below this SOC (%)
  pollIntervalMs:   10000,           // API polling interval in milliseconds
  minSwitchDelayMs: 60000            // Minimum time between switching states in ms
};

// ── STATE ──────────────────────────────────────────────────

var lastSwitchTime = 0;
var isBusy = false;

// ── LOGIC ────────────────────────────────────────────────────

function applyDecision(soc, pPV, pGrid, pAkku) {
  var elapsed = Date.now() - lastSwitchTime;
  var delayOk = (elapsed >= CONFIG.minSwitchDelayMs);

  Shelly.call("Switch.GetStatus", { id: 0 }, function(res, ec) {
    if (ec !== 0 || !res) {
      print("[Fehler] Switch.GetStatus – Code:", ec);
      isBusy = false;
      return;
    }

    var plugIsOn = res.output === true;

    if (!plugIsOn && soc >= CONFIG.socOn) {
      // ── ON ──────────────────────────────────────
      if (delayOk) {
        Shelly.call("Switch.Set", { id: 0, on: true }, function(r, ec2) {
          if (ec2 === 0) {
            lastSwitchTime = Date.now();
            print("[EIN] SOC", Math.round(soc), "% >= " + CONFIG.socOn + "%");
          } else {
            print("[Fehler] Switch.Set ON – Code:", ec2);
          }
          isBusy = false;
        });
      } else {
        print("[Warte-EIN]", Math.round((CONFIG.minSwitchDelayMs - elapsed) / 1000),
              "s | SOC:", Math.round(soc), "%");
        isBusy = false;
      }

    } else if (plugIsOn && soc < CONFIG.socOff) {
      // ── OFF ──────────────────────────────────────
      if (delayOk) {
        Shelly.call("Switch.Set", { id: 0, on: false }, function(r, ec2) {
          if (ec2 === 0) {
            lastSwitchTime = Date.now();
            print("[AUS] SOC", Math.round(soc), "% < " + CONFIG.socOff + "%");
          } else {
            print("[Fehler] Switch.Set OFF – Code:", ec2);
          }
          isBusy = false;
        });
      } else {
        print("[Warte-AUS]", Math.round((CONFIG.minSwitchDelayMs - elapsed) / 1000),
              "s | SOC:", Math.round(soc), "%");
        isBusy = false;
      }

    } else {
      // ─ Hysteresis zone,no change ─
      var zone = (soc >= CONFIG.socOff && soc < CONFIG.socOn) ? " [Hysterese]" : "";
      print("[OK] Plug:", plugIsOn ? "EIN" : "AUS",
            "| SOC:", Math.round(soc), "%",
            "| PV:", Math.round(pPV), "W",
            "| Netz:", Math.round(pGrid), "W",
            "| Akku:", Math.round(pAkku), "W" + zone);
      isBusy = false;
    }
  });
}

// ── FRONIUS QUERIES ─────────────────────────────────────────

function tick() {
  if (isBusy) { print("[Skip] Zyklus noch aktiv"); return; }
  isBusy = true;

  var url = "http://" + CONFIG.froniusIp +
            "/solar_api/v1/GetPowerFlowRealtimeData.fcgi";

  Shelly.call("HTTP.GET", { url: url, timeout: 8 }, function(res, ec, msg) {
    if (ec !== 0 || !res || res.code !== 200) {
      print("[Fehler] Fronius – HTTP-Code:", (res ? res.code : "?"),
            "EC:", ec, "Msg:", msg);
      isBusy = false;
      return;
    }

    var data;
    try { data = JSON.parse(res.body); } catch(e) {
      print("[Fehler] JSON Parse:", e);
      isBusy = false;
      return;
    }

    var body = data && data.Body && data.Body.Data;
    var site = body && body.Site;
    var inv  = body && body.Inverters && body.Inverters["1"];

    if (!site || !inv) {
      print("[Fehler] Fronius: Site oder Inverters fehlt");
      isBusy = false;
      return;
    }

    var soc   = (inv.SOC  != null) ? inv.SOC       : 0;
    var pPV   = (site.P_PV   != null) ? site.P_PV  : 0;
    var pGrid = (site.P_Grid != null) ? site.P_Grid : 0;
    var pAkku = (site.P_Akku != null) ? site.P_Akku : 0;

    print("[Fronius] SOC:", Math.round(soc), "%",
          "| PV:", Math.round(pPV), "W",
          "| Netz:", Math.round(pGrid), "W",
          "| Akku:", Math.round(pAkku), "W");

    applyDecision(soc, pPV, pGrid, pAkku);
  });
}

// ── START ─────────────────────────────────────────────────────

print("=== Solar-Automation Start (SOC-Hysterese) ===");
print("EIN ab SOC >=", CONFIG.socOn, "%  |  AUS unter SOC <", CONFIG.socOff, "%");
print("Hysterese-Zone:", CONFIG.socOff, "% –", CONFIG.socOn, "% → keine Änderung");
print("Intervall:", CONFIG.pollIntervalMs / 1000, "s",
      "| Mindest-Schaltpause:", CONFIG.minSwitchDelayMs / 1000, "s");

tick();
Timer.set(CONFIG.pollIntervalMs, true, tick);
