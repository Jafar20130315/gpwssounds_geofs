// ==UserScript==
// @name         GeoFS Advanced GPWS + Alerts (Optimized)
// @namespace    geofs.gpws.jafar
// @version      2.5
// @description  Improved GPWS with priority logic and UI fix
// @match        https://www.geo-fs.com/geofs.php*
// @match        https://*.geo-fs.com/geofs.php*
// @grant        none
// ==/UserScript==

(function() {
    "use strict";

    const GW = window;

    // ================= AUDIO FILES =================
    const AUDIO = {
        stall: new Audio("https://raw.githubusercontent.com/avramovic/geofs-alerts/master/audio/airbus-stall-warning.mp3"),
        pull: new Audio("https://raw.githubusercontent.com/avramovic/geofs-alerts/master/audio/terrain-terrain-pull-up.mp3"),
        sink: new Audio("https://raw.githubusercontent.com/avramovic/geofs-alerts/master/audio/sink-rate.mp3"),
        gear: new Audio("https://raw.githubusercontent.com/avramovic/geofs-alerts/master/audio/too-low-gear.mp3"),
        overspeed: new Audio("https://raw.githubusercontent.com/avramovic/geofs-alerts/master/audio/overspeed.mp3")
    };

    const CALLOUTS = {
        1000: new Audio("https://raw.githubusercontent.com/avramovic/geofs-alerts/master/audio/1000.mp3"),
        500: new Audio("https://raw.githubusercontent.com/avramovic/geofs-alerts/master/audio/500.mp3"),
        100: new Audio("https://raw.githubusercontent.com/avramovic/geofs-alerts/master/audio/100.mp3"),
        50: new Audio("https://raw.githubusercontent.com/avramovic/geofs-alerts/master/audio/50.mp3"),
        40: new Audio("https://raw.githubusercontent.com/avramovic/geofs-alerts/master/audio/40.mp3"),
        30: new Audio("https://raw.githubusercontent.com/avramovic/geofs-alerts/master/audio/30.mp3"),
        20: new Audio("https://raw.githubusercontent.com/avramovic/geofs-alerts/master/audio/20.mp3"),
        10: new Audio("https://raw.githubusercontent.com/avramovic/geofs-alerts/master/audio/10.mp3")
    };

    let soundsEnabled = false;
    let lastAltitude = 99999;
    let activeWarning = null;

    // ================= UI SETUP (Top Right) =================
    // UI ni yuqori menyuga qo'shish
    const uiContainer = document.createElement("div");
    uiContainer.id = "gpws-ui-refined";
    uiContainer.style = `
        position: fixed;
        top: 10px;
        right: 60px; 
        background: rgba(0, 0, 0, 0.8);
        color: #00ff00;
        padding: 5px 15px;
        border-radius: 5px;
        font-family: 'Courier New', monospace;
        font-size: 11px;
        z-index: 10000;
        border: 1px solid #444;
        display: flex;
        gap: 10px;
        align-items: center;
    `;
    uiContainer.innerHTML = `
        <span id="gpws-info">GPWS OFF</span>
        <button id="enableSound" style="background:#444; color:white; border:none; cursor:pointer; padding:2px 5px; border-radius:3px;">ENABLE</button>
    `;
    document.body.appendChild(uiContainer);

    document.getElementById("enableSound").onclick = function() {
        soundsEnabled = true;
        this.innerText = "GPWS ON";
        this.style.background = "#006600";
        // Audio contextni aktivlashtirish
        Object.values(AUDIO).forEach(a => { a.play().then(() => { a.pause(); a.currentTime = 0; }); });
    };

    // ================= HELPERS =================
    function ready() { return GW.geofs?.animation?.values && GW.geofs?.aircraft?.instance; }
    function val(n) { return GW.geofs.animation.values[n] || 0; }
    
    function playAlert(type) {
        if (!soundsEnabled) return;
        // Agar muhimroq signal chalinayotgan bo'lsa, boshqasini kutib turamiz
        if (activeWarning && activeWarning !== type && !AUDIO[activeWarning].paused) return;
        
        activeWarning = type;
        if (AUDIO[type].paused) AUDIO[type].play();
    }

    function stopAlert(type) {
        if (AUDIO[type] && !AUDIO[type].paused) {
            AUDIO[type].pause();
            AUDIO[type].currentTime = 0;
            if (activeWarning === type) activeWarning = null;
        }
    }

    // ================= MAIN LOOP =================
    setInterval(() => {
        if (!ready()) return;

        let alt = Math.round(val("altitude") - val("groundElevationFeet"));
        let vs = Math.round(val("verticalSpeed"));
        let spd = Math.round(val("kias"));
        let gear = val("gearPosition") === 1;
        let ground = val("groundContact") === 1;
        let stall = GW.geofs.aircraft.instance.stalling;

        document.getElementById("gpws-info").innerHTML = `ALT: ${alt} | VS: ${vs} | SPD: ${spd}`;

        if (ground) {
            Object.values(AUDIO).forEach(a => { a.pause(); a.currentTime = 0; });
            return;
        }

        // --- PRIORITY LOGIC ---
        
        // 1. STALL (Eng yuqori prioritet)
        if (stall) {
            playAlert('stall');
        } else {
            stopAlert('stall');

            // 2. PULL UP (Yerga yaqin va VS juda katta)
            // Logic: 1500 futdan pastda va VS juda xavfli bo'lsa
            if (alt < 1500 && vs < -3500 || (alt < 500 && vs < -2500)) {
                playAlert('pull');
            } else {
                stopAlert('pull');

                // 3. SINK RATE
                if (alt < 2500 && vs < -2000) {
                    playAlert('sink');
                } else {
                    stopAlert('sink');
                }
            }
        }

        // TOO LOW GEAR (Mustaqil signal)
        if (alt < 500 && !gear && vs < -100) playAlert('gear');
        else stopAlert('gear');

        // OVERSPEED
        if (spd > 350) playAlert('overspeed');
        else stopAlert('overspeed');

        // --- CALLOUTS ---
        for (let h in CALLOUTS) {
            let height = parseInt(h);
            if (alt <= height && lastAltitude > height) {
                if (soundsEnabled) CALLOUTS[h].play();
            }
        }
        
        lastAltitude = alt;
    }, 200);

})();
