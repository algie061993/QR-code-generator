let qrCodeInstance = null;
let activeTab = 'url';
let logoImageObj = null; // Store loaded HTMLImageElement
const allowedHistoryTypes = new Set(['url', 'vcard', 'email', 'sms', 'location']);
let historyData = [];

try {
    const storedHistory = JSON.parse(localStorage.getItem('qr_history_pro') || '[]');
    if (Array.isArray(storedHistory)) {
        historyData = storedHistory.filter(item =>
            item && allowedHistoryTypes.has(item.type) && typeof item.payload === 'string'
        ).slice(0, 15);
    }
    localStorage.setItem('qr_history_pro', JSON.stringify(historyData));
} catch {
    localStorage.removeItem('qr_history_pro');
}

// Element Selectors
const qrcodeContainer = document.getElementById('qrcode');
const exportCanvas = document.getElementById('export-canvas');
const contrastBadge = document.getElementById('contrast-badge');
const contrastText = document.getElementById('contrast-text');

// Customization Inputs
const fgColorInput = document.getElementById('fg-color');
const fgHexInput = document.getElementById('fg-color-hex');
const bgColorInput = document.getElementById('bg-color');
const bgHexInput = document.getElementById('bg-color-hex');
const optSize = document.getElementById('opt-size');
const optMargin = document.getElementById('opt-margin');
const optEcl = document.getElementById('opt-ecl');
const logoInput = document.getElementById('logo-input');
const btnRemoveLogo = document.getElementById('btnRemoveLogo');
const optLogoSize = document.getElementById('opt-logo-size');
const logoSizeContainer = document.getElementById('logo-size-container');

const themeToggleBtn = document.getElementById('themeToggle');

if (localStorage.getItem('theme') === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
} else {
    document.documentElement.classList.remove('dark');
}

themeToggleBtn.addEventListener('click', () => {
    document.documentElement.classList.toggle('dark');
    const isDark = document.documentElement.classList.contains('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
});

const tabBtns = document.querySelectorAll('.tab-btn');
const tabPanels = document.querySelectorAll('.tab-panel');

tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        activeTab = tab;

        // Update tab styles
        tabBtns.forEach(b => {
            b.classList.remove('bg-blue-600', 'text-white', 'shadow-sm');
            b.classList.add('text-slate-600', 'dark:text-slate-300', 'hover:bg-slate-100', 'dark:hover:bg-slate-800');
        });
        btn.classList.remove('text-slate-600', 'dark:text-slate-300', 'hover:bg-slate-100', 'dark:hover:bg-slate-800');
        btn.classList.add('bg-blue-600', 'text-white', 'shadow-sm');

        // Toggle visibility of panels
        tabPanels.forEach(p => p.classList.add('hidden'));
        document.getElementById(`panel-${tab}`).classList.remove('hidden');
        updateHistorySaveButton();

        generateQRCode();
    });
});

function getPayload() {
    switch(activeTab) {
        case 'url':
            return document.getElementById('input-url').value.trim() || 'https://example.com';
        
        case 'wifi': {
            const ssid = document.getElementById('wifi-ssid').value.trim();
            const type = document.getElementById('wifi-type').value;
            const pass = document.getElementById('wifi-password').value;
            const hidden = document.getElementById('wifi-hidden').checked;
            if (!ssid) return 'WIFI:S:MyNetwork;T:WPA;P:password;;';
            return `WIFI:S:${ssid};T:${type};P:${pass};H:${hidden ? 'true' : 'false'};;;`;
        }

        case 'vcard': {
            const fn = document.getElementById('vcard-fname').value.trim();
            const ln = document.getElementById('vcard-lname').value.trim();
            const phone = document.getElementById('vcard-phone').value.trim();
            const email = document.getElementById('vcard-email').value.trim();
            const org = document.getElementById('vcard-org').value.trim();
            const url = document.getElementById('vcard-url').value.trim();

                    return `BEGIN:VCARD\nVERSION:3.0\nN:${ln};${fn};;;\nFN:${fn} ${ln}\nTEL:${phone}\nEMAIL:${email}\nORG:${org}\nURL:${url}\nEND:VCARD`;
        }

        case 'email': {
            const to = document.getElementById('email-to').value.trim();
            const sub = encodeURIComponent(document.getElementById('email-subject').value.trim());
            const body = encodeURIComponent(document.getElementById('email-body').value.trim());
                    return `mailto:${to}?subject=${sub}&body=${body}`;
        }

        case 'sms': {
            const phone = document.getElementById('sms-phone').value.trim();
            const msg = encodeURIComponent(document.getElementById('sms-message').value.trim());
                    return `SMSTO:${phone}:${msg}`;
        }

        case 'location': {
            const lat = document.getElementById('loc-lat').value || '37.7749';
            const lng = document.getElementById('loc-lng').value || '-122.4194';
                    return `geo:${lat},${lng}`;
        }

        default:
            return 'https://example.com';
    }
}

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
}

