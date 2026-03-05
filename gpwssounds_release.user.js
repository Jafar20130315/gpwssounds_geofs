// ==UserScript==
// @name         Altis GeoFS
// @namespace    https://jafaras.uz/
// @version      8.3
// @description  Warning sounds for GeoFS.
// @match        https://www.geo-fs.com/geofs.php*
// @match        https://*.geo-fs.com/geofs.php*
// @author       Jafar_AS
// @icon         https://i.ibb.co/Zpk1B4s3/Altis-icon-1.png
// @grant        none
// ==/UserScript==

(function() {
    "use strict";

    let soundsEnabled = false;
    let lastAltitude = 99999;
    let currentPriority = 0;
    let activeKey = null;      
    let activeAudio = null;
    let preloaded = false;
    let lastAutopilotState = false;

    const RAW_URL = "https://raw.githubusercontent.com/avramovic/GeoFS-alerts/7fc27f444cc167fb588cd28afebff0526e7c53c7/audio/";

    const SOUND_FILES = {
        stall:      "airbus-stall-warning.mp3",
        windshear:  "windshear.mp3",
        pullup:      "pull-up.mp3",
        terrain:    "terrain.mp3",
        whoop:      "terrain-terrain-pull-up.mp3",
        sink:        "sink-rate.mp3",
        dontsink:    "dont-sink.mp3",
        tooLowGear: "too-low-gear.mp3",
        tooLowFlaps:"too-low-flaps.mp3",
        tooLowTerrain:"too-low-terrain.mp3",
        glideslope: "glideslope.mp3",
        bank:        "bank-angle.mp3",
        retard:      "retard.mp3",
        mins:        "minimums.mp3",
        appMins:    "approaching-minimums.mp3",
        hundredAbove: "hundred-above.mp3",
        autopilotOff: "autopilot-off.mp3",
        autopilotOn:  "autopilot-on.mp3"
    };

    const SOUNDS = {
        stall:      { audio: null, p: 10, loop: true },
        windshear:  { audio: null, p: 9, loop: false },
        pullup:      { audio: null, p: 9, loop: false },
        terrain:    { audio: null, p: 8, loop: false },
        whoop:      { audio: null, p: 8, loop: false },
        sink:        { audio: null, p: 7, loop: false },
        dontsink:    { audio: null, p: 6, loop: false },
        tooLowGear: { audio: null, p: 5, loop: false },
        tooLowFlaps:{ audio: null, p: 5, loop: false },
        tooLowTerrain:{ audio: null, p: 5, loop: false },
        glideslope: { audio: null, p: 4, loop: false },
        bank:        { audio: null, p: 3, loop: false },
        retard:      { audio: null, p: 2, loop: false },
        mins:        { audio: null, p: 2, loop: false },
        appMins:    { audio: null, p: 2, loop: false },
        hundredAbove:{ audio: null, p: 2, loop: false },
        autopilotOff:{ audio: null, p: 10, loop: false },
        autopilotOn:{ audio: null, p: 10, loop: false }
    };

    const CALLOUTS = {};
    [2500, 2000, 1500, 1000, 500, 400, 300, 200, 100, 50, 40, 30, 20, 10].forEach(h => {
        CALLOUTS[h] = { audio: null, p: 1, filename: h + ".mp3" };
    });

    async function preloadAllAudio() {
        if (preloaded) return;
        const tasks = [];
        for (const key in SOUND_FILES) {
            tasks.push(fetch(RAW_URL + SOUND_FILES[key]).then(r => r.blob()).then(blob => {
                const a = new Audio(URL.createObjectURL(blob));
                a.preload = "auto";
                if (SOUNDS[key]) SOUNDS[key].audio = a;
            }).catch(e => console.warn(key + " error")));
        }
        for (const h in CALLOUTS) {
            tasks.push(fetch(RAW_URL + CALLOUTS[h].filename).then(r => r.blob()).then(blob => {
                const a = new Audio(URL.createObjectURL(blob));
                a.preload = "auto";
                CALLOUTS[h].audio = a;
            }).catch(e => console.warn(h + " error")));
        }
        await Promise.all(tasks);
        preloaded = true;
    }

    function playSafe(soundKey, isCallout = false) {
        const soundObj = isCallout ? CALLOUTS[soundKey] : SOUNDS[soundKey];
        if (!soundObj || !soundObj.audio || !soundsEnabled) return;

        const prio = soundObj.p ?? 1;

        if (prio > currentPriority || !activeAudio || activeAudio.paused) {
            if (activeAudio && activeKey !== soundKey) {
                activeAudio.pause();
                activeAudio.currentTime = 0;
            }

            activeAudio = soundObj.audio;
            activeKey = isCallout ? ("callout_" + soundKey) : soundKey;
            currentPriority = prio;

            if (soundObj.loop) activeAudio.loop = true;
            activeAudio.play().catch(() => {});

            activeAudio.onended = () => {
                currentPriority = 0;
                activeKey = null;
            };
        }
    }

    function stopAll() {
        if (activeAudio) {
            activeAudio.pause();
            activeAudio.currentTime = 0;
            activeAudio.loop = false;
        }
        currentPriority = 0;
        activeKey = null;
        activeAudio = null;
    }

    function gearIsDown(v) {
        if (v.gearTarget !== undefined) return v.gearTarget === 1;
        if (v.gearPosition !== undefined) return v.gearPosition > 0.9;
        return true; 
    }

    function mainLoop() {
        if (!window.geofs?.animation?.values || !soundsEnabled) return;
        if (document.querySelector(".geofs-replay-container")) return; 

        const v = window.geofs.animation.values;
        const ac = window.geofs.aircraft?.instance;
        const alt = Math.round((v.altitude || 0) - (v.groundElevationFeet || 0));
        const vs = v.verticalSpeed || 0;
        const kias = v.kias || 0;

        if (v.groundContact === 1) { 
            if (activeKey !== null) stopAll();
            lastAltitude = alt; 
            return; 
        }

        // 1. Autopilot
        const apOn = ac?.autopilot?.on || false;
        if (apOn && !lastAutopilotState) playSafe('autopilotOn');
        if (!apOn && lastAutopilotState) playSafe('autopilotOff');
        lastAutopilotState = apOn;

        // 2. Stall - Eng yuqori prioritet, lekin kodni to'xtatib qo'ymasligi kerak
        const isStall = ac?.stalling || (v.aoa > 18 && kias < 110);
        if (isStall) { 
            playSafe('stall'); 
        } else if (activeKey === 'stall') { 
            stopAll(); 
        }

        // 3. Bank Angle - TO'G'RILANGAN
        // geofs.animation.values.roll odatda darajada bo'ladi.
        const rollAngle = Math.abs(v.roll || 0);
        if (rollAngle > 45) { 
            playSafe('bank'); 
        }

        // 4. Sink Rate / Whoop Whoop
        if (alt < 1000 && vs < -3500) playSafe('whoop');
        else if (alt < 2500 && vs < -2000) playSafe('sink');

        // 5. Gear & Flaps
        const gearDown = gearIsDown(v);
        const flaps = v.flapsPosition || 0;
        if (alt < 500 && alt > 50 && !gearDown) playSafe('tooLowGear');
        if (alt < 200 && alt > 50 && gearDown && flaps < 0.1) playSafe('tooLowFlaps');

        // 6. Minimums & Retard
        if (alt <= 305 && lastAltitude > 305) playSafe('appMins');
        if (alt <= 205 && lastAltitude > 205) playSafe('mins');
        if (alt <= 100 && lastAltitude > 100) playSafe('hundredAbove');
        if (alt <= 20 && lastAltitude > 20 && v.throttle > 0.1) playSafe('retard');

        // 7. Callouts
        for (let h in CALLOUTS) {
            let h_val = parseInt(h);
            if (alt <= h_val && lastAltitude > h_val) playSafe(h, true);
        }

        lastAltitude = alt;
    }

    function toggleGPWS() {
        soundsEnabled = !soundsEnabled;
        if (soundsEnabled) {
            preloadAllAudio();
        } else {
            stopAll();
        }
        updateUI();
    }

    document.addEventListener('keydown', (e) => {
        if (e.key?.toLowerCase() === 'q') toggleGPWS();
    });

    function updateUI() {
        const bar = document.querySelector(".geofs-ui-bottom");
        if (!bar) return;
        let btn = document.getElementById("gpws-v8-btn-fixed") || document.createElement("div");
        if (!btn.id) {
            btn.id = "gpws-v8-btn-fixed";
            btn.onclick = toggleGPWS;
            bar.appendChild(btn);
        }
        
        const logoUrl = "https://raw.githubusercontent.com/Jafar20130315/gpwssounds_geofs/refs/heads/main/Altis-icon.png";  
        const statusText = soundsEnabled ? 'GPWS sounds on' : 'GPWS sounds off';
        const clickAction = soundsEnabled ? ' [Q]' : '[Q]';

        btn.style.cssText = `
            display:inline-flex;
            align-items:center;
            margin-left:10px;
            cursor:pointer;
            padding:6px 12px;
            border-radius:6px;
            background:${soundsEnabled ? 'rgba(0,200,0,0.2)' : 'rgba(255,255,255,0.06)'};
            color:#fff;
            font-family:sans-serif;
            font-size:12px;
            font-weight:700;
            box-shadow: 0 1px 4px rgba(0,0,0,0.4);
        `;

        btn.innerHTML = `
            <img src="${logoUrl}" style="height:16px; width:16px; margin-right:8px;">
            <span>${statusText}<span style="font-weight:400; opacity:0.7;"> ${clickAction}</span></span>
        `;
    }

    setInterval(mainLoop, 100); // 150ms dan 100ms ga tushirildi (aniqroq ishlashi uchun)
    setInterval(updateUI, 2000);

    console.log("Altis GPWS Fixed. Bank Angle & Priority logic updated.");
})();
