const { app, Tray, Menu, Notification, shell, nativeImage, BrowserWindow, ipcMain, session } = require('electron');
const schedule = require('node-schedule');
const path = require('path');
const { exec } = require('child_process');
const fs = require('fs');

let tray = null;
let mainWindow = null;
let portalWindow = null;
let currentAlarmJob = null;
let midnightResetJob = null;
let backgroundCheckWindow = null;
let autoCheckTimer = null;

// Konfigurasi & Penyimpanan Data
const configPath = path.join(app.getPath('userData'), 'config.json');

function getTodayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const DEFAULT_TEMPLATES = {
  activity: 'Melaksanakan tugas harian magang dengan fokus dan disiplin, menyelesaikan seluruh penugasan yang diberikan oleh mentor lapangan, berkoordinasi secara aktif dengan tim kerja, serta mendokumentasikan progres hasil kegiatan secara sistematis.',
  learning: 'Mendapatkan pemahaman baru terkait alur kerja operasional industri, meningkatkan keterampilan komunikasi profesional dalam lingkungan kerja, serta melatih manajemen waktu dan penyelesaian masalah teknis secara efektif.',
  issue: 'Seluruh kegiatan magang hari ini berjalan dengan lancar, teratur, dan produktif tanpa mengalami kendala teknis yang signifikan. Koordinasi dan bimbingan bersama mentor berjalan optimal.'
};

let appConfig = {
  alarmTime: '17:00',
  autoStart: true,
  autoFillOnAlarm: true,
  autoCheckInterval: 5, // dalam menit
  geminiApiKey: '',
  todayWorkInput: '',
  templates: { ...DEFAULT_TEMPLATES },
  attendance: {
    date: getTodayString(),
    status: 'not_filled', // 'filled' | 'not_filled' | 'need_login' | 'unknown'
    lastChecked: null,
    source: 'initial',
    message: 'Belum diperiksa hari ini'
  }
};

// Reset status untuk hari baru
function resetForNewDay(reason = 'Pergantian hari') {
  const today = getTodayString();
  appConfig.attendance = {
    date: today,
    status: 'not_filled',
    lastChecked: null,
    source: 'day_change',
    message: `${reason}: status absen di-reset ke Belum Diisi untuk tanggal hari ini.`
  };
  appConfig.todayWorkInput = ''; // Bersihkan input kerjaan untuk hari baru
  saveConfig();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('status-updated', appConfig.attendance);
    mainWindow.webContents.send('work-input-reset');
  }
}

// Pastikan tanggal sesuai hari ini
function ensureCurrentDate() {
  const today = getTodayString();
  if (appConfig.attendance.date !== today) {
    resetForNewDay('Pergantian hari kalender');
  }
}

// Muat konfigurasi tersimpan
try {
  if (fs.existsSync(configPath)) {
    const saved = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (saved.alarmTime) appConfig.alarmTime = saved.alarmTime;
    if (typeof saved.autoStart === 'boolean') appConfig.autoStart = saved.autoStart;
    if (typeof saved.autoFillOnAlarm === 'boolean') appConfig.autoFillOnAlarm = saved.autoFillOnAlarm;
    if (saved.autoCheckInterval) appConfig.autoCheckInterval = saved.autoCheckInterval;
    if (typeof saved.geminiApiKey === 'string') appConfig.geminiApiKey = saved.geminiApiKey;
    if (typeof saved.todayWorkInput === 'string') appConfig.todayWorkInput = saved.todayWorkInput;
    if (saved.templates) {
      appConfig.templates = {
        activity: saved.templates.activity || DEFAULT_TEMPLATES.activity,
        learning: saved.templates.learning || DEFAULT_TEMPLATES.learning,
        issue: saved.templates.issue || DEFAULT_TEMPLATES.issue
      };
    }
    if (saved.attendance) {
      if (saved.attendance.date === getTodayString()) {
        appConfig.attendance = saved.attendance;
      } else {
        // Tanggal berbeda dari hari ini -> Pergantian hari
        resetForNewDay('Aplikasi dibuka di hari baru');
      }
    }
  }
} catch (e) {
  console.error('Error membaca config:', e);
}

function saveConfig() {
  try {
    fs.writeFileSync(configPath, JSON.stringify(appConfig, null, 2));
  } catch (e) {
    console.error('Error menyimpan config:', e);
  }
}

