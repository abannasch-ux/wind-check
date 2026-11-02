'use strict';

// Wind Check — open it, see the wind. Nothing else.
// Data: Open-Meteo (free, no key). Wind direction is reported as the
// direction the wind blows FROM, in degrees — the hunting convention.

var FALLBACK = { lat: 42.7325, lon: -84.5555, label: 'Lansing, MI (location off)' };
var POINTS = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];

var els = {
  point: document.getElementById('compass-point'),
  deg: document.getElementById('compass-deg'),
  arrow: document.getElementById('arrow'),
  speed: document.getElementById('speed'),
  gusts: document.getElementById('gusts'),
  status: document.getElementById('status'),
  refresh: document.getElementById('refresh'),
  dial: document.getElementById('dial')
};

// Compass ticks around the dial (N/E/S/W)
(function buildTicks() {
  var labels = [['N', 0], ['E', 90], ['S', 180], ['W', 270]];
  labels.forEach(function (pair) {
    var el = document.createElement('div');
    el.className = 'tick';
    el.textContent = pair[0];
    var rad = (pair[1] - 90) * Math.PI / 180;
    var r = 0; // positioned via transform below
    el.style.transform = 'rotate(' + pair[1] + 'deg) translateY(-' + (els.dial.clientWidth / 2 - 16) + 'px) rotate(-' + pair[1] + 'deg) translate(-50%, -50%)';
    els.dial.appendChild(el);
  });
})();

function compassPoint(deg) {
  return POINTS[Math.round(deg / 22.5) % 16];
}

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
      els.arrow.style.transform = 'rotate(' + ((dir + 180) % 360) + 'deg)';
      els.speed.textContent = spd;
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