function getLuminance(r, g, b) {
    const a = [r, g, b].map(v => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

function checkContrast(fgHex, bgHex) {
    const rgb1 = hexToRgb(fgHex);
    const rgb2 = hexToRgb(bgHex);
    const l1 = getLuminance(rgb1.r, rgb1.g, rgb1.b);
    const l2 = getLuminance(rgb2.r, rgb2.g, rgb2.b);
    
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);

    if (ratio < 2.5) {
        contrastBadge.className = "flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300";
        contrastBadge.firstElementChild.className = "fa-solid fa-triangle-exclamation";
        contrastText.textContent = "Poor Contrast (May not scan)";
    } else if (ratio < 4.5) {
        contrastBadge.className = "flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300";
        contrastBadge.firstElementChild.className = "fa-solid fa-circle-info";
        contrastText.textContent = "Fair Contrast";
    } else {
        contrastBadge.className = "flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300";
        contrastBadge.firstElementChild.className = "fa-solid fa-circle-check";
        contrastText.textContent = "Good Contrast";
    }
}

function generateQRCode() {
    const payload = getPayload();
    const fgColor = fgColorInput.value;
    const bgColor = bgColorInput.value;
    const size = parseInt(optSize.value);
    const ecl = optEcl.value;

    // Clear hidden container completely before generating new matrix
    qrcodeContainer.innerHTML = '';

    // Check Contrast Ratio
    checkContrast(fgColor, bgColor);

    // Generate matrix in off-screen container
    qrCodeInstance = new QRCode(qrcodeContainer, {
        text: payload,
        width: size,
        height: size,
        colorDark: fgColor,
        colorLight: bgColor,
        correctLevel: QRCode.CorrectLevel[ecl]
    });

    // Poll for completion and composite cleanly to single visible canvas
    const renderCheckInterval = setInterval(() => {
        const qrCanvas = qrcodeContainer.querySelector('canvas');
        const qrImg = qrcodeContainer.querySelector('img');
        const renderSource = qrCanvas || qrImg;

        if (renderSource && (renderSource.tagName === 'CANVAS' || (renderSource.tagName === 'IMG' && renderSource.complete && renderSource.naturalWidth > 0))) {
            clearInterval(renderCheckInterval);
            applyCanvasEffects(renderSource);
        }
    }, 30);
}

function applyCanvasEffects(renderSource) {
    if (!renderSource) {
        renderSource = qrcodeContainer.querySelector('canvas') || qrcodeContainer.querySelector('img');
    }
    if (!renderSource) return;

    const size = parseInt(optSize.value);
    const margin = parseInt(optMargin.value) * 8; // Margin scaling
    const totalSize = size + margin * 2;

    // High DPI Canvas setup
    const dpr = window.devicePixelRatio || 1;
    exportCanvas.width = totalSize * dpr;
    exportCanvas.height = totalSize * dpr;
            exportCanvas.style.width = `${totalSize}px`;
            exportCanvas.style.height = `${totalSize}px`;

    const ctx = exportCanvas.getContext('2d');
    ctx.scale(dpr, dpr);

    // Clear Canvas completely
    ctx.clearRect(0, 0, totalSize, totalSize);

    // Draw Background
    ctx.fillStyle = bgColorInput.value;
    ctx.fillRect(0, 0, totalSize, totalSize);

    // Draw primary QR matrix image
    ctx.drawImage(renderSource, margin, margin, size, size);

    // Overlay Logo if present and loaded
    if (logoImageObj && logoImageObj.complete && logoImageObj.naturalWidth !== 0) {
        const logoPercent = parseInt(optLogoSize.value) / 100;
        const logoSize = totalSize * logoPercent;
        
        // Perfect mathematical center alignment based on canvas size
        const logoX = (totalSize - logoSize) / 2;
        const logoY = (totalSize - logoSize) / 2;

        // Draw solid background badge behind logo for scan readability
        const padding = Math.max(6, logoSize * 0.15);
        ctx.fillStyle = bgColorInput.value;
        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(logoX - padding/2, logoY - padding/2, logoSize + padding, logoSize + padding, 8);
        } else {
            ctx.rect(logoX - padding/2, logoY - padding/2, logoSize + padding, logoSize + padding);
        }
        ctx.fill();

        // Draw Image Logo with high quality interpolation
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(logoImageObj, logoX, logoY, logoSize, logoSize);
    }
}

logoInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            const img = new Image();
            img.onload = () => {
                logoImageObj = img;
                document.getElementById('logo-file-label').textContent = file.name;
                btnRemoveLogo.classList.remove('hidden');
                logoSizeContainer.classList.remove('hidden');
                // Automatically set ECL to High for better logo scanning resilience
                optEcl.value = 'H';
                generateQRCode();
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }
});

btnRemoveLogo.addEventListener('click', () => {
    logoImageObj = null;
    logoInput.value = '';
    document.getElementById('logo-file-label').textContent = 'Upload Image Logo';
    btnRemoveLogo.classList.add('hidden');
    logoSizeContainer.classList.add('hidden');
    generateQRCode();
});

const allInputs = document.querySelectorAll('input, textarea, select');
allInputs.forEach(input => {
    if (input.id !== 'logo-input') {
        input.addEventListener('input', () => {
            // Sync color hex codes
            if (input === fgColorInput) fgHexInput.value = fgColorInput.value;
            if (input === bgColorInput) bgHexInput.value = bgColorInput.value;
            if (input === fgHexInput && /^#[0-9A-F]{6}$/i.test(fgHexInput.value)) fgColorInput.value = fgHexInput.value;
            if (input === bgHexInput && /^#[0-9A-F]{6}$/i.test(bgHexInput.value)) bgColorInput.value = bgHexInput.value;

            // Update UI Slider labels
            document.getElementById('size-val').textContent = optSize.value;
            document.getElementById('margin-val').textContent = optMargin.value;
            document.getElementById('logo-size-val').textContent = optLogoSize.value + '%';

            generateQRCode();
        });
    }
});

// Hide/Show password on Wifi security change
document.getElementById('wifi-type').addEventListener('change', (e) => {
    const passContainer = document.getElementById('wifi-pass-container');
    if (e.target.value === 'nopass') {
        passContainer.classList.add('hidden');
    } else {
        passContainer.classList.remove('hidden');
    }
});

// Preset buttons click
document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        fgColorInput.value = btn.dataset.fg;
        fgHexInput.value = btn.dataset.fg;
        bgColorInput.value = btn.dataset.bg;
        bgHexInput.value = btn.dataset.bg;
        generateQRCode();
    });
});

// Current Geolocation helper
document.getElementById('btnGetCurrentLocation').addEventListener('click', () => {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(position => {
            document.getElementById('loc-lat').value = position.coords.latitude.toFixed(6);
            document.getElementById('loc-lng').value = position.coords.longitude.toFixed(6);
            generateQRCode();
            showToast('Location fetched successfully!');
        }, () => {
            showToast('Could not access current location.', 'error');
        });
    } else {
        showToast('Geolocation is not supported by your browser.', 'error');
    }
});

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toast-message');
    const toastIcon = document.getElementById('toast-icon');

    toastMsg.textContent = message;
    if (type === 'error') {
        toastIcon.className = "fa-solid fa-circle-xmark text-rose-500";
    } else {
        toastIcon.className = "fa-solid fa-circle-check text-emerald-400 dark:text-emerald-600";
    }

    toast.classList.remove('translate-y-20', 'opacity-0');
    toast.classList.add('translate-y-0', 'opacity-100');

    setTimeout(() => {
        toast.classList.remove('translate-y-0', 'opacity-100');
        toast.classList.add('translate-y-20', 'opacity-0');
    }, 3000);
}

