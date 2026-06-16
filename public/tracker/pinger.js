/**
 * POS Tracker — Embed Module v6.0
 * ─────────────────────────────────────────────────────────
 * Drop into your POS PWA. Zero UI. Auto-registers on first launch.
 *
 * NEW: appId field identifies which product this device belongs to.
 * NEW: GPS fallback — if user denies permission, Cloudflare IP
 *      geolocation is used automatically server-side. No extra code needed.
 *
 * USAGE:
 *   const tracker = new POSTracker({
 *     workerUrl: 'https://pos-coverage.YOUR.workers.dev',
 *     deviceKey:  'your-device-secret-key',
 *     appId:      'PWA2',            // ← identifies your product
 *     storeName:  '',  // optional
 *   });
 *   tracker.start();   // on app open / user login
 *   tracker.stop();    // on app close / user logout
 */

class POSTracker {
  constructor(config = {}) {
    if (!config.workerUrl) throw new Error('[POSTracker] workerUrl is required');
    if (!config.deviceKey) throw new Error('[POSTracker] deviceKey is required');

    this._base      = config.workerUrl.replace(/\/$/, '');
    this._key       = config.deviceKey;
    this.appId      = config.appId      || 'PWA2';
    this.storeName  = config.storeName  || '';
    this.interval   = config.interval   || 60 * 60 * 1000; // 1 hour

    this.onRegister = config.onRegister || null;
    this.onPing     = config.onPing     || null;
    this.onError    = config.onError    || null;

    this._timer      = null;
    this._visHandler = null;
    this._running    = false;
    this._ID_KEY     = 'pos_device_id_' + this.appId; // scoped per app
  }

  // ── PUBLIC ──────────────────────────────────────────────

  async start() {
    if (this._running) return;
    this._running = true;

    await this._ensureRegistered();
    await this._ping();

    this._timer = setInterval(() => this._ping(), this.interval);
    this._visHandler = () => {
      if (document.visibilityState === 'visible') this._ping();
    };
    document.addEventListener('visibilitychange', this._visHandler);
    console.log(`[POSTracker:${this.appId}] Running — ID: ${this.getDeviceId()}`);
  }

  stop() {
    this._running = false;
    if (this._timer)      { clearInterval(this._timer); this._timer = null; }
    if (this._visHandler) {
      document.removeEventListener('visibilitychange', this._visHandler);
      this._visHandler = null;
    }
    console.log(`[POSTracker:${this.appId}] Stopped.`);
  }

  forcePing()   { return this._ping(); }
  getDeviceId() { return localStorage.getItem(this._ID_KEY) || null; }

  // ── PRIVATE ─────────────────────────────────────────────

  async _ensureRegistered() {
    if (this.getDeviceId()) return;

    console.log(`[POSTracker:${this.appId}] First launch — registering...`);
    const payload = { app_id: this.appId, store_name: this.storeName };

    // Attempt GPS — if denied/unavailable, server uses IP geolocation automatically
    try {
      const pos = await this._gps();
      payload.latitude  = pos.coords.latitude;
      payload.longitude = pos.coords.longitude;
      payload.accuracy  = pos.coords.accuracy;
    } catch (_) {
      console.log(`[POSTracker:${this.appId}] GPS unavailable — server will use IP location`);
    }

    try {
      const res = await fetch(`${this._base}/register`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': this._key },
        body:    JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      localStorage.setItem(this._ID_KEY, data.device_id);
      console.log(`[POSTracker:${this.appId}] Registered — ID: ${data.device_id}`);
      if (this.onRegister) this.onRegister(data.device_id);
    } catch (err) {
      if (this.onError) this.onError(err);
      console.error(`[POSTracker:${this.appId}] Registration failed:`, err.message);
    }
  }

  async _ping() {
    const device_id = this.getDeviceId();
    if (!device_id) { console.warn(`[POSTracker:${this.appId}] No ID yet — skipping ping`); return; }

    const payload = { device_id, app_id: this.appId, store_name: this.storeName };

    // GPS attempt — server falls back to IP if not provided
    try {
      const pos = await this._gps();
      payload.latitude  = pos.coords.latitude;
      payload.longitude = pos.coords.longitude;
      payload.accuracy  = pos.coords.accuracy;
    } catch (_) {}

    try {
      const res = await fetch(`${this._base}/ping`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': this._key },
        body:    JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (this.onPing) this.onPing({ ...payload, ...data });
      console.log(`[POSTracker:${this.appId}] ✓ ping — ${device_id}`);
    } catch (err) {
      if (this.onError) this.onError(err);
      console.warn(`[POSTracker:${this.appId}] ✗ ping — ${err.message}`);
    }
  }

  _gps() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) { reject(); return; }
      navigator.geolocation.getCurrentPosition(resolve, reject,
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 3600000 }
      );
    });
  }
}

if (typeof module !== 'undefined' && module.exports) module.exports = POSTracker;
if (typeof window  !== 'undefined') window.POSTracker = POSTracker;
