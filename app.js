'use strict';

// Wind Check — open it, see the wind. Nothing else.
// Data: Open-Meteo (free, no key). Wind direction is reported as the
// direction the wind blows FROM, in degrees — the hunting convention.
// The dial is a live compass: it rotates with the phone, so the top of
// the screen is always the direction you are facing (white marker).

var FALLBACK = { lat: 42.7325, lon: -84.5555, label: 'Lansing, MI (location off)' };
var POINTS = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];

var els = {
  point: document.getElementById('compass-point'),
  deg: document.getElementById('compass-deg'),
  arrow: document.getElementById('wind-arrow'),
  rotor: document.getElementById('rotor'),
  facing: document.getElementById('facing'),
  speed: document.getElementById('speed'),
  gusts: document.getElementById('gusts'),
  status: document.getElementById('status'),
  refresh: document.getElementById('refresh'),
  compassBtn: document.getElementById('compass-btn'),
  ticks: document.getElementById('ticks')
};

// Tick marks around the dial (long at cardinals, short at intercardinals)
(function buildTicks() {
  var SVGNS = 'http://www.w3.org/2000/svg';
  for (var a = 0; a < 360; a += 45) {
    var long = (a % 90 === 0);
    var rad = (a - 90) * Math.PI / 180;
    var r1 = long ? 84 : 88, r2 = 94;
    var line = document.createElementNS(SVGNS, 'line');
    line.setAttribute('x1', 100 + r1 * Math.cos(rad));
    line.setAttribute('y1', 100 + r1 * Math.sin(rad));
    line.setAttribute('x2', 100 + r2 * Math.cos(rad));
    line.setAttribute('y2', 100 + r2 * Math.sin(rad));
    line.setAttribute('stroke', 'rgba(242,245,240,.4)');
    line.setAttribute('stroke-width', long ? 2.5 : 1.5);
    els.ticks.appendChild(line);
  }
})();

function compassPoint(deg) {
  return POINTS[Math.round(deg / 22.5) % 16];
}

/* ---------------- Weather ---------------- */

function fetchWind(lat, lon, placeLabel) {
  var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat.toFixed(4) +
    '&longitude=' + lon.toFixed(4) +
    '&current=wind_speed_10m,wind_direction_10m,wind_gusts_10m' +
    '&wind_speed_unit=mph&timezone=auto';
  els.status.textContent = 'Checking the wind…';
  fetch(url)
    .then(function (r) {
      if (!r.ok) throw new Error('weather service ' + r.status);
      return r.json();
    })
    .then(function (data) {
      var c = data.current;
      var dir = c.wind_direction_10m;
      var spd = Math.round(c.wind_speed_10m);
      var gst = Math.round(c.wind_gusts_10m);
      els.point.textContent = compassPoint(dir);
      els.deg.textContent = Math.round(dir) + '°';
      // Arrow points where the wind is blowing TO (from-direction + 180).
      els.arrow.setAttribute('transform', 'rotate(' + ((dir + 180) % 360) + ' 100 100)');
      els.speed.textContent = spd;
      // Flow animation speed follows the actual wind: calm = paused,
      // stronger wind = faster stream. ~0.45s at 35+ mph, ~2.4s when light.
      var root = document.documentElement.style;
      if (spd <= 1) {
        root.setProperty('--flow-play', 'paused');
      } else {
        root.setProperty('--flow-play', 'running');
        root.setProperty('--flow-dur', Math.max(0.45, Math.min(2.4, 2.4 - spd * 0.055)).toFixed(2) + 's');
      }
      els.gusts.innerHTML = gst > spd ? 'Gusts to <b>' + gst + ' mph</b>' : '&nbsp;';
      var t = new Date(c.time);
      var when = t.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      els.status.textContent = placeLabel + ' · updated ' + when;
    })
    .catch(function () {
      els.status.textContent = 'Could not load wind. Check your connection and tap Refresh.';
    });
}