function getCombinedCanvas() {
    // Re-run composite drawing to ensure canvas state is fresh
    applyCanvasEffects();
    return exportCanvas;
}

document.getElementById('btnDownloadPNG').addEventListener('click', () => {
    const canvas = getCombinedCanvas();
    const link = document.createElement('a');
            link.download = `qrcode-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    showToast('Downloaded PNG file');
});

document.getElementById('btnDownloadJPG').addEventListener('click', () => {
    const canvas = getCombinedCanvas();
    const link = document.createElement('a');
            link.download = `qrcode-${Date.now()}.jpg`;
    link.href = canvas.toDataURL('image/jpeg', 0.95);
    link.click();
    showToast('Downloaded JPG file');
});

document.getElementById('btnDownloadSVG').addEventListener('click', () => {
    const qrMatrix = qrCodeInstance?._oQRCode;
    if (!qrMatrix) {
        showToast('QR code is not ready yet.', 'error');
        return;
    }

    const fg = fgColorInput.value;
    const bg = bgColorInput.value;
    const quietZone = parseInt(optMargin.value, 10);
    const moduleCount = qrMatrix.getModuleCount();
    const viewSize = moduleCount + quietZone * 2;
    const pathData = [];
    for (let row = 0; row < moduleCount; row++) {
        for (let column = 0; column < moduleCount; column++) {
            if (qrMatrix.isDark(row, column)) {
                pathData.push(`M${column + quietZone} ${row + quietZone}h1v1h-1z`);
            }
        }
    }

    const svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="${optSize.value}" height="${optSize.value}" viewBox="0 0 ${viewSize} ${viewSize}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="${bg}"/><path fill="${fg}" d="${pathData.join('')}"/></svg>`;

    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const link = document.createElement('a');
            link.download = `qrcode-${Date.now()}.svg`;
    link.href = URL.createObjectURL(blob);
    link.click();
    showToast('Downloaded SVG file');
});

// Copy QR Code Image to Clipboard
document.getElementById('btnCopyImage').addEventListener('click', () => {
    const canvas = getCombinedCanvas();
    canvas.toBlob(blob => {
        try {
            const item = new ClipboardItem({ 'image/png': blob });
            navigator.clipboard.write([item]).then(() => {
                showToast('QR Code Image copied to clipboard!');
            });
        } catch (err) {
            showToast('Direct image copy not supported in this browser', 'error');
        }
    });
});

// Copy Payload Text
document.getElementById('btnCopyPayload').addEventListener('click', () => {
    const payload = getPayload();
    // Fallback execCommand for iFrame iframe restrictions
    const textarea = document.createElement('textarea');
    textarea.value = payload;
    document.body.appendChild(textarea);
    textarea.select();
    try {
        document.execCommand('copy');
        showToast('Raw QR payload copied to clipboard!');
    } catch (err) {
        showToast('Failed to copy payload', 'error');
    }
    document.body.removeChild(textarea);
});

const historyList = document.getElementById('history-list');
const historyEmpty = document.getElementById('history-empty');

