# 🕒 MagangHub Reminder & Auto-Fill AI (monev_AI)

<p align="center">
  <img src="https://img.shields.io/badge/Platform-Windows-0078D6?style=for-the-badge&logo=windows&logoColor=white" alt="Windows" />
  <img src="https://img.shields.io/badge/Framework-Electron-47848F?style=for-the-badge&logo=electron&logoColor=white" alt="Electron" />
  <img src="https://img.shields.io/badge/Runtime-Node.js%20%7C%20Bun-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Runtime" />
  <img src="https://img.shields.io/badge/AI-Google%20Gemini-8E75C2?style=for-the-badge&logo=googlegemini&logoColor=white" alt="Gemini AI" />
</p>

Aplikasi desktop widget dan tray pintar berbasis **Electron** untuk memantau, mengingatkan, dan mengotomatiskan pengisian logbook harian / absensi di portal **MagangHub**. Dilengkapi dengan **AI Assistant** (Google Gemini & Intelligent Generator Offline) untuk mengubah catatan aktivitas harian yang santai menjadi laporan profesional (Aktivitas, Pembelajaran, dan Kendala) minimal 100 karakter.

---

## ✨ Fitur Unggulan

- 🔔 **Pengingat Alarm & Notifikasi Windows**: Notifikasi harian otomatis pada jam yang telah ditentukan (default: 17:00).
- ⚡ **Auto-Fill Satu Klik**: Otomatis membuka portal dan mengisikan form logbook MagangHub tanpa perlu copas manual.
- 🤖 **AI Assistant (Auto Logbook)**:
  - Input ringkasan kerjaan santai atau poin-poin.
  - Auto-generate narasi baku untuk **Uraian Aktivitas**, **Pembelajaran**, dan **Kendala** (sesuai standar minimal 100 karakter MagangHub).
  - Mendukung **Google Gemini API Key** (cloud) atau **Intelligent Generator Bawaan** (100% offline & tanpa kuota).
- 🔄 **Auto-Sync Status Absensi**: Otomatis mendeteksi apakah kamu sudah mengisi absen hari ini atau belum melalui background sync.
- 📌 **System Tray Integration**: Aplikasi dapat diminimalkan ke tray pojok kanan bawah Windows agar hemat RAM dan tidak mengganggu layar.
- 🚀 **Auto-Start on Boot**: Dapat langsung berjalan otomatis saat laptop dinyalakan tanpa jendela terminal yang mengganggu (via VBScript).
- 📦 **Build Portable**: Dapat dibundel menjadi file `.exe` portabel tanpa perlu instalasi.

---

## 📋 Prasyarat Sistem

Sebelum menginstal, pastikan komputer/laptop kamu memiliki:

1. **Sistem Operasi**: Windows 10 atau Windows 11 (64-bit disarankan).
2. **Runtime Engine** (pilih salah satu):
   - [Node.js](https://nodejs.org/) (Versi LTS 18.x atau lebih baru disarankan) + `npm`
   - *atau* [Bun](https://bun.sh/) (v1.0+)
3. **Git**: [Download Git](https://git-scm.com/) (opsional jika mendownload ZIP).

---

## 🚀 Panduan Instalasi

### 1. Clone Repository

Buka terminal (Command Prompt, PowerShell, atau Git Bash), lalu jalankan:

```bash
git clone https://github.com/alifaris12/monev_AI.git
cd monev_AI
```

*(Atau ekstrak file zip ke folder pilihan jika mendownload secara manual)*

---

### 2. Install Dependensi

Pilih salah satu package manager yang terinstal di komputer kamu:

#### Menggunakan NPM:
```bash
npm install
```

#### Menggunakan Bun:
```bash
bun install
```

> **Catatan**: Proses instalasi akan mengunduh paket Electron (~80-100MB). Pastikan koneksi internet stabil hingga proses selesai.

---

## 💻 Cara Menjalankan Aplikasi

### Opsi A: Mode Standar (Development / Terminal)

Jalankan perintah berikut di folder proyek:

```bash
npm start
```
*atau jika menggunakan Bun:*
```bash
bun run start
```

### Opsi B: Mode Silent / Background (Direkomendasikan untuk Sehari-hari)

Telah disediakan script VBScript [`MulaiWidget.vbs`](file:///e:/WIdget/MulaiWidget.vbs) yang menjalankan aplikasi langsung di System Tray tanpa menampilkan jendela hitam terminal:

1. Klik ganda (double-click) file **`MulaiWidget.vbs`**.
2. Aplikasi akan langsung berjalan di latar belakang dan muncul ikon di **System Tray** (ikon panah atas di taskbar kanan bawah dekat jam).
3. Klik ikon tray untuk menampilkan atau menyembunyikan widget.

---

## 🔄 Menjalankan Otomatis Saat Komputer Dinyalakan (Auto-Start)

Agar aplikasi selalu aktif setiap kali laptop dinyalakan:

1. Tekan tombol `Windows + R` di keyboard untuk membuka dialog **Run**.
2. Ketik `shell:startup` lalu tekan **Enter**.
3. Buat **Shortcut** dari file `MulaiWidget.vbs`:
   - Klik kanan `MulaiWidget.vbs` > **Show more options** > **Create shortcut**.
   - Pindahkan file shortcut yang dibuat ke dalam folder *Startup* tersebut.

---

## ⚙️ Konfigurasi & Penggunaan

### 1. Mengatur Jam Alarm
- Buka widget, pada bagian **Fitur Otomatis**, atur jam pengingat (contoh: `17:00`).
- Klik **Simpan** untuk mengaktifkan jadwal alarm harian.

### 2. Menggunakan Fitur AI Assistant
1. Masukkan poin-poin singkat pekerjaan hari ini di kotak **Kerjaan Hari Ini**.
   *Contoh:* `Rapat pagi bareng mentor, lanjut perbaiki bug responsive di navbar, test integrasi API.`
2. Klik tombol **✨ Sesuaikan dengan AI**.
3. Sistem akan secara otomatis mengisi draf Uraian Aktivitas, Pembelajaran, dan Kendala.
4. *(Opsional)* Jika ingin hasil lebih cerdas menggunakan Gemini AI:
   - Klik menu **⚙️ API** di samping tombol AI.
   - Masukkan **Gemini API Key** kamu (dapat diperoleh gratis di [Google AI Studio](https://aistudio.google.com/)).
   - Klik **Simpan Key**.

### 3. Mengisi Absen Otomatis
- Klik tombol **⚡ Isi Absen Otomatis Sekarang**.
- Window Portal MagangHub akan terbuka dan otomatis mengisi form logbook dari template yang telah digenerate AI.

---

## 📦 Build Menjadi File Executable (.exe Portable)

Jika ingin membuat aplikasi siap pakai berupa satu file `.exe` portabel tanpa perlu membuka terminal atau menginstal Node.js di komputer lain:

```bash
npm run build
```

Setelah proses selesai, file aplikasi portabel akan tersedia di dalam folder:
```
dist/
└── MagangHub Reminder 1.0.0.exe
```

---

## 📂 Struktur Proyek

```plaintext
monev_AI/
├── index.html         # Tampilan antarmuka (UI widget & pengaturan)
├── index.js           # Proses utama Electron (Tray, Scheduler, Auto-Fill, IPC)
├── MulaiWidget.vbs    # Script launcher background tanpa window CMD
├── package.json       # Informasi modul & dependensi proyek
├── bun.lock           # Lockfile dependensi Bun
└── dist/              # Folder output build executable
```

---

## 🛠️ Pemecahan Masalah (Troubleshooting)

- **Ikon aplikasi tidak muncul di taskbar**:
  Aplikasi ini menggunakan mode Tray. Periksa menu tersembunyi (*overflow menu* tanda panah `^` di sebelah kanan taskbar Windows).
- **Gagal install Electron**:
  Pastikan koneksi internet stabil dan tidak terblokir firewall atau proxy perusahaan/kampus.
- **Port atau Session MagangHub**:
  Aplikasi menggunakan sesi browser internal Electron. Jika status absensi menampilkan *Perlu Login*, cukup login sekali di portal MagangHub yang terbuka dan sesi kamu akan tersimpan.

---

## 📄 Lisensi & Kontributor

- Dibuat untuk mempermudah kegiatan monitoring & evaluasi magang harian.
- Dikelola oleh [alifaris12](https://github.com/alifaris12/monev_AI).