// Icon Base64
const iconBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAACmSURBVDhPrZDRDcQgCEV/9qAexEHuYx30wR5kI+aSwNQaP3xITF5QePqAcK2162L8w8w8T9u2gWEYoJSKMca3r4zR55xR1zUopV7o7iU/O/gR0ff9Dk0T1/U1g1kE/5VJKdE0DUspDmbjON4L7vsOYwymaQIiMqyI6M553sFmsM6R1O2e0xP788P/iP+L7N90L5jQ1R2e93O6XU5Lw2vGf8c47zY8fFq189qGAAAAAElFTkSuQmCC";
const icon = nativeImage.createFromDataURL(iconBase64);

// Atur Windows Auto-Start
function setAutoStart(enable) {
  try {
    app.setLoginItemSettings({
      openAtLogin: enable,
      path: process.execPath,
      args: [app.getAppPath()]
    });

    const startupDir = path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
    const startupShortcut = path.join(startupDir, 'Pengingat MagangHub.lnk');

    if (enable) {
      const vbsScript = `
Set WshShell = CreateObject("WScript.Shell")
Set oShortcut = WshShell.CreateShortcut("${startupShortcut.replace(/\\/g, '\\\\')}")
oShortcut.TargetPath = "${process.execPath.replace(/\\/g, '\\\\')}"
oShortcut.Arguments = "${app.getAppPath().replace(/\\/g, '\\\\')}"
oShortcut.WorkingDirectory = "${app.getAppPath().replace(/\\/g, '\\\\')}"
oShortcut.Save
`;
      const tempVbs = path.join(app.getPath('temp'), 'create_startup_shortcut.vbs');
      fs.writeFileSync(tempVbs, vbsScript);
      exec(`cscript //nologo "${tempVbs}"`, () => {
        try { fs.unlinkSync(tempVbs); } catch(e) {}
      });
    } else {
      if (fs.existsSync(startupShortcut)) {
        fs.unlinkSync(startupShortcut);
      }
    }
  } catch (err) {
    console.error('Error setting auto start:', err);
  }
}

// Jadwal Alarm Pengingat
function setSchedule(timeStr) {
  if (currentAlarmJob) {
    currentAlarmJob.cancel();
  }
  const [hour, minute] = timeStr.split(':');
  
  currentAlarmJob = schedule.scheduleJob(`${minute} ${hour} * * 1-5`, async () => {
    ensureCurrentDate();
    // Jika belum diisi hari ini, coba cek web sekali lagi
    if (appConfig.attendance.status !== 'filled') {
      await checkWebStatusSilently(true);
    }
    onAlarmTriggered();
  });
}

// Jadwal Pergantian Hari (Reset setiap jam 00:00 tengah malam)
function setupMidnightJob() {
  if (midnightResetJob) {
    midnightResetJob.cancel();
  }
  // Berjalan tepat pada jam 00:00:01 setiap hari
  midnightResetJob = schedule.scheduleJob('1 0 * * *', () => {
    resetForNewDay('Pergantian hari (00:00 WIB)');
  });
}

async function onAlarmTriggered() {
  ensureCurrentDate();
  const isFilled = appConfig.attendance.status === 'filled';
  if (isFilled) {
    showNotification('Status Absen Aman', 'Kamu sudah mengisi absensi MagangHub hari ini. Kerja bagus!');
  } else {
    if (appConfig.autoFillOnAlarm) {
      showNotification('Mengisi Absen Otomatis...', 'Waktu alarm tiba dan absen belum diisi. Menjalankan pengisian otomatis...');
      executeAutoFill(false);
    } else {
      playRingingSound();
      showNotification('Peringatan: Belum Mengisi Absen!', 'Kamu belum mengisi absen MagangHub hari ini. Klik untuk segera mengisi!');
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  }
}

function playRingingSound() {
  exec(`powershell -WindowStyle Hidden -c "(New-Object Media.SoundPlayer 'C:\\Windows\\Media\\Alarm01.wav').PlaySync()"`, { windowsHide: true });
}

function showNotification(title, body) {
  const notif = new Notification({
    title: title,
    body: body,
    icon: icon
  });

  notif.on('click', () => {
    openPortalWindow();
  });

  notif.show();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 480,
    height: 740,
    minWidth: 440,
    minHeight: 620,
    show: true,
    frame: true,
    resizable: true,
    icon: icon,
    backgroundColor: '#0d1117',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile('index.html');

  mainWindow.on('close', (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      mainWindow.hide();
    }
    return false;
  });

  mainWindow.setMenuBarVisibility(false);
}