function renderHistory() {
    historyList.innerHTML = '';
    if (historyData.length === 0) {
        historyList.appendChild(historyEmpty);
        return;
    }

    historyData.forEach((item, index) => {
        const el = document.createElement('div');
        el.className = 'flex items-center justify-between p-2.5 rounded-xl bg-slate-100/70 dark:bg-slate-800/70 border border-slate-200/50 dark:border-slate-700/50 text-xs transition-all hover:bg-slate-200/50 dark:hover:bg-slate-700/50';

        const iconByType = {
            url: 'fa-link',
            vcard: 'fa-address-card',
            email: 'fa-envelope',
            sms: 'fa-comment-sms',
            location: 'fa-location-dot'
        };
        const content = document.createElement('div');
        content.className = 'flex items-center space-x-2.5 min-w-0 flex-1';
        const iconWrap = document.createElement('div');
        iconWrap.className = 'w-7 h-7 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0';
        const icon = document.createElement('i');
        icon.className = `fa-solid ${iconByType[item.type] || iconByType.url}`;
        iconWrap.appendChild(icon);

        const textWrap = document.createElement('div');
        textWrap.className = 'truncate pr-2';
        const title = document.createElement('p');
        title.className = 'font-medium text-slate-700 dark:text-slate-200 truncate';
        title.textContent = typeof item.title === 'string' ? item.title : item.payload;
        const date = document.createElement('p');
        date.className = 'text-[10px] text-slate-400 font-mono';
        date.textContent = Number.isFinite(item.timestamp) ? new Date(item.timestamp).toLocaleDateString() : '';
        textWrap.append(title, date);
        content.append(iconWrap, textWrap);

        const actions = document.createElement('div');
        actions.className = 'flex items-center space-x-1 shrink-0';
        const reloadButton = document.createElement('button');
        reloadButton.className = 'p-1.5 hover:bg-blue-500/10 hover:text-blue-600 rounded-lg transition-colors';
        reloadButton.title = 'Reload Item';
        reloadButton.setAttribute('aria-label', 'Reload saved QR code');
        reloadButton.innerHTML = '<i class="fa-solid fa-rotate-left"></i>';
        reloadButton.addEventListener('click', () => reloadHistoryItem(index));
        const deleteButton = document.createElement('button');
        deleteButton.className = 'p-1.5 hover:bg-rose-500/10 hover:text-rose-500 rounded-lg transition-colors';
        deleteButton.title = 'Delete';
        deleteButton.setAttribute('aria-label', 'Delete saved QR code');
        deleteButton.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
        deleteButton.addEventListener('click', () => deleteHistoryItem(index));
        actions.append(reloadButton, deleteButton);
        el.append(content, actions);
        historyList.appendChild(el);
    });
}

function updateHistorySaveButton() {
    const saveButton = document.getElementById('btnSaveHistory');
    const isWifi = activeTab === 'wifi';
    saveButton.disabled = isWifi;
    saveButton.title = isWifi ? 'Wi-Fi codes are not saved because they contain your password.' : 'Save QR code to history';
    saveButton.classList.toggle('opacity-50', isWifi);
    saveButton.classList.toggle('cursor-not-allowed', isWifi);
}

document.getElementById('btnSaveHistory').addEventListener('click', () => {
    if (activeTab === 'wifi') {
        showToast('Wi-Fi codes are not saved to protect your password.', 'error');
        return;
    }

    const payload = getPayload();
    const newItem = {
        type: activeTab,
        title: payload.length > 30 ? payload.substring(0, 30) + '...' : payload,
        payload: payload,
        fg: fgColorInput.value,
        bg: bgColorInput.value,
        timestamp: Date.now()
    };

    historyData.unshift(newItem);
    if (historyData.length > 15) historyData.pop(); // Keep maximum 15 items

    localStorage.setItem('qr_history_pro', JSON.stringify(historyData));
    renderHistory();
    showToast('Saved to history!');
});

window.reloadHistoryItem = function(index) {
    const item = historyData[index];
    if (!item) return;

    // Switch Tab
            const tabBtn = document.querySelector(`.tab-btn[data-tab="${item.type}"]`);
    if (tabBtn) tabBtn.click();

    // Direct input reload for main field
    if (item.type === 'url') document.getElementById('input-url').value = item.payload;
    fgColorInput.value = item.fg;
    fgHexInput.value = item.fg;
    bgColorInput.value = item.bg;
    bgHexInput.value = item.bg;

    generateQRCode();
    showToast('Loaded item from history');
};

window.deleteHistoryItem = function(index) {
    historyData.splice(index, 1);
    localStorage.setItem('qr_history_pro', JSON.stringify(historyData));
    renderHistory();
    showToast('Item removed');
};

document.getElementById('btnClearHistory').addEventListener('click', () => {
    historyData = [];
    localStorage.removeItem('qr_history_pro');
    renderHistory();
    showToast('History cleared');
});

window.onload = function() {
    renderHistory();
    updateHistorySaveButton();
    generateQRCode();
};
