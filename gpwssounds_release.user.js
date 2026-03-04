// ==UserScript==
// @name         GPWS sounds, GeoFS.
// @namespace    geofs.gpws.jafar
// @version      6.0
// @description  Full 18-audio set from Avramovic. Enhanced Stall & Priority Logic.
// @match        https://www.geo-fs.com/geofs.php*
// @match        https://*.geo-fs.com/geofs.php*
// @grant        none
// ==/UserScript==

(function() {
    "use strict";

    let soundsEnabled = false;
    let lastAltitude = 99999;
    const ICON_URL = "https://cdn-icons-png.flaticon.com/512/2800/2800000.png";
    // Avramovic'ning aynan siz bergan commit'dagi manzili
    const RAW_URL = "https://raw.githubusercontent.com/avramovic/GeoFS-alerts/7fc27f444cc167fb588cd28afebff0526e7c53c7/audio/";

    // 1. AUDIO BAZASI
    const AUDIO = {
        stall: new Audio(RAW_URL + "airbus-stall-warning.mp3"),
        whoop: new Audio(RAW_URL + "terrain-terrain-pull-up.mp3"),
        sink: new Audio(RAW_URL + "sink-rate.mp3"),
        gear: new Audio(RAW_URL + "too-low-gear.mp3"),
        flaps: new Audio(RAW_URL + "too-low-flaps.mp3"),
        terrain: new Audio(RAW_URL + "too-low-terrain.mp3"),
        bank: new Audio(RAW_URL + "bank-angle.mp3"),
        overspeed: new Audio(RAW_URL + "overspeed.mp3"),
        glideslope: new Audio(RAW_URL + "glideslope.mp3"),
        retard: new Audio(RAW_URL + "retard.mp3")
    };

    const CALLOUTS = {};
    [2500, 1000, 500, 400, 300, 200, 100, 50, 40, 30, 20, 10].forEach(h => {
        CALLOUTS[h] = new Audio(RAW_URL + h + ".mp3");
    });

    // Muhim ovozlarni takrorlanuvchi qilish
    AUDIO.stall.loop = true;
    AUDIO.whoop.loop = false; // "Whoop Whoop" o'zi uzun fayl

    function stopAll() {
        [...Object.values(AUDIO), ...Object.values(CALLOUTS)].forEach(a => { a.pause(); a.currentTime = 0; });
    }

    function toggleGPWS() {
        soundsEnabled = !soundsEnabled;
        if (!soundsEnabled) {
            stopAll();
        } else {
            // Audio tizimini uyg'otish (Unlock)
            Object.values(AUDIO).forEach(a => { let p = a.play(); if(p) p.then(()=>{a.pause(); a.currentTime=0;}).catch(()=>{}); });
        }
        updateUI();
    }

    // 2. KLAVIATURA [Q] VA UI
    document.addEventListener('keydown', (e) => {
        if (["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) return;
        if (e.key.toLowerCase() === 'q') toggleGPWS();
    });

    function updateUI() {
        const bar = document.querySelector(".geofs-ui-bottom");
        if (!bar) return;
        let btn = document.getElementById("gpws-ultimate-btn") || document.createElement("div");
        if (!btn.id) { btn.id = "gpws-ultimate-btn"; btn.onclick = (e) => { e.stopPropagation(); toggleGPWS(); }; bar.appendChild(btn); }

        const isReplay = document.querySelector(".geofs-replay-container");
        btn.style.cssText = `display:inline-block; vertical-align:middle; margin-left:${isReplay ? '55px' : '10px'}; cursor:pointer; padding:5px 8px; border-radius:4px; background:${soundsEnabled ? 'rgba(0, 255, 0, 0.2)' : 'rgba(255, 255, 255, 0.1)'}; transition:0.2s; z-index:9999;`;
        btn.innerHTML = `<img src="${ICON_URL}" width="18" height="18" style="vertical-align:middle; filter:${soundsEnabled ? 'none' : 'grayscale(1)'};"> 
                         <span style="color:${soundsEnabled ? '#00ff00' : '#ccc'}; font-size:11px; font-weight:bold; margin-left:5px; font-family:sans-serif;">GPWS ${soundsEnabled ? 'ON' : 'OFF'} [Q]</span>`;
    }

    // 3. ASOSIY MANTIQIY MOTOR
    function mainLoop() {
        if (!window.geofs?.animation?.values || !soundsEnabled || document.querySelector(".geofs-replay-container")) return;

        try {
            const v = window.geofs.animation.values;
            const ac = window.geofs.aircraft.instance;
            const alt = Math.round(v.altitude - v.groundElevationFeet);
            const vs = v.verticalSpeed;
            const kias = v.kias;
            const roll = Math.abs(v.roll);
            const gearDown = v.gearPosition > 0.5;
            const flapsDown = v.flapsValue > 0.1;
            const ground = v.groundContact === 1;

            if (ground) { stopAll(); return; }

            // --- PRIORITY 1: STALL (Hamma narsadan ustun) ---
            // Stall logic: GeoFS flagi YOKI Hujum burchagi > 18 va tezlik < 120
            if (ac.stalling || (v.aoa > 18 && kias < 120)) {
                if (AUDIO.stall.paused) AUDIO.stall.play();
                // Stall vaqtida boshqa ogohlantirishlar o'chadi
                AUDIO.whoop.pause(); AUDIO.sink.pause(); AUDIO.terrain.pause();
                return; 
            } else { AUDIO.stall.pause(); AUDIO.stall.currentTime = 0; }

            // --- PRIORITY 2: WHOOP WHOOP PULL UP ---
            if (alt < 1000 && vs < -3600) {
                if (AUDIO.whoop.paused) AUDIO.whoop.play();
            } else {
                AUDIO.whoop.pause(); AUDIO.whoop.currentTime = 0;

                // --- PRIORITY 3: SINK RATE ---
                if (alt < 2500 && vs < -2100 && alt > 60) {
                    if (AUDIO.sink.paused) AUDIO.sink.play();
                } else { AUDIO.sink.pause(); AUDIO.sink.currentTime = 0; }
            }

            // --- CONFIGURATION CHECKS (Gear, Flaps, Terrain) ---
            const water = ["Canadair", "Otter", "Cessna 172 (Floats)", "Icon A5"].some(n => ac.definition.name.includes(n));
            
            if (!water && alt < 500 && alt > 30) {
                if (!gearDown) { if (AUDIO.gear.paused) AUDIO.gear.play(); } // "Too Low Gear"
                else {
                    AUDIO.gear.pause();
                    if (!flapsDown && alt < 250) { if (AUDIO.flaps.paused) AUDIO.flaps.play(); } // "Too Low Flaps"
                    else { AUDIO.flaps.pause(); }
                }
            }

            // "Too Low Terrain" - Pastda va juda tez uchish
            if (alt < 700 && vs > -500 && kias > 200 && !gearDown) {
                if (AUDIO.terrain.paused) AUDIO.terrain.play();
            } else { AUDIO.terrain.pause(); }

            // --- OTHER ALERTS ---
            if (roll > 40) { if (AUDIO.bank.paused) AUDIO.bank.play(); } else { AUDIO.bank.pause(); }
            
            if (kias > (ac.definition.vne || 400)) { if (AUDIO.overspeed.paused) AUDIO.overspeed.play(); } else { AUDIO.overspeed.pause(); }

            if (alt < 500 && vs < -1300 && gearDown) { if (AUDIO.glideslope.paused) AUDIO.glideslope.play(); } else { AUDIO.glideslope.pause(); }

            // --- CALLOUTS & RETARD ---
            for (let h in CALLOUTS) {
                let h_val = parseInt(h);
                if (alt <= h_val && lastAltitude > h_val) { CALLOUTS[h].play().catch(()=>{}); }
            }
            if (alt < 20 && lastAltitude >= 20 && vs < -50) { AUDIO.retard.play(); }

            lastAltitude = alt;

        } catch (e) {}
    }

    // Taymerlar (FPS uchun xavfsiz)
    setInterval(mainLoop, 150);
    setInterval(updateUI, 2000);
    setTimeout(updateUI, 5000);

})();