// Skrip pemeriksa DOM di web MagangHub
const inspectScript = `
(() => {
  try {
    const currentUrl = window.location.href;
    if (currentUrl.includes('account.kemnaker.go.id') || currentUrl.includes('/auth/login')) {
      return { status: 'need_login', message: 'Perlu login di akun SIAPkerja' };
    }

    const bodyText = (document.body ? document.body.innerText : '').toLowerCase();
    
    const filledKeywords = [
      'sudah diisi',
      'sudah mengisi',
      'laporan terkirim',
      'menunggu validasi',
      'menunggu verifikasi',
      'disetujui',
      'diverifikasi',
      'tervalidasi',
      'laporan berhasil dikirim'
    ];

    const unfilledKeywords = [
      'tambah laporan harian',
      'tambah laporan',
      'belum mengisi',
      'belum diisi',
      'isi laporan'
    ];

    const todayDate = new Date().getDate().toString();

    let calendarIndicatesFilled = false;
    const cards = document.querySelectorAll('.v-card, .v-chip, .v-calendar-weekly__day, td, [class*="calendar"], [class*="report"]');
    cards.forEach(el => {
      const txt = (el.innerText || '').toLowerCase();
      if (txt.includes(todayDate)) {
        const cls = (el.className || '').toLowerCase();
        const html = el.innerHTML.toLowerCase();
        if (cls.includes('success') || cls.includes('green') || html.includes('success') || html.includes('disetujui') || html.includes('terkirim')) {
          calendarIndicatesFilled = true;
        }
      }
    });

    if (calendarIndicatesFilled) {
      return { status: 'filled', message: 'Terdeteksi dari kalender: Absensi hari ini sudah terisi' };
    }

    const hasFilled = filledKeywords.some(kw => bodyText.includes(kw));
    const hasUnfilled = unfilledKeywords.some(kw => bodyText.includes(kw));

    if (hasFilled && !hasUnfilled) {
      return { status: 'filled', message: 'Terdeteksi di portal: Laporan harian sudah diisi' };
    }

    if (hasUnfilled) {
      return { status: 'not_filled', message: 'Terdeteksi di portal: Belum mengisi laporan harian' };
    }

    if (hasFilled) {
      return { status: 'filled', message: 'Terdeteksi di portal: Laporan harian sudah terisi' };
    }

    if (currentUrl.includes('monev.maganghub.kemnaker.go.id')) {
      return { status: 'unknown', message: 'Dashboard MagangHub aktif' };
    }

    return { status: 'unknown', message: 'Memuat halaman...' };
  } catch(err) {
    return { status: 'error', message: err.toString() };
  }
})()
`;

