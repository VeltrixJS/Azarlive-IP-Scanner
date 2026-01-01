// ==UserScript==
// @name         Azar IP Scanner
// @namespace    https://github.com/VeltrixJS/azar-ip-sniffer
// @version      3.0
// @description  IP Tracker for Azar with geolocation support
// @author       VeltrixJS
// @match        https://azarlive.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=azarlive.com
// @grant        none
// ==/UserScript==

(function () {
    'use strict';
    
    
    const API_KEY = ''; // Leave empty to use free APIs
    
    
    const COLORS = {
        green: '#51f59b',
        dark: '#121212',
        white: '#ffffff',
        gray: '#1c1c1c',
        border: '#222'
    };

    const APIS = API_KEY ? [
        { url: (ip) => `https://api.ipgeolocation.io/ipgeo?apiKey=${API_KEY}&ip=${ip}`, parse: d => ({ city: d.city, region: d.state_prov, postal: d.zipcode, country: d.country_name, isp: d.isp }) },
        { url: (ip) => `http://ip-api.com/json/${ip}`, parse: d => ({ city: d.city, region: d.regionName, postal: d.zip, country: d.country, isp: d.isp }) },
        { url: (ip) => `https://ipapi.co/${ip}/json/`, parse: d => ({ city: d.city, region: d.region, postal: d.postal, country: d.country_name, isp: d.org }) },
        { url: (ip) => `https://ipwho.is/${ip}`, parse: d => ({ city: d.city, region: d.region, postal: d.postal, country: d.country, isp: d.connection?.isp }) }
    ] : [
        { url: (ip) => `http://ip-api.com/json/${ip}`, parse: d => ({ city: d.city, region: d.regionName, postal: d.zip, country: d.country, isp: d.isp }) },
        { url: (ip) => `https://ipapi.co/${ip}/json/`, parse: d => ({ city: d.city, region: d.region, postal: d.postal, country: d.country_name, isp: d.org }) },
        { url: (ip) => `https://ipwho.is/${ip}`, parse: d => ({ city: d.city, region: d.region, postal: d.postal, country: d.country, isp: d.connection?.isp }) }
    ];

    const buttonStyle = `padding:8px;border:none;background:${COLORS.green};color:${COLORS.dark};border-radius:6px;cursor:pointer;font-weight:600;transition:all 0.2s;`;
    
    const ipItemStyle = `
        display:flex;
        flex-direction:column;
        background-color:${COLORS.gray};
        border-left:4px solid ${COLORS.green};
        padding:15px;
        margin-bottom:12px;
        border-radius:8px;
        color:${COLORS.white};
    `;

    const ipContainer = Object.assign(document.createElement('div'), {
        id: 'ip-container',
        innerHTML: `
            <div id="drag-handle" style="cursor:move;margin-bottom:20px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                    <h3 style="margin:0;color:${COLORS.green};font-weight:800;text-transform:uppercase;letter-spacing:1px;">Detected IP</h3>
                    <div style="display:flex;gap:8px;">
                        <button id="open-popup" style="${buttonStyle}background:transparent;border:1px solid ${COLORS.green};color:${COLORS.green};font-size:12px;">📺 POPUP</button>
                        <button id="close-ip-container" style="${buttonStyle}font-weight:bold;">X</button>
                    </div>
                </div>
            </div>
            <div id="ip-addresses"></div>
            <div style="margin-top:15px;text-align:center;">
                <a href="https://github.com/VeltrixJS" target="_blank" style="display:inline-flex;align-items:center;gap:8px;background:${COLORS.border};color:${COLORS.green};border:1px solid ${COLORS.green};padding:8px 16px;text-decoration:none;font-weight:600;border-radius:8px;font-size:12px;transition:all 0.2s;" onmouseover="this.style.backgroundColor='${COLORS.green}';this.style.color='${COLORS.dark}';" onmouseout="this.style.backgroundColor='${COLORS.border}';this.style.color='${COLORS.green}';">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.757-1.333-1.757-1.089-.744.084-.729.084-.729 1.205.084 1.84 1.236 1.84 1.236 1.07 1.835 2.809 1.304 3.495.997.108-.775.418-1.305.762-1.605-2.665-.305-5.466-1.332-5.466-5.93 0-1.31.469-2.381 1.236-3.221-.124-.303-.535-1.523.117-3.176 0 0 1.008-.322 3.301 1.23a11.5 11.5 0 013.003-.404c1.018.005 2.045.138 3.003.404 2.292-1.552 3.298-1.23 3.298-1.23.653 1.653.242 2.873.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.61-2.803 5.624-5.475 5.921.43.372.823 1.102.823 2.222 0 1.606-.015 2.896-.015 3.286 0 .319.218.694.825.576C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg> GitHub
                </a>
            </div>
        `
    });

    Object.assign(ipContainer.style, {
        position: 'fixed', top: '10px', right: '10px', width: '400px', maxHeight: '500px',
        backgroundColor: COLORS.dark, border: `1px solid ${COLORS.green}`, borderRadius: '16px',
        padding: '20px', zIndex: '10000', fontFamily: 'Inter,Arial,sans-serif', fontSize: '14px',
        boxShadow: `0 8px 32px rgba(81,245,155,0.2)`, color: COLORS.white, resize: 'both', overflow: 'auto'
    });

    document.body.appendChild(ipContainer);

    const miniContainer = Object.assign(document.createElement('div'), {
        id: 'mini-ip-container',
        innerHTML: `<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="${COLORS.green}" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`
    });

    Object.assign(miniContainer.style, {
        position: 'fixed', top: '10px', right: '10px', width: '50px', height: '50px',
        backgroundColor: COLORS.dark, border: `2px solid ${COLORS.green}`, borderRadius: '50%',
        zIndex: '10000', cursor: 'pointer', display: 'none', justifyContent: 'center',
        alignItems: 'center', boxShadow: `0 0 15px ${COLORS.green}66`
    });

    document.body.appendChild(miniContainer);

    let popupWindow = null;

    const setupEventListeners = () => {
        document.getElementById('open-popup').onclick = () => {
            if (popupWindow && !popupWindow.closed) return popupWindow.focus();

            popupWindow = window.open('', 'IPTracker', 'width=420,height=380,left=100,top=100');
            popupWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Azar IP Tracker</title>
                    <style>
                        body{margin:0;padding:20px;background:${COLORS.dark};font-family:Inter,Arial,sans-serif;color:${COLORS.white}}
                        h3{margin:0 0 20px;color:${COLORS.green};text-transform:uppercase;font-size:18px;font-weight:800;letter-spacing:1px}
                        .ip-item{${ipItemStyle}}
                        .ip-item strong{color:${COLORS.green};margin-right:5px}
                        .time-label{margin-bottom:8px;font-size:12px;opacity:0.6}
                        .info-line{margin-bottom:4px}
                        .ip-buttons{display:flex;gap:8px;margin-top:12px}
                        button{${buttonStyle}flex:1}
                        button:hover{opacity:0.8;transform:translateY(-1px)}
                        .maps-btn{background:${COLORS.white}!important;color:${COLORS.dark}!important}
                        .github-link{display:inline-flex;align-items:center;gap:8px;background:${COLORS.border};color:${COLORS.green};border:1px solid ${COLORS.green};padding:8px 16px;text-decoration:none;font-weight:600;border-radius:8px;font-size:12px;transition:all 0.2s;margin-top:15px}
                        .github-link:hover{background:${COLORS.green};color:${COLORS.dark}}
                    </style>
                </head>
                <body>
                    <div id="ip-container">
                        <h3>Live IP Tracker</h3>
                        <div id="ip-addresses"></div>
                        <div style="text-align:center">
                            <a href="https://github.com/VeltrixJS" target="_blank" class="github-link">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.757-1.333-1.757-1.089-.744.084-.729.084-.729 1.205.084 1.84 1.236 1.84 1.236 1.07 1.835 2.809 1.304 3.495.997.108-.775.418-1.305.762-1.605-2.665-.305-5.466-1.332-5.466-5.93 0-1.31.469-2.381 1.236-3.221-.124-.303-.535-1.523.117-3.176 0 0 1.008-.322 3.301 1.23a11.5 11.5 0 013.003-.404c1.018.005 2.045.138 3.003.404 2.292-1.552 3.298-1.23 3.298-1.23.653 1.653.242 2.873.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.61-2.803 5.624-5.475 5.921.43.372.823 1.102.823 2.222 0 1.606-.015 2.896-.015 3.286 0 .319.218.694.825.576C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>GitHub
                            </a>
                        </div>
                    </div>
                </body>
                </html>
            `);
            popupWindow.document.close();
        };

        document.getElementById('close-ip-container').onclick = () => {
            miniContainer.style.top = ipContainer.offsetTop + 'px';
            miniContainer.style.left = ipContainer.offsetLeft + 'px';
            ipContainer.style.display = 'none';
            miniContainer.style.display = 'flex';
        };
    };

    setupEventListeners();

    const makeDraggable = (el, handle) => {
        let pos = { x: 0, y: 0, mouseX: 0, mouseY: 0 };
        let drag = { active: false, startX: 0, startY: 0 };

        handle.onmousedown = (e) => {
            e.preventDefault();
            drag = { active: false, startX: e.clientX, startY: e.clientY };
            pos.mouseX = e.clientX;
            pos.mouseY = e.clientY;

            document.onmouseup = () => {
                document.onmousemove = null;
                if (!drag.active && el.id === 'mini-ip-container') {
                    ipContainer.style.top = miniContainer.offsetTop + 'px';
                    ipContainer.style.left = miniContainer.offsetLeft + 'px';
                    ipContainer.style.display = 'block';
                    miniContainer.style.display = 'none';
                    setupEventListeners();
                }
            };

            document.onmousemove = (e) => {
                if (Math.abs(e.clientX - drag.startX) > 5 || Math.abs(e.clientY - drag.startY) > 5) drag.active = true;
                pos.x = pos.mouseX - e.clientX;
                pos.y = pos.mouseY - e.clientY;
                pos.mouseX = e.clientX;
                pos.mouseY = e.clientY;
                el.style.top = (el.offsetTop - pos.y) + "px";
                el.style.left = (el.offsetLeft - pos.x) + "px";
            };
        };
    };

    makeDraggable(ipContainer, document.getElementById('drag-handle'));
    makeDraggable(miniContainer, miniContainer);

    const fetchIPData = async (ip) => {
        for (const api of APIS) {
            try {
                const res = await fetch(api.url(ip));
                const data = await res.json();
                if (data && !data.error && data.status !== 'fail' && !data.message) {
                    const parsed = api.parse(data);
                    return { ...parsed, isp: parsed.isp || 'N/A' };
                }
            } catch (e) { continue; }
        }
        return null;
    };

    const createIPDisplay = (ip, data, time) => {
        const { city = 'Unknown', region = 'Unknown', postal = '', country = 'Unknown', isp = 'N/A' } = data || {};
        const dept = postal ? postal.substring(0, 2) : '??';
        const mapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(city + ' ' + country)}`;

        const ipItem = Object.assign(document.createElement('div'), {
            innerHTML: `
                <div style="margin-bottom:8px;font-size:12px;opacity:0.6">Detected at: ${time}</div>
                <div style="margin-bottom:4px"><strong style="color:${COLORS.green}">IP:</strong> ${ip}</div>
                <div style="margin-bottom:4px"><strong style="color:${COLORS.green}">ISP:</strong> ${isp}</div>
                <div style="margin-bottom:12px"><strong style="color:${COLORS.green}">LOC:</strong> ${city}, ${region} (${dept}) - ${country}</div>
                <div style="display:flex;gap:8px">
                    <button class="copy-btn" style="${buttonStyle}flex:1">Copy</button>
                    <button class="maps-btn" style="${buttonStyle}flex:1;background:${COLORS.white};color:${COLORS.dark}">Maps</button>
                </div>
            `
        });

        ipItem.style.cssText = ipItemStyle;
        ipItem.querySelector('.copy-btn').onclick = () => navigator.clipboard.writeText(ip);
        ipItem.querySelector('.maps-btn').onclick = () => window.open(mapsUrl, '_blank');

        return { element: ipItem, html: `
            <div class="ip-item">
                <div class="time-label">Detected at: ${time}</div>
                <div class="info-line"><strong>IP:</strong> ${ip}</div>
                <div class="info-line"><strong>ISP:</strong> ${isp}</div>
                <div class="info-line" style="margin-bottom:12px"><strong>LOC:</strong> ${city}, ${region} (${dept}) - ${country}</div>
                <div class="ip-buttons">
                    <button onclick="navigator.clipboard.writeText('${ip}')">Copy</button>
                    <button class="maps-btn" onclick="window.open('${mapsUrl}','_blank')">Maps</button>
                </div>
            </div>
        `};
    };

    let currentIP = null;
    window.oRTCPeerConnection = window.oRTCPeerConnection || window.RTCPeerConnection;

    window.RTCPeerConnection = function (...args) {
        const pc = new window.oRTCPeerConnection(...args);
        pc.oaddIceCandidate = pc.addIceCandidate;

        pc.addIceCandidate = async function (iceCandidate, ...rest) {
            if (iceCandidate?.candidate) {
                const fields = iceCandidate.candidate.split(' ');
                if (fields[7] === 'srflx') {
                    const ip = fields[4];
                    if (currentIP !== ip) {
                        currentIP = ip;
                        const ipAddresses = document.getElementById('ip-addresses');
                        ipAddresses.innerHTML = '';
                        if (popupWindow && !popupWindow.closed) popupWindow.document.getElementById('ip-addresses').innerHTML = '';

                        const data = await fetchIPData(ip);
                        const time = new Date().toLocaleTimeString();
                        const { element, html } = createIPDisplay(ip, data, time);

                        ipAddresses.appendChild(element);
                        if (popupWindow && !popupWindow.closed) popupWindow.document.getElementById('ip-addresses').innerHTML += html;
                    }
                }
            }
            return pc.oaddIceCandidate(iceCandidate, ...rest);
        };
        return pc;
    };
})();
