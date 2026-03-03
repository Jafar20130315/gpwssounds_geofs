// ==UserScript==
// @name         GPWS sounds, GeoFS.
// @namespace    geofs.gpws.jafar
// @version      3.5
// @description  Hear a warning sounds, it helps you to fly carefully.
// @match        https://www.geo-fs.com/geofs.php*
// @match        https://*.geo-fs.com/geofs.php*
// @grant        none
// ==/UserScript==

(function() {
    "use strict";

    const ICON_URL = "https://cdn-icons-png.flaticon.com/512/2800/2800000.png";

    // 1. SUVGA QO'NUVCHI SAMOLYOTLAR RO'YXATI
    // Agar boshqa samolyotlarni ham qo'shmoqchi bo'lsangiz, nomini shu yerga yozing
    const WATER_PLANES = [
        "Canadair CL-415", 
        "DHC-6 Twin Otter", 
        "Cessna 172 (Floats)", 
        "Hughes H-4 Hercules",
        "Icon A5"
    ];

    const AUDIO = {
        stall: new Audio("https://raw.githubusercontent.com/avramovic/geofs-alerts/master/audio/airbus-stall-warning.mp3"),
        pull: new Audio("https://raw.githubusercontent.com/avramovic/geofs-alerts/master/audio/terrain-terrain-pull-up.mp3"),
        sink: new Audio("https://raw.githubusercontent.com/avramovic/geofs-alerts/master/audio/sink-rate.mp3"),
        gear: new Audio("https://raw.githubusercontent.com/avramovic/geofs-alerts/master/audio/too-low-gear.mp3"),
        overspeed: new Audio("https://raw.githubusercontent.com/avramovic/geofs-alerts/master/audio/overspeed.mp3"),
        bank: new Audio("https://raw.githubusercontent.com/avramovic/geofs-alerts/master/audio/bank-angle.mp3")
    };

    const CALLOUTS = {
        1000: new Audio("https://raw.githubusercontent.com/avramovic/geofs-alerts/master/audio/1000.mp3"),
        500: new Audio("https://raw.githubusercontent.com/avramovic/geofs-alerts/master/audio/500.mp3"),
        100: new Audio("https://raw.githubusercontent.com/avramovic/geofs-alerts/master/audio/100.mp3"),
        50: new Audio("https://raw.githubusercontent.com/avramovic/geofs-alerts/master/audio/50.mp3"),
        10: new Audio("https://raw.githubusercontent.com/avramovic/geofs-alerts/master/audio/10.mp3")
    };

    let soundsEnabled = false;
    let lastAltitude = 99999;
    let activeWarning = null;

    // ================= UI SETUP =================
    function createUI() {
        const bottomBar = document.querySelector(".geofs-ui-bottom");
        if (!bottomBar || document.getElementById("gpws-bottom-icon")) return;

        const uiBtn = document.createElement("div");
        uiBtn.id = "gpws-bottom-icon";
        uiBtn.style = "display:inline-block; vertical-align:middle; margin-left:10px; cursor:pointer; transition:0.3s; opacity:0.5; filter:grayscale(100%);";
        uiBtn.innerHTML = `<img src="${ICON_URL}" width="24" height="24" style="vertical-align:middle;"> <span id="gpws-txt" style="color:white; font-size:10px; font-family:Arial;">OFF</span>`;
        
        bottomBar.appendChild(uiBtn);

        uiBtn.onclick = () => {
            soundsEnabled = !soundsEnabled;
            uiBtn.style.opacity = soundsEnabled ? "1" : "0.5";
            uiBtn.style.filter = soundsEnabled ? "none" : "grayscale(100%)";
            document.getElementById("gpws-txt").innerText = soundsEnabled ? "ON" : "OFF";
            if(soundsEnabled) Object.values(AUDIO).forEach(a => { a.play().then(()=> {a.pause(); a.currentTime=0;}).catch(()=>{}); });
        };
    }

    function playAlert(type) {
        if (!soundsEnabled) return;
        if (activeWarning && activeWarning !== type && !AUDIO[activeWarning].paused) return;
        activeWarning = type;
        if (AUDIO[type].paused) AUDIO[type].play().catch(()=>{});
    }

    function stopAlert(type) {
        if (AUDIO[type] && !AUDIO[type].paused) {
            AUDIO[type].pause();
            AUDIO[type].currentTime = 0;
            if (activeWarning === type) activeWarning = null;
        }
    }

    // ================= MAIN LOOP =================
    function mainLoop() {
        if (!window.geofs?.animation?.values || !window.geofs?.aircraft?.instance) return;

        let aircraftName = window.geofs.aircraft.instance.definition.name;
        let values = window.geofs.animation.values;
        let alt = Math.round(values.altitude - values.groundElevationFeet);
        let vs = Math.round(values.verticalSpeed);
        let roll = Math.abs(values.roll);
        let gearIsDown = values.gearPosition > 0.5; 
        let ground = values.groundContact === 1;
        let stall = window.geofs.aircraft.instance.stalling;

        // 2. SUV SAMOLYOTINI TEKSHIRISH
        let isWaterPlane = WATER_PLANES.some(name => aircraftName.includes(name));

        if (ground) {
            Object.values(AUDIO).forEach(stopAlert);
            return;
        }

        // Warnings logic
        if (stall) playAlert('stall');
        else {
            stopAlert('stall');
            if (alt < 1000 && vs < -3000) playAlert('pull');
            else {
                stopAlert('pull');
                if (alt < 2500 && vs < -2000) playAlert('sink');
                else stopAlert('sink');
            }
        }

        if (roll > 35) playAlert('bank'); else stopAlert('bank');

        // --- SMART GEAR LOGIC ---
        // Agar samolyot suvga qo'nuvchi bo'lsa, Gear signali butunlay o'chiriladi
        if (!isWaterPlane && alt < 500 && alt > 30 && !gearIsDown) {
            playAlert('gear');
        } else {
            stopAlert('gear');
        }

        // Callouts
        for (let h in CALLOUTS) {
            let height = parseInt(h);
            if (alt <= height && lastAltitude > height) {
                if (soundsEnabled) CALLOUTS[h].play().catch(()=>{});
            }
        }
        lastAltitude = alt;
    }

    let checkReady = setInterval(() => {
        if (window.geofs && window.geofs.animation) {
            createUI();
            setInterval(mainLoop, 200);
            clearInterval(checkReady);
        }
    }, 1000);

})();