// Membuka portal MagangHub
function openPortalWindow() {
  if (portalWindow && !portalWindow.isDestroyed()) {
    portalWindow.show();
    portalWindow.focus();
    return;
  }

  portalWindow = new BrowserWindow({
    width: 1150,
    height: 800,
    title: 'Portal Monev MagangHub Kemnaker',
    icon: icon,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  portalWindow.loadURL('https://monev.maganghub.kemnaker.go.id/dashboard');

  const runInspection = async () => {
    if (!portalWindow || portalWindow.isDestroyed()) return;
    try {
      setTimeout(async () => {
        if (!portalWindow || portalWindow.isDestroyed()) return;
        const result = await portalWindow.webContents.executeJavaScript(inspectScript);
        if (result && result.status) {
          updateAttendanceStatus(result.status, result.message, 'portal_window');
        }
      }, 2500);
    } catch (e) {}
  };

  portalWindow.webContents.on('did-finish-load', runInspection);
  portalWindow.webContents.on('did-navigate-in-page', runInspection);

  portalWindow.on('closed', () => {
    portalWindow = null;
  });
}

// Cek status web secara silent di background
async function checkWebStatusSilently(force = false) {
  ensureCurrentDate();

  // KETENTUAN UTAMA: Jika status hari ini sudah "SUDAH DIISI" dan bukan permintaan paksa (force),
  // jangan cek ulang web karena sudah tuntas untuk hari ini sampai pergantian hari!
  if (!force && appConfig.attendance.date === getTodayString() && appConfig.attendance.status === 'filled') {
    return {
      status: 'filled',
      message: 'Sudah diisi hari ini (aktif sampai pergantian hari pukul 00:00 WIB)'
    };
  }

  if (backgroundCheckWindow && !backgroundCheckWindow.isDestroyed()) {
    backgroundCheckWindow.destroy();
  }

  return new Promise((resolve) => {
    backgroundCheckWindow = new BrowserWindow({
      width: 800,
      height: 600,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    let resolved = false;
    const cleanup = () => {
      if (backgroundCheckWindow && !backgroundCheckWindow.isDestroyed()) {
        backgroundCheckWindow.destroy();
        backgroundCheckWindow = null;
      }
    };

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        cleanup();
        resolve({ status: appConfig.attendance.status, message: 'Waktu pemeriksaan habis' });
      }
    }, 15000);

    backgroundCheckWindow.loadURL('https://monev.maganghub.kemnaker.go.id/dashboard');

    backgroundCheckWindow.webContents.on('did-finish-load', async () => {
      setTimeout(async () => {
        if (resolved) return;
        try {
          if (!backgroundCheckWindow || backgroundCheckWindow.isDestroyed()) return;
          const result = await backgroundCheckWindow.webContents.executeJavaScript(inspectScript);
          resolved = true;
          clearTimeout(timeout);
          cleanup();
          
          if (result && result.status) {
            updateAttendanceStatus(result.status, result.message, 'auto_sync');
            resolve(result);
          } else {
            resolve({ status: 'unknown', message: 'Status tidak dapat dipastikan' });
          }
        } catch (err) {
          resolved = true;
          clearTimeout(timeout);
          cleanup();
          resolve({ status: 'error', message: err.message });
        }
      }, 3500);
    });
  });
}

// Eksekusi Pengisian Absen Otomatis (Auto-Fill & Submit)
async function executeAutoFill(showWindow = false) {
  openPortalWindow();
  const win = portalWindow;

  return new Promise((resolve) => {
    const doFill = async () => {
      try {
        const url = win.webContents.getURL();
        if (url.includes('account.kemnaker.go.id') || url.includes('/auth/login')) {
          showNotification('Perlu Login', 'Silakan login ke akun SIAPkerja Anda pada jendela yang terbuka.');
          win.show();
          win.focus();
          resolve({ success: false, reason: 'need_login' });
          return;
        }

        const templatesJson = JSON.stringify(appConfig.templates);

        const fillResult = await win.webContents.executeJavaScript(`
          (async () => {
            try {
              const allBtns = Array.from(document.querySelectorAll('button, a, .v-btn'));
              const addBtn = allBtns.find(b => {
                const t = (b.innerText || '').toLowerCase();
                return t.includes('tambah laporan') || t.includes('isi laporan') || t.includes('tambah aktivitas');
              });

              if (addBtn) {
                addBtn.click();
                await new Promise(r => setTimeout(r, 2000));
              }

              const textareas = Array.from(document.querySelectorAll('textarea, input[type="text"]'));
              if (textareas.length === 0) {
                return { success: false, reason: 'no_fields', message: 'Formulir laporan belum terbuka. Silakan buka menu Laporan Harian.' };
              }

              const tpl = ${templatesJson};

              const setField = (el, val) => {
                el.focus();
                el.value = val;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
              };

              textareas.forEach((ta, idx) => {
                const parent = ta.closest('.v-input, .form-group, div') || ta.parentElement;
                const txt = (parent ? parent.innerText : '').toLowerCase();

                if (txt.includes('uraian') || txt.includes('aktivitas') || idx === 0) {
                  setField(ta, tpl.activity);
                } else if (txt.includes('pelajaran') || txt.includes('pembelajaran') || txt.includes('skill') || idx === 1) {
                  setField(ta, tpl.learning);
                } else if (txt.includes('kendala') || idx === 2) {
                  setField(ta, tpl.issue);
                }
              });

              await new Promise(r => setTimeout(r, 1000));

              const submitBtns = Array.from(document.querySelectorAll('button, .v-btn'));
              const submitBtn = submitBtns.find(b => {
                const t = (b.innerText || '').toLowerCase();
                return (t.includes('kirim') || t.includes('simpan')) && !b.disabled;
              });

              if (submitBtn) {
                submitBtn.click();
                return { success: true, message: 'Laporan harian berhasil diisi dan dikirim otomatis!' };
              } else {
                return { success: true, partial: true, message: 'Laporan berhasil diisikan ke form! Silakan klik Kirim.' };
              }
            } catch(e) {
              return { success: false, error: e.toString() };
            }
          })()
        `);

        if (fillResult && fillResult.success) {
          updateAttendanceStatus('filled', fillResult.message, 'auto_fill');
          showNotification('Berhasil Terisi!', fillResult.message);
          resolve(fillResult);
        } else {
          showNotification('Pengisian Otomatis', fillResult.message || 'Formulir dibuka, silakan periksa.');
          win.show();
          resolve(fillResult);
        }
      } catch (err) {
        showNotification('Gagal Auto-Fill', err.message);
        resolve({ success: false, error: err.message });
      }
    };

    setTimeout(doFill, 4000);
  });
}

function updateAttendanceStatus(status, message = '', source = 'auto') {
  ensureCurrentDate();

  // KETENTUAN UTAMA:
  // Jika status hari ini SUDAH "filled" (Sudah Diisi), KUNCI status ini sampai pergantian hari!
  // Jangan biarkan auto-sync yang meragukan menimpa kembali ke 'not_filled' atau 'unknown' pada hari yang sama,
  // kecuali jika user secara manual menekan tombol belum diisi (source === 'manual') atau pergantian hari (source === 'day_change').
  if (appConfig.attendance.date === getTodayString() && appConfig.attendance.status === 'filled') {
    if (status !== 'filled' && source !== 'manual' && source !== 'day_change') {
      return; // Status 'Sudah Diisi' tetap terkunci untuk hari ini
    }
  }

  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

  appConfig.attendance = {
    date: getTodayString(),
    status: status,
    lastChecked: timeStr,
    source: source,
    message: message || ''
  };

  saveConfig();

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('status-updated', appConfig.attendance);
  }
}

