// ==UserScript==
// @name         GeoFS Advanced GPWS + Alerts (Full Pack)
// @namespace    geofs.gpws.jafar
// @version      2.0
// @description  Full GPWS system with realistic alerts
// @match        https://www.geo-fs.com/geofs.php*
// @grant        none
// ==/UserScript==

(function() {
"use strict";

const GW = window;

// ================= AUDIO FILES =================
const AUDIO = {
  stall: new Audio("https://raw.githubusercontent.com/avramovic/geofs-alerts/master/audio/airbus-stall-warning.mp3"),
  sink: new Audio("https://raw.githubusercontent.com/avramovic/geofs-alerts/master/audio/sink-rate.mp3"),
  pull: new Audio("https://raw.githubusercontent.com/avramovic/geofs-alerts/master/audio/terrain-terrain-pull-up.mp3"),
  gear: new Audio("https://raw.githubusercontent.com/avramovic/geofs-alerts/master/audio/too-low-gear.mp3"),
  overspeed: new Audio("https://raw.githubusercontent.com/avramovic/geofs-alerts/master/audio/overspeed.mp3")
};

Object.values(AUDIO).forEach(a=>{
  a.volume = 0.8;
});

// Height callouts
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

// ================= OVERLAY =================
const overlay = document.createElement("div");
overlay.style = `
position:fixed;
bottom:10px;
left:10px;
background:rgba(0,0,0,0.7);
color:white;
padding:10px;
font-size:12px;
border-radius:10px;
z-index:99999;
font-family:Arial;
`;
overlay.innerHTML = `
<b>GeoFS GPWS</b><br>
<span id="spd">SPD: -</span><br>
<span id="alt">ALT: -</span><br>
<span id="vs">VS: -</span><br>
<button id="enableSound">Enable Sound</button>
`;
document.body.appendChild(overlay);

document.getElementById("enableSound").onclick = ()=>{
  soundsEnabled = true;
  Object.values(AUDIO).forEach(a=>a.play().then(()=>{a.pause();a.currentTime=0;}));
  Object.values(CALLOUTS).forEach(a=>a.play().then(()=>{a.pause();a.currentTime=0;}));
};

// ================= HELPERS =================
function ready(){
  return GW.geofs && GW.geofs.animation && GW.geofs.aircraft && GW.geofs.aircraft.instance;
}

function val(name){
  try { return GW.geofs.animation.values[name] || 0; }
  catch(e){ return 0; }
}

function agl(){
  let alt = val("altitude");
  let ground = val("groundElevationFeet");
  return Math.max(0, Math.round(alt-ground));
}

function vs(){ return Math.round(val("verticalSpeed")); }
function kias(){ return Math.round(val("kias")); }
function gearDown(){ return val("gearPosition") === 1; }
function onGround(){ return val("groundContact") === 1; }
function stallFlag(){ try{return GW.geofs.aircraft.instance.stalling;}catch(e){return false;} }

function play(a){
  if(!soundsEnabled) return;
  if(a.paused) a.play().catch(()=>{});
}
function stop(a){
  if(!a.paused){ a.pause(); a.currentTime=0; }
}

// ================= MAIN LOOP =================
setInterval(()=>{

if(!ready()) return;

let altitude = agl();
let vertical = vs();
let speed = kias();
let stall = stallFlag();

document.getElementById("spd").innerText="SPD: "+speed+" KTS";
document.getElementById("alt").innerText="ALT: "+altitude+" ft AGL";
document.getElementById("vs").innerText="VS: "+vertical+" fpm";

// ===== STALL =====
if(!onGround() && stall) play(AUDIO.stall);
else stop(AUDIO.stall);

// ===== SINK RATE =====
if(!onGround() && altitude<2500 && vertical<-2000)
  play(AUDIO.sink);
else stop(AUDIO.sink);

// ===== PULL UP =====
if(!onGround() && altitude<1000 && vertical<-3000)
  play(AUDIO.pull);
else stop(AUDIO.pull);

// ===== TOO LOW GEAR =====
if(!onGround() && altitude<500 && !gearDown())
  play(AUDIO.gear);
else stop(AUDIO.gear);

// ===== OVERSPEED =====
if(speed>340)
  play(AUDIO.overspeed);
else stop(AUDIO.overspeed);

// ===== HEIGHT CALLOUTS =====
if(altitude < lastAltitude){
  for(let h in CALLOUTS){
    if(altitude<=h && lastAltitude>h){
      play(CALLOUTS[h]);
    }
  }
}
lastAltitude = altitude;

}, 300);

})();
