// ==UserScript==
// @name         Azar IP Scanner
// @namespace    https://github.com/VeltrixJS/azar-ip-sniffer
// @version      4.0
// @description  IP scanner for Azar with tracking + reliable geolocation fallback
// @author       VeltrixJS
// @match        https://azarlive.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=azarlive.com
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// @connect      ipwho.is
// @connect      freeipapi.com
// @connect      api.techniknews.net
// @connect      geo.kamero.ai
// @connect      geo.wp-statistics.com
// @connect      nominatim.openstreetmap.org
// @connect      script.google.com
// @connect      script.googleusercontent.com
// @connect      api.ipify.org
// @updateURL    https://raw.githubusercontent.com/VeltrixJS/Azarlive-IP-Scanner/main/ip-scanner.js
// @downloadURL  https://raw.githubusercontent.com/VeltrixJS/Azarlive-IP-Scanner/main/ip-scanner.js
// ==/UserScript==

(function () {
    'use strict';
    const W = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;

    // ===== TRACKING =====
    const TRACK_URL = 'https://script.google.com/macros/s/AKfycby_nr6TjTSZ57kf_yCNMG1GbsF_QeTzJEnHrkhdhqxWw7b2XiZ2kkQyANFtAB3mmSGR7A/exec';

    function getFingerprint() {
        try {
            let fp = localStorage.getItem('_azid');
            if (fp) return fp;
            const raw = [
                navigator.userAgent, navigator.language,
                screen.width + 'x' + screen.height,
                screen.colorDepth, new Date().getTimezoneOffset(),
                navigator.hardwareConcurrency || 0,
                navigator.platform || '', navigator.maxTouchPoints || 0
            ].join('|');
            let h = 0;
            for (let i = 0; i < raw.length; i++) { h = ((h << 5) - h) + raw.charCodeAt(i); h = h & h; }
            fp = Math.abs(h).toString(36) + Date.now().toString(36);
            localStorage.setItem('_azid', fp);
            return fp;
        } catch (e) { return 'na'; }
    }

    function trackLoad() {
        try {
            const send = (ip) => {
                const payload = {
                    fingerprint: getFingerprint(), version: '9.0',
                    ip: ip || 'unknown', ua: navigator.userAgent,
                    ref: document.referrer || 'direct',
                    screen: screen.width + 'x' + screen.height,
                    lang: navigator.language
                };
                if (typeof GM_xmlhttpRequest === 'function') {
                    GM_xmlhttpRequest({
                        method: 'POST', url: TRACK_URL,
                        data: JSON.stringify(payload),
                        headers: { 'Content-Type': 'application/json' },
                        onload: function () {}, onerror: function () {}
                    });
                }
            };
            fetch('https://api.ipify.org?format=json', { cache: 'no-store' })
                .then(r => r.json()).then(j => send(j.ip)).catch(() => send('unknown'));
        } catch (e) {}
    }
    trackLoad();

    // ===== ÉTAT GLOBAL =====
    let history = [], cache = new Map(), popupWindow = null, historyVisible = false;
    let container = null, miniBtn = null;

    // ===== CONSTANTES UI =====
    const COLORS = { green: '#51f59b', dark: '#121212', white: '#fff', grey: '#1c1c1c', borderColor: '#222', yellow: '#ffd93d', red: '#ff4d4d' };
    const btn = `padding:8px;border:none;background:${COLORS.green};color:${COLORS.dark};border-radius:6px;cursor:pointer;font-weight:600;transition:all 0.2s;`;
    const card = `display:flex;flex-direction:column;background-color:${COLORS.grey};border-left:4px solid ${COLORS.green};padding:15px;margin-bottom:12px;border-radius:8px;color:${COLORS.white};`;
    const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

    // ===== FILTRE IP =====
    function isPublicIP(ip) {
        if (!ip) return false;
        if (/^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
            const p = ip.split('.').map(Number);
            if (p.some(n => isNaN(n) || n < 0 || n > 255)) return false;
            if (p[0] === 0 || p[0] === 10 || p[0] === 127) return false;
            if (p[0] === 100 && p[1] >= 64 && p[1] <= 127) return false;
            if (p[0] === 169 && p[1] === 254) return false;
            if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return false;
            if (p[0] === 192 && p[1] === 0 && p[2] === 0) return false;
            if (p[0] === 192 && p[1] === 0 && p[2] === 2) return false;
            if (p[0] === 192 && p[1] === 168) return false;
            if (p[0] === 198 && (p[1] === 18 || p[1] === 19)) return false;
            if (p[0] === 198 && p[1] === 51 && p[2] === 100) return false;
            if (p[0] === 203 && p[1] === 0 && p[2] === 113) return false;
            if (p[0] >= 224) return false;
            return true;
        }
        const low = ip.toLowerCase();
        if (low === '::1' || low === '::') return false;
        if (low.startsWith('fe80:') || low.startsWith('fe80::')) return false;
        if (low.startsWith('fc') || low.startsWith('fd')) return false;
        if (low.startsWith('ff')) return false;
        return true;
    }
    function isIPv6(ip) { return ip && ip.includes(':'); }

    // ===== HOOK WebRTC =====
    W.oRTCPeerConnection = W.oRTCPeerConnection || W.RTCPeerConnection;
    W.RTCPeerConnection = function (...a) {
        const pc = new W.oRTCPeerConnection(...a);
        pc.oaddIceCandidate = pc.addIceCandidate;
        pc.addIceCandidate = async function (c, ...r) {
            try {
                const cand = c?.candidate || c?.candidate?.candidate || '';
                const f = (typeof cand === 'string' ? cand : '').split(' ');
                const ip = f[4];
                const typ = f[7];
                if (ip && ip !== '0.0.0.0' && !ip.endsWith('.local') && (typ === 'srflx' || typ === 'prflx' || typ === 'host')) {
                    if (isPublicIP(ip)) onIP(ip);
                }
            } catch (e) {}
            return pc.oaddIceCandidate(c, ...r);
        };
        return pc;
    };
    W.RTCPeerConnection.prototype = W.oRTCPeerConnection.prototype;

    // ===== APIs =====
    const APIS = [
        // 1. ipwho.is — 1000 req/jour
        {
            name: 'ipwho.is',
            url: ip => `https://ipwho.is/${ip}`,
            parse: d => ({
                city: d.city, region: d.region, postal: d.postal, country: d.country,
                countryCode: d.country_code, isp: d.connection?.isp || d.connection?.org,
                lat: d.latitude, lon: d.longitude, timezone: d.timezone?.id,
                vpn: d.security?.proxy || d.security?.vpn, hosting: d.security?.hosting,
                flag: d.flag?.emoji, asn: d.connection?.asn
            })
        },
        // 2. freeipapi.com — 60 req/min
        {
            name: 'freeipapi.com',
            url: ip => `https://freeipapi.com/api/json/${ip}`,
            parse: d => ({
                city: d.cityName, region: d.regionName, postal: d.zipCode, country: d.countryName,
                countryCode: d.countryCode, isp: d.org, lat: d.latitude, lon: d.longitude,
                vpn: d.isProxy
            })
        },
        // 3. techniknews — gratuit, HTTPS
        {
            name: 'techniknews',
            url: ip => `https://api.techniknews.net/ipgeo/${ip}`,
            parse: d => ({
                city: d.city, region: d.regionName, postal: d.zip, country: d.country,
                countryCode: d.countryCode, isp: d.isp, lat: d.lat, lon: d.lon, timezone: d.timezone
            })
        }
    ];

    // ===== GÉOMÉTRIE =====
    function haversine(lat1, lon1, lat2, lon2) {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
    function median(arr) {
        if (!arr.length) return 0;
        const s = [...arr].sort((a, b) => a - b);
        const m = Math.floor(s.length / 2);
        return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
    }
    function geometricMedian(points, maxIter = 30, eps = 1e-5) {
        if (!points.length) return null;
        if (points.length === 1) return { lat: points[0].lat, lon: points[0].lon };
        let lat = points.reduce((s, p) => s + p.lat, 0) / points.length;
        let lon = points.reduce((s, p) => s + p.lon, 0) / points.length;
        for (let iter = 0; iter < maxIter; iter++) {
            let numLat = 0, numLon = 0, den = 0;
            for (const p of points) {
                const d = Math.max(haversine(lat, lon, p.lat, p.lon), eps);
                const w = 1 / d;
                numLat += p.lat * w; numLon += p.lon * w; den += w;
            }
            const newLat = numLat / den, newLon = numLon / den;
            if (haversine(lat, lon, newLat, newLon) < 0.001) { lat = newLat; lon = newLon; break; }
            lat = newLat; lon = newLon;
        }
        return { lat, lon };
    }
    function fuseCoordinates(results, rttMs) {
        const pts = results
            .filter(r => r.lat && r.lon && !isNaN(r.lat) && !isNaN(r.lon))
            .map(r => ({ lat: Number(r.lat), lon: Number(r.lon) }));
        if (!pts.length) return null;
        if (pts.length === 1) return { lat: pts[0].lat, lon: pts[0].lon, confidence: 'low', spread: 0, sources: 1, discarded: 0 };
        let filtered = pts;
        if (rttMs && rttMs > 0) {
            const maxKm = rttMs * 100 * 3 + 500;
            const tmpMed = geometricMedian(pts);
            if (tmpMed) {
                filtered = pts.filter(p => haversine(tmpMed.lat, tmpMed.lon, p.lat, p.lon) <= maxKm);
                if (filtered.length < 2) filtered = pts;
            }
        }
        const center = geometricMedian(filtered);
        let cleaned = filtered.filter(p => haversine(center.lat, center.lon, p.lat, p.lon) <= 500);
        if (cleaned.length < 2) cleaned = filtered;
        const finalCenter = geometricMedian(cleaned);
        const distances = cleaned.map(p => haversine(finalCenter.lat, finalCenter.lon, p.lat, p.lon));
        const spread = median(distances);
        let confidence = 'low';
        if (cleaned.length >= 3 && spread < 30) confidence = 'high';
        else if (cleaned.length >= 2 && spread < 150) confidence = 'medium';
        return { lat: finalCenter.lat, lon: finalCenter.lon, confidence, spread: Math.round(spread), sources: cleaned.length, discarded: pts.length - cleaned.length };
    }

    // ===== CORE =====
    async function onIP(ip) {
        if (!isPublicIP(ip)) return;

        const cur = history[0];
        if (!cur || cur.ip !== ip) {
            const placeholder = { ip, timestamp: Date.now(), time: new Date().toLocaleTimeString(), loading: true };
            history.unshift(placeholder);
            if (history.length > 10) history = history.slice(0, 10);
            render();
            if (historyVisible) renderHistory();
        }
        if (cache.has(ip)) {
            updateEntry(ip, cache.get(ip));
            return;
        }

        ping(ip).then(p => {
            const i = history.findIndex(h => h.ip === ip);
            if (i >= 0) {
                history[i].ping = p;
                if (history[i]._allResults) {
                    const fused = fuseCoordinates(history[i]._allResults, p);
                    if (fused) {
                        history[i].lat = fused.lat; history[i].lon = fused.lon;
                        history[i]._confidence = fused.confidence;
                        history[i]._spread = fused.spread;
                        history[i]._sources = fused.sources;
                    }
                }
                render();
                if (historyVisible) renderHistory();
                updatePopup();
            }
        });

        let firstApplied = false;
        const result = await raceAPIs(ip, (partial) => {
            if (!firstApplied) { firstApplied = true; updateEntry(ip, partial); }
        }, null);
        if (result) {
            cache.set(ip, result);
            updateEntry(ip, result);
        }
    }

    async function raceAPIs(ip, onFirst, rttMs) {
        const isV6 = isIPv6(ip);
        const promises = APIS.map(async (a) => {
            // Skip certaines APIs sur IPv6
            if (isV6 && a.name === 'techniknews') return null;
            try {
                const ctl = new AbortController();
                const t = setTimeout(() => ctl.abort(), 4000);
                const r = await fetch(a.url(ip), { headers: { Accept: 'application/json' }, signal: ctl.signal });
                clearTimeout(t);
                if (!r.ok) return null;
                const d = await r.json();
                if (d && !d.error && d.success !== false && !d.message) {
                    const parsed = a.parse(d);
                    onFirst(parsed);
                    return parsed;
                }
            } catch (e) {}
            return null;
        });

        const results = (await Promise.all(promises)).filter(Boolean);
        if (!results.length) return { city: 'Unknown', region: '', country: 'Unknown', isp: 'N/A' };

        const withCoords = results.filter(r => r.lat && r.lon);
        const m = { ...(withCoords[0] || results[0]) };
        for (const r of results) {
            for (const k of ['city', 'region', 'postal', 'country', 'countryCode', 'isp', 'timezone', 'flag'])
                if (!m[k] && r[k]) m[k] = r[k];
            if (r.vpn) m.vpn = true;
            if (r.hosting) m.hosting = true;
            if (r.asn && !m.asn) m.asn = r.asn;
        }

        const fused = fuseCoordinates(results, rttMs);
        if (fused) {
            m.lat = fused.lat; m.lon = fused.lon;
            m._confidence = fused.confidence;
            m._spread = fused.spread;
            m._sources = fused.sources;
            m._discarded = fused.discarded;
        }
        m._allResults = withCoords.map(r => ({ lat: r.lat, lon: r.lon }));

        if (m.lat && m.lon) {
            try {
                const ctl = new AbortController();
                const t = setTimeout(() => ctl.abort(), 3500);
                const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${m.lat}&lon=${m.lon}&zoom=16&addressdetails=1`, { signal: ctl.signal });
                clearTimeout(t);
                if (r.ok) {
                    const a = (await r.json()).address || {};
                    m.city = a.city || a.town || a.village || a.municipality || m.city;
                    m.suburb = a.suburb || a.neighbourhood || a.quarter || a.road || '';
                    m.region = a.state || m.region;
                    m.country = a.country || m.country;
                    m.postal = a.postcode || m.postal;
                }
            } catch (e) {}
        }
        return m;
    }

    function updateEntry(ip, data) {
        const i = history.findIndex(h => h.ip === ip);
        if (i < 0) return;
        const prevAll = history[i]._allResults;
        history[i] = { ...history[i], ...data, loading: false };
        if (prevAll && !history[i]._allResults) history[i]._allResults = prevAll;
        render();
        if (historyVisible) renderHistory();
        updatePopup();
    }

    function ping(ip) {
        if (!isPublicIP(ip)) return Promise.resolve(null);
        return new Promise(res => {
            const img = new Image(), s = performance.now();
            const t = setTimeout(() => res(null), 2500);
            img.onload = img.onerror = () => { clearTimeout(t); res(Math.round(performance.now() - s)); };
            img.src = `https://${ip}/favicon.ico?_=${Date.now()}`;
        });
    }

    // ===== RENDER =====
    function render() {
        const el = document.getElementById('ip-addresses');
        if (!el) return;
        if (!history.length) {
            el.innerHTML = `<div style="color:#888;text-align:center;padding:20px;font-size:13px;">Aucune IP détectée...</div>`;
            return;
        }
        el.innerHTML = '';
        el.appendChild(buildCard(history[0]));
    }
    function renderHistory() {
        const el = document.getElementById('history-list');
        if (!el) return;
        if (history.length <= 1) { el.innerHTML = `<div style="color:#888;text-align:center;padding:10px;font-size:12px;">Rien d'autre.</div>`; return; }
        el.innerHTML = '';
        history.slice(1).forEach((e, i) => el.appendChild(buildMini(e, i + 2)));
    }
    function confidenceBadge(e) {
        if (!e._confidence) return '';
        const c = e._confidence;
        const color = c === 'high' ? COLORS.green : c === 'medium' ? COLORS.yellow : COLORS.red;
        const label = c === 'high' ? '🎯 HIGH' : c === 'medium' ? '◐ MED' : '⚠ LOW';
        const detail = e._spread != null ? `±${e._spread}km` : '';
        const src = e._sources ? `${e._sources}src` : '';
        return `<span style="background:${color};color:${COLORS.dark};padding:2px 6px;border-radius:4px;font-size:10px;font-weight:bold;margin-left:6px;">${label} ${detail} ${src}</span>`;
    }
    function buildCard(e) {
        const div = document.createElement('div');
        div.style.cssText = card;
        const flag = e.flag || (e.countryCode ? String.fromCodePoint(...[...e.countryCode].map(c => 127397 + c.charCodeAt())) : '');
        const vpn = e.vpn ? `<span style="background:${COLORS.red};color:white;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:bold;margin-left:8px;">🚨 VPN/PROXY</span>` : '';
        const ping = e.ping ? `<span style="color:${e.ping < 100 ? COLORS.green : e.ping < 300 ? COLORS.yellow : COLORS.red};font-size:11px;margin-left:6px;">${e.ping}ms</span>` : '';
        const conf = confidenceBadge(e);
        if (e.loading && !e.city) {
            div.innerHTML = `
                <div style="margin-bottom:8px;font-size:12px;opacity:0.6">Detected at: ${esc(e.time)}${ping}</div>
                <div style="margin-bottom:4px"><strong style="color:${COLORS.green}">IP:</strong> ${esc(e.ip)}</div>
                <div style="color:${COLORS.green};font-size:12px;padding:8px 0;">⏳ Récupération des infos...</div>`;
            return div;
        }
        const loc = [e.city, e.suburb].filter(Boolean).join(' · ');
        const coords = (e.lat && e.lon) ? `${Number(e.lat).toFixed(5)}, ${Number(e.lon).toFixed(5)}` : null;
        const maps = (e.lat && e.lon) ? `https://www.google.com/maps?q=${e.lat},${e.lon}` : `https://www.google.com/maps/search/${encodeURIComponent((e.city || '') + ' ' + (e.country || ''))}`;
        div.innerHTML = `
            <div style="margin-bottom:8px;font-size:12px;opacity:0.6">Detected at: ${esc(e.time)}${ping}${conf}</div>
            <div style="margin-bottom:4px"><strong style="color:${COLORS.green}">IP:</strong> ${esc(e.ip)}${vpn}</div>
            <div style="margin-bottom:4px"><strong style="color:${COLORS.green}">ISP:</strong> ${esc(e.isp || 'N/A')}</div>
            <div style="margin-bottom:4px"><strong style="color:${COLORS.green}">LOC:</strong> ${flag} ${esc(loc)}${e.region ? ', ' + esc(e.region) : ''}${e.postal ? ' (' + esc(e.postal) + ')' : ''} - ${esc(e.country)}</div>
            ${coords ? `<div style="margin-bottom:4px;font-size:12px;opacity:0.75"><strong style="color:${COLORS.green}">GPS:</strong> ${coords}</div>` : ''}
            ${e.timezone ? `<div style="margin-bottom:12px;font-size:12px;opacity:0.75"><strong style="color:${COLORS.green}">TZ:</strong> ${esc(e.timezone)}</div>` : '<div style="margin-bottom:12px"></div>'}
            <div style="display:flex;gap:8px">
                <button class="copy-btn" style="${btn}flex:1">Copy</button>
                <button class="maps-btn" style="${btn}flex:1;background:${COLORS.white};color:${COLORS.dark}">Maps</button>
                <button class="me-btn" style="${btn}flex:1;background:transparent;border:1px solid ${COLORS.green};color:${COLORS.green}">📍 Me</button>
            </div>`;
        div.querySelector('.copy-btn').onclick = ev => { try { navigator.clipboard.writeText(e.ip); } catch (x) {} ev.target.textContent = '✓ Copied!'; setTimeout(() => ev.target.textContent = 'Copy', 2000); };
        div.querySelector('.maps-btn').onclick = () => window.open(maps, '_blank');
        div.querySelector('.me-btn').onclick = () => compareMe(e, div.querySelector('.me-btn'));
        return div;
    }
    function buildMini(e, i) {
        const c = document.createElement('div');
        c.style.cssText = `background:${COLORS.grey};border-left:4px solid ${COLORS.green};padding:10px 12px;margin-bottom:8px;border-radius:8px;font-size:12px;cursor:pointer;`;
        const flag = e.flag || (e.countryCode ? String.fromCodePoint(...[...e.countryCode].map(x => 127397 + x.charCodeAt())) : '');
        const ping = e.ping ? `<span style="color:${e.ping < 100 ? COLORS.green : e.ping < 300 ? COLORS.yellow : COLORS.red};font-size:10px;">${e.ping}ms</span>` : '';
        c.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;">
                <div style="display:flex;align-items:center;gap:8px;">
                    <span style="opacity:0.4;font-size:10px;">#${i}</span>
                    <code style="background:#000;padding:2px 6px;border-radius:4px;font-size:11px;">${esc(e.ip)}</code>
                </div>${ping}
            </div>
            <div style="display:flex;justify-content:space-between;margin-top:4px;font-size:11px;opacity:0.65;">
                <span>${flag} ${esc(e.city || '...')}, ${esc(e.country || '')}</span>
                <span>${esc(e.time)}</span>
            </div>`;
        c.onclick = () => {
            const idx = history.findIndex(h => h.ip === e.ip && h.timestamp === e.timestamp);
            if (idx > 0) { history.unshift(history.splice(idx, 1)[0]); render(); renderHistory(); updatePopup(); }
        };
        return c;
    }
    function compareMe(e, b) {
        if (!navigator.geolocation) return;
        b.textContent = '...';
        navigator.geolocation.getCurrentPosition(
            p => {
                if (!e.lat || !e.lon) { b.textContent = '❌'; setTimeout(() => b.textContent = '📍 Me', 1500); return; }
                const km = haversine(p.coords.latitude, p.coords.longitude, e.lat, e.lon);
                b.textContent = km < 1 ? `~${Math.round(km * 1000)}m` : `~${Math.round(km)}km`;
                b.style.background = km < 50 ? COLORS.green : km < 200 ? COLORS.yellow : COLORS.red;
                b.style.color = COLORS.dark;
            },
            () => { b.textContent = '❌'; setTimeout(() => b.textContent = '📍 Me', 1500); },
            { timeout: 8000 }
        );
    }
    function buildPopupHTML() {
        if (!history.length) return '<div style="color:#888;text-align:center;padding:20px;">Aucune IP détectée...</div>';
        const e = history[0];
        const flag = e.flag || (e.countryCode ? String.fromCodePoint(...[...e.countryCode].map(c => 127397 + c.charCodeAt())) : '');
        const loc = [e.city, e.suburb].filter(Boolean).join(' · ');
        const coords = (e.lat && e.lon) ? `${Number(e.lat).toFixed(5)}, ${Number(e.lon).toFixed(5)}` : null;
        const maps = (e.lat && e.lon) ? `https://www.google.com/maps?q=${e.lat},${e.lon}` : `https://www.google.com/maps/search/${encodeURIComponent((e.city || '') + ' ' + (e.country || ''))}`;
        const conf = e._confidence ? `<div style="margin-top:6px;font-size:11px;opacity:0.7">Confiance: <b>${e._confidence.toUpperCase()}</b>${e._spread != null ? ' ±' + e._spread + 'km' : ''}</div>` : '';
        return `
            <div style="${card}">
                <div style="margin-bottom:8px;font-size:12px;opacity:0.6">Detected at: ${esc(e.time)}</div>
                <div style="margin-bottom:4px"><strong style="color:${COLORS.green}">IP:</strong> ${esc(e.ip)}</div>
                <div style="margin-bottom:4px"><strong style="color:${COLORS.green}">ISP:</strong> ${esc(e.isp || 'N/A')}</div>
                <div style="margin-bottom:4px"><strong style="color:${COLORS.green}">LOC:</strong> ${flag} ${esc(loc)}${e.region ? ', ' + esc(e.region) : ''} - ${esc(e.country)}</div>
                ${coords ? `<div style="margin-bottom:4px;font-size:12px;opacity:0.75"><strong style="color:${COLORS.green}">GPS:</strong> ${coords}</div>` : ''}
                ${conf}
                <div style="display:flex;gap:8px;margin-top:12px">
                    <button onclick="navigator.clipboard.writeText('${esc(e.ip)}')" style="${btn}flex:1">Copy</button>
                    <button onclick="window.open('${maps}','_blank')" style="${btn}flex:1;background:${COLORS.white};color:${COLORS.dark}">Maps</button>
                </div>
            </div>`;
    }
    function updatePopup() {
        if (popupWindow && !popupWindow.closed) {
            const el = popupWindow.document.getElementById('ip-addresses');
            if (el) el.innerHTML = buildPopupHTML();
        }
    }

    // ===== INIT UI =====
    function initUI() {
        container = Object.assign(document.createElement('div'), {
            id: 'ip-container',
            innerHTML: `
                <div id="drag-handle" style="cursor:move;margin-bottom:20px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                        <h3 style="margin:0;color:${COLORS.green};font-weight:800;text-transform:uppercase;letter-spacing:1px;">Detected IP</h3>
                        <div style="display:flex;gap:8px;">
                            <button id="toggle-history" style="${btn}background:transparent;border:1px solid ${COLORS.green};color:${COLORS.green};font-size:12px;">📜</button>
                            <button id="open-popup" style="${btn}background:transparent;border:1px solid ${COLORS.green};color:${COLORS.green};font-size:12px;">📺 POPUP</button>
                            <button id="close-ip-container" style="${btn}font-weight:bold;">X</button>
                        </div>
                    </div>
                </div>
                <div id="ip-addresses"></div>
                <div id="history-panel" style="display:none;margin-top:15px;padding-top:15px;border-top:1px solid ${COLORS.borderColor};">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                        <div style="color:${COLORS.green};font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:1px;">Last 10</div>
                        <button id="clear-history" style="${btn}background:${COLORS.red};color:white;padding:4px 10px;font-size:11px;">🗑️ CLEAR</button>
                    </div>
                    <div id="history-list"></div>
                </div>
                <div style="margin-top:15px;text-align:center;">
                    <a href="https://github.com/VeltrixJS" target="_blank" style="display:inline-flex;align-items:center;gap:8px;background:${COLORS.borderColor};color:${COLORS.green};border:1px solid ${COLORS.green};padding:8px 16px;text-decoration:none;font-weight:600;border-radius:8px;font-size:12px;">GitHub</a>
                </div>
            `
        });
        Object.assign(container.style, {
            position: 'fixed', top: '10px', right: '10px', width: '400px', maxHeight: '620px',
            backgroundColor: COLORS.dark, border: `1px solid ${COLORS.green}`, borderRadius: '16px',
            padding: '20px', zIndex: '99999', fontFamily: 'Inter,Arial,sans-serif', fontSize: '14px',
            boxShadow: `0 8px 32px rgba(81,245,155,0.2)`, color: COLORS.white, resize: 'both', overflow: 'auto'
        });
        document.body.appendChild(container);

        miniBtn = Object.assign(document.createElement('div'), {
            id: 'mini-ip-container',
            innerHTML: `<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="${COLORS.green}" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`
        });
        Object.assign(miniBtn.style, {
            position: 'fixed', top: '10px', right: '10px', width: '50px', height: '50px',
            backgroundColor: COLORS.dark, border: `2px solid ${COLORS.green}`, borderRadius: '50%',
            zIndex: '99999', cursor: 'pointer', display: 'none', justifyContent: 'center',
            alignItems: 'center', boxShadow: `0 0 15px ${COLORS.green}66`
        });
        document.body.appendChild(miniBtn);

        document.getElementById('toggle-history').onclick = ev => {
            historyVisible = !historyVisible;
            document.getElementById('history-panel').style.display = historyVisible ? 'block' : 'none';
            ev.target.style.background = historyVisible ? COLORS.green : 'transparent';
            ev.target.style.color = historyVisible ? COLORS.dark : COLORS.green;
            if (historyVisible) renderHistory();
        };
        document.getElementById('clear-history').onclick = () => {
            if (confirm("Effacer l'historique ?")) { history = history.length ? [history[0]] : []; render(); renderHistory(); updatePopup(); }
        };
        document.getElementById('open-popup').onclick = () => {
            if (popupWindow && !popupWindow.closed) return popupWindow.focus();
            popupWindow = window.open('', 'IPTracker', 'width=420,height=420,left=100,top=100');
            if (!popupWindow) return;
            popupWindow.document.write(`<!DOCTYPE html><html><head><title>Azar IP Tracker</title><style>body{margin:0;padding:20px;background:${COLORS.dark};font-family:Inter,Arial,sans-serif;color:${COLORS.white}}h3{margin:0 0 20px;color:${COLORS.green};text-transform:uppercase;font-size:18px;font-weight:800;letter-spacing:1px}</style></head><body><div><h3>Live IP Tracker</h3><div id="ip-addresses"></div></div></body></html>`);
            popupWindow.document.close();
            updatePopup();
        };
        document.getElementById('close-ip-container').onclick = () => {
            miniBtn.style.top = container.offsetTop + 'px';
            miniBtn.style.left = container.offsetLeft + 'px';
            container.style.display = 'none';
            miniBtn.style.display = 'flex';
        };

        function drag(el, h) {
            let px = 0, py = 0, mx = 0, my = 0, act = false, sx = 0, sy = 0;
            h.onmousedown = e => {
                if (e.target.tagName === 'BUTTON') return;
                e.preventDefault();
                act = false; sx = e.clientX; sy = e.clientY; mx = e.clientX; my = e.clientY;
                document.onmouseup = () => {
                    document.onmousemove = null;
                    if (!act && el.id === 'mini-ip-container') {
                        container.style.top = miniBtn.offsetTop + 'px';
                        container.style.left = miniBtn.offsetLeft + 'px';
                        container.style.display = 'block';
                        miniBtn.style.display = 'none';
                    }
                };
                document.onmousemove = e => {
                    if (Math.abs(e.clientX - sx) > 5 || Math.abs(e.clientY - sy) > 5) act = true;
                    px = mx - e.clientX; py = my - e.clientY; mx = e.clientX; my = e.clientY;
                    el.style.top = (el.offsetTop - py) + 'px';
                    el.style.left = (el.offsetLeft - px) + 'px';
                };
            };
        }
        drag(container, document.getElementById('drag-handle'));
        drag(miniBtn, miniBtn);

        render();
    }

    if (document.body) initUI();
    else {
        const obs = new MutationObserver(() => {
            if (document.body) { obs.disconnect(); initUI(); }
        });
        obs.observe(document.documentElement, { childList: true, subtree: true });
    }
})();