// Mulai Polling Otomatis di Background
function startAutoPolling() {
  if (autoCheckTimer) {
    clearInterval(autoCheckTimer);
  }
  const intervalMs = (appConfig.autoCheckInterval || 5) * 60 * 1000;
  autoCheckTimer = setInterval(() => {
    ensureCurrentDate();
    // Hanya lakukan polling web jika status belum 'filled'
    if (appConfig.attendance.status !== 'filled') {
      checkWebStatusSilently();
    }
  }, intervalMs);
}

app.whenReady().then(() => {
  createWindow();
  
  tray = new Tray(icon);
  
  const contextMenu = Menu.buildFromTemplate([
    { 
      label: 'Tampilkan Pengingat', 
      type: 'normal', 
      click: () => mainWindow.show() 
    },
    { 
      label: '⚡ Isi Absen Otomatis', 
      type: 'normal', 
      click: () => executeAutoFill(true) 
    },
    { 
      label: 'Buka Portal MagangHub', 
      type: 'normal', 
      click: () => openPortalWindow() 
    },
    { 
      label: '🔄 Cek Status Web Sekarang', 
      type: 'normal', 
      click: () => checkWebStatusSilently(true) 
    },
    { type: 'separator' },
    { 
      label: 'Keluar', 
      type: 'normal', 
      click: () => {
        app.isQuiting = true;
        app.quit();
      }
    }
  ]);
  
  tray.setToolTip('Pengingat Absen MagangHub');
  tray.setContextMenu(contextMenu);
  
  tray.on('click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
    }
  });

  if (appConfig.autoStart) {
    setAutoStart(true);
  }

  // Set jadwal alarm dan jadwal reset tengah malam
  setSchedule(appConfig.alarmTime);
  setupMidnightJob();

  // Mulai polling berkala
  startAutoPolling();

  // Pengecekan otomatis awal jika belum diisi
  setTimeout(() => {
    ensureCurrentDate();
    if (appConfig.attendance.status !== 'filled') {
      checkWebStatusSilently();
    }
  }, 3000);
});

// Interceptor request API
app.whenReady().then(() => {
  session.defaultSession.webRequest.onCompleted({ urls: ['*://monev-api.maganghub.kemnaker.go.id/*'] }, (details) => {
    const url = details.url.toLowerCase();
    if (details.statusCode >= 200 && details.statusCode < 300) {
      if (url.includes('report') || url.includes('logbook') || url.includes('attendance') || url.includes('activity')) {
        if (details.method === 'POST' || details.method === 'PUT') {
          updateAttendanceStatus('filled', 'Laporan absensi berhasil terkirim ke server MagangHub!', 'api_interceptor');
          showNotification('Absen Berhasil!', 'Laporan absensi MagangHub Anda berhasil disimpan.');
        }
      }
    }
  });
});

// ==================== SISTEM AI GENERATOR LOGBOOK ====================

