# Solar-Controlled Power Management via Battery SOC (Shelly Native Script)

An autonomous, local smart home automation that controls a Shelly Plug based on your Fronius battery storage State of Charge (SOC) - running completely natively on the Shelly device without any external dependencies.

This project was created for the **Smart Home Challenge 2026** under the category **"Build the Logic"**.

---

## 💡 The Core Idea

When building smart home interfaces, web browsers often block direct HTTP requests to local network devices due to modern security models (CORS and Mixed Content Policies). 

Instead of routing logic through an external web app, a cloud service, or even a local smart home server, **the automation logic is deployed directly onto the Shelly Plug**. It runs completely autonomously in your local network, communicating directly with your Fronius inverter.

* **No Cloud Dependency:** 100% local execution.
* **No External Server:** No Home Assistant, Node-RED, or proprietary apps required.
* **No Browser Security Issues:** Bypasses all CORS and Mixed Content limitations.

---

## ⚙️ How It Works (SOC Hysteresis)

The script safely manages power consumption by using a **hysteresis zone** to prevent rapid, repetitive switching ("relay chattering") during periods of fluctuating solar generation.


1. **Query Inverter:** Every 10 seconds, the Shelly Plug requests the data from the Fronius PowerFlow API via a local `HTTP.GET` call. The current battery SOC is parsed from `Body.Data.Inverters["1"].SOC`.
2. **Switch ON (≥ 30%):** As soon as the battery charge reaches or exceeds the upper threshold (`socOn`), the plug turns on, running your appliance on self-produced solar power.
3. **Switch OFF (< 25%):** The plug remains on until the battery drops below the lower threshold (`socOff`), at which point it shuts off to preserve storage.
4. **Minimum Switching Delay:** A configurable safety timer ensures that once the relay changes state, it will not switch again for a set period (default: 60 seconds) to protect both the appliance and the relay hardware.

---

## 🛠️ Configuration

All parameters can be customized directly within the `CONFIG` object at the top of the script:

```javascript
var CONFIG = {
  froniusIp:        "192.168.0.11", // Local IP of your Fronius Inverter
  socOn:            30,             // Turn ON at or above this SOC (%)
  socOff:           25,             // Turn OFF below this SOC (%)
  pollIntervalMs:   10000,          // API polling interval in milliseconds
  minSwitchDelayMs: 60000           // Minimum time between switching states in ms
};

```

### Parameters Explanations

* **`socOn` (30%)**: Upper threshold to activate the load.
* **`socOff` (25%)**: Lower threshold to safely disconnect.
* **`pollIntervalMs` (10s)**: Frequency of API data updates.
* **`minSwitchDelayMs` (60s)**: Safety cooldown pause between relay operations.

---

## 📋 Hardware Requirements

* **Shelly Plug S Gen3** (or any Gen3/Gen2 Shelly device supporting scripting and local LAN access)
* **Fronius Inverter** with attached battery storage system (PowerFlow API enabled)
* Both devices must be connected to the **same local network**.

---

## 🤓 Technical Details & Implementation

Because the Shelly runtime environment uses an **Espruino-based JavaScript engine**, it does not support asynchronous syntax features like `async/await`.

* **Callback-Driven Architecture:** All API requests (`HTTP.GET`, `Switch.GetStatus`, and `Switch.Set`) are structured using nested callbacks.
* **Concurrency Protection:** The script implements an `isBusy` flag guard. This prevents overlapping timer execution cycles if the Fronius inverter responds slowly to network requests.

---

## 🚀 Getting Started

1. Copy the source code from `script.js` in this repository.
2. Open your Shelly local web interface by navigating to its local IP address in a browser.
3. Go to **Scripts** and create a new script.
4. Paste the code into the editor and update the `CONFIG.froniusIp` to match your Fronius inverter's IP address.
5. Save, click **Run**, and enable the "Start on boot" toggle.

---
Below is the typical output of a query of the Fronius API:
http://192.168.0.11/solar_api/v1/GetPowerFlowRealtimeData.fcgi
```javascript
{
  "Body": {
    "Data": {
      "Inverters": {
        "1": {
          "Battery_Mode": "battery full",
          "DT": 1,
          "E_Day": null,
          "E_Total": 20889872.7411111,
          "E_Year": null,
          "P": 717.341003417969,
          "SOC": 99
        }
      },
      "SecondaryMeters": {

      },
      "Site": {
        "BackupMode": false,
        "BatteryStandby": false,
        "E_Day": null,
        "E_Total": 20889872.7411111,
        "E_Year": null,
        "Meter_Location": "grid",
        "Mode": "bidirectional",
        "P_Akku": 58.1792221069336,
        "P_Grid": 4.1,
        "P_Load": -721.441003417969,
        "P_PV": 695.562927246094,
        "rel_Autonomy": 99.4316929616454,
        "rel_SelfConsumption": 100
      },
      "Smartloads": {
        "OhmpilotEcos": {

        },
        "Ohmpilots": {

        }
      },
      "Version": "13"
    }
  },
  "Head": {
    "RequestArguments": {

    },
    "Status": {
      "Code": 0,
      "Reason": "",
      "UserMessage": ""
    },
    "Timestamp": "2026-05-29T16:48:48+00:00"
  }
}
```
