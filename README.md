# ▦ Calendarly

> **Sleek, Local-First Performance Tracking & Retrospective Scheduler**
> Built on a Glassmorphic Pure Black Canvas with vibrant Neon Accents. Designed for high-agency engineers to organize, execute, and reflect on productivity using the **PALM Methodology** (Plan, Act, Measure, Learn).

---

## 🚀 Quick Start (Docker Compose)

The entire Calendarly stack is fully containerized for instant local execution with secure, persistent database volume mounts.

### 1. Set Up Environment Variables
Copy the template to create your `.env` configuration:
```bash
cp .env.template .env
```
Open `.env` and configure a high-entropy transparent encryption passphrase:
```env
DB_ENCRYPTION_KEY="your-secure-high-entropy-passphrase-here"
```
The template already sets `DATABASE_PATH=/data/calendarly.db` so your database lives in a persistent Docker named volume (`db-data`) and **survives container rebuilds**. Do not change this path unless you are running the server natively without Docker.

### 2. Launch the Application Stack
Execute the standard compose launcher command:
```bash
docker-compose up --build -d
```
This builds and launches:
- **`calendarly-backend`**: Node.js Express service, compiling and running native SQLite/SQLCipher on port `3000`. Maps database records to a persistent Docker named volume.
- **`calendarly-frontend`**: Vite-compiled React UI served statically via a high-performance **Nginx** reverse proxy on port `5173`.

### 3. Open the Dashboard
Navigate to [http://localhost:5173](http://localhost:5173) in your browser.

---

## 💻 DietPI Chromebook Local Server Installation

Convert an old or secondary Chromebook into a dedicated, low-power **Calendarly home server** running **DietPI** (an ultra-lightweight, high-performance Debian-based distribution).

### Step 1: Install DietPI on Chromebook
1. **Enable Developer Mode** on your Chromebook.
2. **Flash DietPI** to a bootable USB drive/SD card using Rufus or BalenaEtcher.
3. Install DietPI using the native Chromebook firmware utility (e.g. MrChromebox custom UEFI firmware) or boot directly from external storage.
4. Complete the initial DietPI setup, change your default passwords, and update system packages:
   ```bash
   dietpi-update
   ```

### Step 2: Install Docker and Git via DietPI Software Center
DietPI has a custom, optimized software installation engine:
1. Run the software explorer:
   ```bash
   dietpi-software
   ```
2. Navigate to **Software Optimized** and select **Docker** and **Git**.
3. Select **Install** and reboot the Chromebook server.

### Step 3: Clone and Launch Calendarly
Clone this repository directly onto your DietPI server:
```bash
git clone https://github.com/your-username/calendarly.git /opt/calendarly
cd /opt/calendarly
cp .env.template .env
# Edit your DB_ENCRYPTION_KEY!
nano .env
docker-compose up -d
```

---

## 🔒 Accessing Calendarly Remotely & Securely via Tailscale

Instead of port forwarding or exposing your server to public internet traffic, utilize **Tailscale** to create a zero-config, encrypted WireGuard mesh network.

### 1. Install Tailscale on the DietPI Chromebook Server
Install Tailscale instantly with their automated script:
```bash
curl -fsSL https://tailscale.com/install.sh | sh
```
Start and authenticate the node:
```bash
sudo tailscale up
```
Click the link provided in the terminal to register the server into your private Tailscale admin console. Note the private IP assigned (e.g. `100.x.y.z`).

### 2. Install Tailscale on your Client Devices
Install Tailscale on your mobile phones, laptops, and tablets. Once connected, your devices are inside a secure, encrypted peer-to-peer network.

### 3. Securely Load Your Reflection Dashboard
From your laptop or phone anywhere in the world, simply visit:
```
http://100.x.y.z:5173
```
All data transfers are encrypted end-to-end, and the server is fully isolated from open ports.

---

## 🛡️ Integrity Safeguards & Transparent Encryption

Calendarly implements enterprise-level local security protocols to protect your personal productivity data:
- **sqlcipher Database Encryption**: Transparent cryptographic encryption secured via `PRAGMA key` on the SQLite driver level.
- **Golden Backup Recovery**: The backend automatically performs a non-destructive database backup before each boot and hosts a background service at `/api/health/integrity-check` that automatically detects database drift and recovers missing records from your highest-integrity backups.
- **Strict Environment Filters**: Dynamic `.gitignore` policies protect sensitive `.env` files, `.db` binary files, logs, and third-party dependencies from ever being committed to public version control.