// Memastikan panjang teks memenuhi syarat minimal karakter MagangHub (min 100 karakter)
function padToMinChars(text, type) {
  if (!text) text = '';
  text = text.trim();
  if (text.length >= 100) return text;

  const suffixes = {
    activity: ' Seluruh rangkaian kegiatan harian ini diselesaikan secara tertib, terdokumentasi, dan sesuai dengan arahan pembimbing lapangan.',
    learning: ' Pengalaman praktis ini sangat bernilai dalam meningkatkan keterampilan teknis serta wawasan profesional kerja industri secara berkelanjutan.',
    issue: ' Koordinasi yang responsif bersama mentor dan rekan kerja membantu memitigasi potensi hambatan teknis lainnya secara optimal.'
  };

  while (text.length < 100) {
    text += suffixes[type] || ' Kegiatan berjalan teratur sesuai rencana kerja harian magang.';
  }
  return text;
}

// AI Generator Cerdas Bawaan (Local Synthesizer - Bekerja Offline & Cepat tanpa API Key)
function generateLocalSynthesizer(rawInput) {
  const cleanInput = rawInput.trim();

  // Pisahkan baris / kalimat / poin pekerjaan
  const rawLines = cleanInput
    .split(/\n|\r|,|;|\band\b|\bdan\b|\blalu\b|\bkemudian\b|\bserta\b/gi)
    .map(s => s.replace(/^[-*•\d.)\s]+/, '').trim())
    .filter(s => s.length > 2);

  const taskList = rawLines.length > 0 ? rawLines : [cleanInput];

  // Deteksi kata kunci kendala / masalah
  const issueKeywords = [
    'error', 'bug', 'kendala', 'masalah', 'gagal', 'crash', 'lambat', 'lemot', 
    'kesulitan', 'cors', 'timeout', 'stuck', 'mentok', 'bingung', 'typo', 'delay', 
    'trouble', 'tidak bisa', 'gak bisa', 'terkendala', 'hambatan', 'pending', 'rusak'
  ];

  const foundIssues = [];
  const normalTasks = [];

  taskList.forEach(item => {
    const lower = item.toLowerCase();
    const hasIssue = issueKeywords.some(kw => lower.includes(kw));
    if (hasIssue) {
      foundIssues.push(item);
    } else {
      normalTasks.push(item);
    }
  });

  const effectiveTasks = normalTasks.length > 0 ? normalTasks : taskList;

  // 1. GENERATE URAIAN AKTIVITAS (Formal & Runtut)
  const formattedTasks = effectiveTasks.map(t => {
    let text = t.charAt(0).toLowerCase() + t.slice(1);
    if (!text.match(/^(melakukan|menyelesaikan|membuat|mengerjakan|mengembangkan|mengimplementasikan|merancang|memperbaiki|menganalisis|menguji|mengikuti|berkoordinasi|menyiapkan|mendokumentasikan)/i)) {
      text = 'melaksanakan pengerjaan ' + text;
    }
    return text;
  });

  let activityText = '';
  if (formattedTasks.length === 1) {
    activityText = `Pada kegiatan magang hari ini, fokus penugasan utama diarahkan untuk ${formattedTasks[0]}. Seluruh tahapan pengerjaan diselesaikan secara terstruktur, teratur, dan sesuai instruksi pembimbing lapangan, serta memastikan hasil pekerjaan telah diuji dan memenuhi standar kualitas yang ditetapkan.`;
  } else if (formattedTasks.length === 2) {
    activityText = `Pada hari ini telah diselesaikan beberapa agenda kegiatan magang, diawali dengan ${formattedTasks[0]}, kemudian dilanjutkan dengan ${formattedTasks[1]}. Masing-masing tugas dikerjakan secara cermat dan sistematis dengan senantiasa berkoordinasi aktif bersama tim kerja demi memastikan ketercapaian target harian secara optimal.`;
  } else {
    const allExceptLast = formattedTasks.slice(0, -1).join(', ');
    const last = formattedTasks[formattedTasks.length - 1];
    activityText = `Rangkaian kegiatan magang hari ini berfokus pada penyelesaian sejumlah penugasan teknis dan operasional, meliputi: ${allExceptLast}, serta ${last}. Seluruh aktivitas tersebut dijalankan secara terstruktur, disiplin, dan didokumentasikan progresnya dengan baik guna mendukung kelancaran operasional tim.`;
  }

  // 2. GENERATE PELAJARAN YANG DIPEROLEH (Kompetensi & Insight)
  const lowerInput = cleanInput.toLowerCase();
  let domainContext = 'alur kerja operasional industri dan standar profesionalitas kerja';
  if (lowerInput.includes('api') || lowerInput.includes('code') || lowerInput.includes('bug') || lowerInput.includes('frontend') || lowerInput.includes('backend') || lowerInput.includes('react') || lowerInput.includes('sql') || lowerInput.includes('web') || lowerInput.includes('database')) {
    domainContext = 'pengembangan sistem perangkat lunak, arsitektur kode terstruktur, dan teknik identifikasi serta perbaikan bug (debugging)';
  } else if (lowerInput.includes('desain') || lowerInput.includes('figma') || lowerInput.includes('ui') || lowerInput.includes('ux') || lowerInput.includes('wireframe')) {
    domainContext = 'perancangan antarmuka visual (UI/UX), pemetaan alur interaksi pengguna, dan konsistensi sistem desain produk';
  } else if (lowerInput.includes('data') || lowerInput.includes('excel') || lowerInput.includes('laporan') || lowerInput.includes('rekap') || lowerInput.includes('input')) {
    domainContext = 'manajemen dan pengolahan data operasional, ketelitian validasi informasi dokumen, serta teknik pelaporan berkala';
  }

  const learningText = `Melalui penugasan hari ini, diperoleh wawasan praktis yang sangat berharga terkait ${domainContext}. Selain itu, kegiatan ini turut melatih kemampuan pemecahan masalah (problem solving) secara mandiri, ketelitian terhadap detail pekerjaan, serta pentingnya komunikasi aktif dalam ritme kerja tim profesional.`;

  // 3. GENERATE KENDALA YANG DIALAMI
  let issueText = '';
  if (foundIssues.length > 0) {
    const issueSummary = foundIssues.join(', ');
    issueText = `Dalam pelaksanaan penugasan hari ini, sempat ditemukan kendala teknis berupa ${issueSummary}. Hambatan tersebut segera dianalisis akar permasalahannya dan diatasi dengan baik melalui evaluasi alur kerja, penelusuran dokumentasi teknis, serta arahan bimbingan mentor lapangan, sehingga tugas dapat terselesaikan sesuai rencana.`;
  } else {
    issueText = `Seluruh rangkaian agenda kegiatan magang pada hari ini berlangsung dengan lancar, kondusif, dan produktif tanpa mengalami kendala teknis maupun komunikasi yang berarti. Arahan mentor lapangan yang jelas serta koordinasi tim yang responsif membuat semua target kerja harian tercapai tepat waktu.`;
  }

  return {
    success: true,
    source: 'local_synthesizer',
    data: {
      activity: padToMinChars(activityText, 'activity'),
      learning: padToMinChars(learningText, 'learning'),
      issue: padToMinChars(issueText, 'issue')
    }
  };
}