function load() {
  if ('geolocation' in navigator) {
    navigator.geolocation.getCurrentPosition(
      function (pos) {
        fetchWind(pos.coords.latitude, pos.coords.longitude, 'Your location');
      },
      function () {
        fetchWind(FALLBACK.lat, FALLBACK.lon, FALLBACK.label);
      },
      { timeout: 10000, maximumAge: 300000 }
    );
  } else {
    fetchWind(FALLBACK.lat, FALLBACK.lon, FALLBACK.label);
  }
}

/* ---------------- Live compass ---------------- */

var compassOn = false;
var shownHeading = null; // smoothed heading currently displayed

function setHeading(heading) {
  if (heading === null || isNaN(heading)) return;
  heading = ((heading % 360) + 360) % 360;
  if (shownHeading === null) {
    shownHeading = heading;
  } else {
    // Move the short way around the circle, with smoothing.
    var diff = ((heading - shownHeading + 540) % 360) - 180;
    shownHeading = ((shownHeading + diff * 0.35) % 360 + 360) % 360;
  }
  els.rotor.style.transform = 'rotate(' + (-shownHeading) + 'deg)';
  els.facing.innerHTML = 'You are facing <b>' + compassPoint(shownHeading) + '</b> <span>(' + Math.round(shownHeading) + '°)</span>';
}

function onOrient(event) {
  var heading = null;
  if (typeof event.webkitCompassHeading === 'number') {
    heading = event.webkitCompassHeading; // iOS: degrees clockwise from north
  } else if (event.absolute && typeof event.alpha === 'number') {
    heading = 360 - event.alpha; // Android absolute orientation
  } else if (typeof event.alpha === 'number') {
    heading = 360 - event.alpha;
  }
  if (heading !== null) {
    compassOn = true;
    els.compassBtn.style.display = 'none';
    setHeading(heading);
  }
}

function startCompass() {
  window.addEventListener('deviceorientationabsolute', onOrient, true);
  window.addEventListener('deviceorientation', onOrient, true);
  // If permission is fine but no heading ever arrives, say so instead of
  // leaving a silently dead dial.
  setTimeout(function () {
    if (!compassOn) {
      els.facing.innerHTML = '<span>No compass heading yet — if the dial stays still, wave the phone in a slow figure-8</span>';
    }
  }, 3000);
}

if (typeof DeviceOrientationEvent !== 'undefined' &&
    typeof DeviceOrientationEvent.requestPermission === 'function') {
  // iOS: ask only from a deliberate tap on the button — the v2 flow, which
  // worked. (v3.3 asked on the first tap ANYWHERE: one stray tap consumed
  // the single request, a denial or error then hid the button with no way
  // to retry, and the weather refresh overwrote the explanation in the
  // status line within seconds. All three failure modes are removed here:
  // button only, button stays on failure so he can retry, and compass
  // messages go on the facing line, which the weather code never touches.)
  els.compassBtn.style.display = 'inline-block';
  els.facing.innerHTML = '<span>Tap Enable Live Compass to make the dial follow your phone</span>';
  var compassAsking = false;
  var askCompass = function () {
    if (compassAsking || compassOn) return;
    compassAsking = true;
    DeviceOrientationEvent.requestPermission().then(function (result) {
      compassAsking = false;
      if (result === 'granted') {
        els.compassBtn.style.display = 'none';
        startCompass();
      } else {
        els.facing.innerHTML = '<span>Compass permission was not given — tap Enable Live Compass to try again</span>';
      }
    }).catch(function () {
      compassAsking = false;
      els.facing.innerHTML = '<span>Compass did not start — tap Enable Live Compass to try again</span>';
    });
  };
  els.compassBtn.addEventListener('click', askCompass);
} else if (typeof DeviceOrientationEvent !== 'undefined') {
  // Android / desktop browsers with a sensor: no permission step.
  startCompass();
}

/* ---------------- Wiring ---------------- */

els.refresh.addEventListener('click', load);
document.addEventListener('visibilitychange', function () {
  if (!document.hidden) load();
});
setInterval(load, 10 * 60 * 1000);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js').catch(function () { /* offline is a bonus, not a requirement */ });
  });
}

load();
