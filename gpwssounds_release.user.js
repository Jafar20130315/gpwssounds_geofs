// ==UserScript==
// @name         GPWS sounds, GeoFS.
// @namespace    geofs.gpws.jafar
// @version      5.0
// @description  Pro-grade GPWS. Improved Stall logic, Priority Alerts, and Fast Reaction.
// @match        https://www.geo-fs.com/geofs.php*
// @match        https://*.geo-fs.com/geofs.php*
// @grant        none
// ==/UserScript==

(function() {
    "use strict";

    let soundsEnabled = false;
    let lastAltitude = 99999;
    const ICON_URL = "https://cdn-icons-png.flaticon.com/512/2800/2800000.png";
    const AUDIO_BASE = "https://raw.githubusercontent.com/avramovic/geofs-alerts/master/audio/";

    // 1. OVOZLARNI YUKLASH
    const AUDIO = {
        stall: new Audio(AUDIO_BASE + "airbus-stall-warning.mp3"),
        whoop: new Audio(AUDIO_BASE + "terrain-terrain-pull-up.mp3"),
        sink: new Audio(AUDIO_BASE + "sink-rate.mp3"),
        gear: new Audio(AUDIO_BASE + "too-low-gear.mp3"),
        bank: new Audio(AUDIO_BASE + "bank-angle.mp3"),
        overspeed: new Audio(AUDIO_BASE + "overspeed.mp3")
    };

    const CALLOUTS = {};
    [1000, 500, 400, 300, 200, 100, 50, 40, 30, 20, 10].forEach(h => {
        CALLOUTS[h] = new Audio(AUDIO_BASE + h + ".mp3");
    });

    // Ovozlar cheksiz aylanib turishi uchun (Stall va Whoop uchun muhim)
    AUDIO.stall.loop = true;
    AUDIO.overspeed.loop = true;

    function stopAll() {
        [...Object.values(AUDIO), ...Object.values(CALLOUTS)].forEach(a => { a.pause(); a.currentTime = 0; });
    }

    function toggleGPWS() {
        soundsEnabled = !soundsEnabled;
        if (!soundsEnabled) {
            stopAll();
        } else {
            // Ovozni "uyg'otish"
            Object.values(AUDIO).forEach(a => { let p = a.play(); if(p) p.then(()=> {a.pause(); a.currentTime=0;}).catch(()=>{}); });
        }
        updateUI();
    }

    // 2. KLAVIATURA [Q]
    document.addEventListener('keydown', (e) => {
        if (["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) return;
        if (e.key.toLowerCase() === 'q') toggleGPWS();
    });

    // 3. UI (TUGMA) - Xavfsiz rejimda
    function updateUI() {
        const bar = document.querySelector(".geofs-ui-bottom");
        if (!bar) return;

        let btn = document.getElementById("gpws-stable-btn");
        const isReplay = document.querySelector(".geofs-replay-container");

        if (!btn) {
            btn = document.createElement("div");
            btn.id = "gpws-stable-btn";
            btn.onclick = (e) => { e.stopPropagation(); toggleGPWS(); };
            bar.appendChild(btn);
        }

        btn.style.cssText = `
            display: inline-block; vertical-align: middle;
            margin-left: ${isReplay ? '45px' : '10px'};
            cursor: pointer; padding: 5px 8px; border-radius: 4px;
            background: ${soundsEnabled ? 'rgba(0, 255, 0, 0.2)' : 'rgba(255, 255, 255, 0.1)'};
            transition: 0.2s; z-index: 9999;
        `;

        btn.innerHTML = `<img src="${ICON_URL}" width="18" height="18" style="vertical-align:middle; filter:${soundsEnabled ? 'none' : 'grayscale(1)'};"> 
                         <span style="color:${soundsEnabled ? '#00ff00' : '#ccc'}; font-size:11px; font-weight:bold; margin-left:5px; font-family:sans-serif;">
                         GPWS ${soundsEnabled ? 'ON' : 'OFF'} [Q]</span>`;
    }

    // 4. ASOSIY MANTIQ (MAIN LOOP) - Sekundiga 10 marta tekshirish
    function mainLoop() {
        if (!window.geofs?.animation?.values || !soundsEnabled) return;
        if (document.querySelector(".geofs-replay-container")) return;

        try {
            const v = window.geofs.animation.values;
            const alt = Math.round(v.altitude - v.groundElevationFeet);
            const vs = v.verticalSpeed;
            const roll = Math.abs(v.roll);
            const aoa = v.aoa; // Angle of Attack
            const kias = v.kias;
            const ground = v.groundContact === 1;

            if (ground) { stopAll(); return; }

            // --- PRIORITY 1: STALL ---
            // Samolyot stalling holatida bo'lsa YOKI tezlik juda past va burni juda yuqori bo'lsa
            const isStalling = window.geofs.aircraft?.instance?.stalling || (aoa > 18 && kias < 120);

            if (isStalling) {
                if (AUDIO.stall.paused) AUDIO.stall.play();
                // Stall vaqtida boshqa ogohlantirishlarni to'xtatish (Prioritet)
                AUDIO.whoop.pause(); AUDIO.sink.pause();
            } else {
                AUDIO.stall.pause(); AUDIO.stall.currentTime = 0;

                // --- PRIORITY 2: WHOOP WHOOP PULL UP ---
                if (alt < 1000 && vs < -3500) {
                    if (AUDIO.whoop.paused) AUDIO.whoop.play();
                } else {
                    AUDIO.whoop.pause(); AUDIO.whoop.currentTime = 0;

                    // --- PRIORITY 3: SINK RATE ---
                    if (alt < 2500 && vs < -2200) {
                        if (AUDIO.sink.paused) AUDIO.sink.play();
                    } else {
                        AUDIO.sink.pause(); AUDIO.sink.currentTime = 0;
                    }
                }
            }

            // --- BANK ANGLE & OVERSPEED (Parallel ogohlantirishlar) ---
            if (roll > 40) { if (AUDIO.bank.paused) AUDIO.bank.play(); }
            else { AUDIO.bank.pause(); AUDIO.bank.currentTime = 0; }

            if (kias > (window.geofs.aircraft?.instance?.definition?.vne || 450)) {
                if (AUDIO.overspeed.paused) AUDIO.overspeed.play();
            } else {
                AUDIO.overspeed.pause(); AUDIO.overspeed.currentTime = 0; }

            // --- CALLOUTS ---
            for (let h in CALLOUTS) {
                let h_val = parseInt(h);
                if (alt <= h_val && lastAltitude > h_val) {
                    CALLOUTS[h].play().catch(() => {});
                }
            }
            lastAltitude = alt;

        } catch (err) { }
    }

    // Taymerlarni sozlash
    setInterval(mainLoop, 100); 
    setInterval(updateUI, 1500);
    setTimeout(updateUI, 5000);

})();