// Pemanggil Google Gemini API (Opsional jika user memasukkan Gemini API Key)
async function callGeminiApi(workInput, apiKey) {
  const prompt = `Anda adalah asisten AI profesional untuk penyusunan logbook harian pemagangan Kementerian Ketenagakerjaan (MagangHub / SIAPkerja Kemnaker).
Tugas Anda: Ubah catatan pekerjaan harian peserta magang berikut menjadi 3 bagian laporan resmi formal bahasa Indonesia:
1. activity (Uraian Aktivitas yang dilakukan)
2. learning (Pelajaran / Pembelajaran / Kompetensi baru yang diperoleh)
3. issue (Kendala yang dihadapi dan cara menyelesaikannya)

CATATAN KERJA HARI INI DARI PESERTA:
"""
${workInput}
"""

ATURAN WAJIB & KETAT:
1. Respon WAJIB berupa JSON valid dengan key: "activity", "learning", "issue".
2. Panjang karakter masing-masing nilai (activity, learning, issue) WAJIB MINIMAL 110 KARAKTER (tidak boleh kurang dari 100 karakter!).
3. Gunakan bahasa Indonesia baku, formal, sopan, bernada akademis/industri (EYD/PUEBI).
4. Pada 'activity': uraikan pekerjaan dengan spesifik, runtut, dan jelas berdasarkan catatan peserta.
5. Pada 'learning': jelaskan wawasan baru, pemahaman teknis/alur kerja, atau soft skills yang diasah dari pekerjaan tersebut.
6. Pada 'issue': jika peserta menyebutkan hambatan/error/kendala, jelaskan kendala tersebut secara profesional dan sebutkan solusinya. Jika tidak ada kendala yang disebutkan, nyatakan bahwa kegiatan berlangsung lancar dengan koordinasi mentor yang optimal.`;

  const models = ['gemini-2.0-flash', 'gemini-1.5-flash'];
  let lastError = null;

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            topP: 0.95,
            responseMimeType: 'application/json'
          }
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errText}`);
      }

      const data = await response.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) throw new Error('Respon Gemini API kosong');

      let cleaned = rawText.trim();
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.replace(/^```json/, '').replace(/```$/, '').trim();
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```/, '').replace(/```$/, '').trim();
      }

      const parsed = JSON.parse(cleaned);
      if (parsed.activity && parsed.learning && parsed.issue) {
        return {
          success: true,
          source: 'gemini',
          model: model,
          data: {
            activity: padToMinChars(parsed.activity, 'activity'),
            learning: padToMinChars(parsed.learning, 'learning'),
            issue: padToMinChars(parsed.issue, 'issue')
          }
        };
      }
    } catch (err) {
      lastError = err;
      console.warn(`Percobaan model ${model} gagal:`, err.message);
    }
  }

  throw lastError || new Error('Gagal menghubungi Gemini API');
}

// IPC Handlers
ipcMain.handle('get-config', () => {
  ensureCurrentDate();
  return appConfig;
});

ipcMain.on('save-config', (event, newConfig) => {
  if (newConfig.alarmTime) appConfig.alarmTime = newConfig.alarmTime;
  if (typeof newConfig.autoStart === 'boolean') {
    appConfig.autoStart = newConfig.autoStart;
    setAutoStart(newConfig.autoStart);
  }
  if (typeof newConfig.autoFillOnAlarm === 'boolean') {
    appConfig.autoFillOnAlarm = newConfig.autoFillOnAlarm;
  }
  if (typeof newConfig.geminiApiKey === 'string') {
    appConfig.geminiApiKey = newConfig.geminiApiKey.trim();
  }
  if (typeof newConfig.todayWorkInput === 'string') {
    appConfig.todayWorkInput = newConfig.todayWorkInput;
  }
  if (newConfig.templates) {
    appConfig.templates = { ...appConfig.templates, ...newConfig.templates };
  }
  saveConfig();
  setSchedule(appConfig.alarmTime);
  startAutoPolling();
});

ipcMain.handle('generate-ai-logbook', async (event, { workInput, apiKey }) => {
  if (!workInput || !workInput.trim()) {
    throw new Error('Silakan masukkan catatan kerjaan hari ini terlebih dahulu.');
  }

  const effectiveApiKey = (apiKey && apiKey.trim()) || (appConfig.geminiApiKey && appConfig.geminiApiKey.trim());

  if (effectiveApiKey) {
    try {
      const result = await callGeminiApi(workInput, effectiveApiKey);
      appConfig.todayWorkInput = workInput;
      saveConfig();
      return result;
    } catch (err) {
      console.warn('Gemini API error, beralih ke generator bawaan:', err.message);
      const fallbackResult = generateLocalSynthesizer(workInput);
      fallbackResult.fallbackNotice = `Gemini API tidak dapat dijangkau (${err.message}). Berhasil dialihkan ke AI Generator bawaan.`;
      appConfig.todayWorkInput = workInput;
      saveConfig();
      return fallbackResult;
    }
  } else {
    // Tanpa API Key: Langsung gunakan Local Synthesizer bawaan
    const result = generateLocalSynthesizer(workInput);
    appConfig.todayWorkInput = workInput;
    saveConfig();
    return result;
  }
});

ipcMain.handle('check-web-status', async () => {
  await checkWebStatusSilently(true); // force check jika user klik tombol Cek Web
  return appConfig.attendance;
});

ipcMain.handle('trigger-autofill', async () => {
  return await executeAutoFill(true);
});

ipcMain.on('open-portal', () => {
  openPortalWindow();
});

ipcMain.on('open-external-url', (event, url) => {
  shell.openExternal(url);
});

ipcMain.on('set-manual-status', (event, newStatus) => {
  const msg = newStatus === 'filled' ? 'Ditandai sudah diisi (aktif sampai pergantian hari)' : 'Ditandai belum diisi secara manual';
  updateAttendanceStatus(newStatus, msg, 'manual');
});

ipcMain.on('test-alarm', () => {
  playRingingSound();
  showNotification('Test Notifikasi & Suara!', 'Sistem pengingat dan alarm siap berjalan dengan baik.');
});

app.on('window-all-closed', (e) => {
  e.preventDefault();
});
