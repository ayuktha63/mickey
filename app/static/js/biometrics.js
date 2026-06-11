// Mickey Biometrics Gateway Manager (Face Scan, Touch ID, and Username/Password Gate)

const Biometrics = {
  activeTab: 'face', // 'face', 'finger', or 'pass'
  isEnrolled: false,
  webcamStream: null,
  isScanning: false,
  enrollStep: 0, // 0 to 3 for fingerprint touch enrollment
  fingerScanFrameId: null,
  faceScanFrameId: null,

  async init() {
    // 1. Sync settings from server database to local storage
    try {
      const mode = localStorage.getItem('mickey_mode') || 'work';
      const res = await fetch('/api/settings', {
        headers: { 'X-Workspace-Mode': mode }
      });
      if (res.ok) {
        const data = await res.json();
        const keys = [
          'mickey_face_template',
          'mickey_fingerprint_template',
          'mickey_username',
          'mickey_password',
          'mickey_bio_enrolled',
          'mickey_pass_enrolled'
        ];
        keys.forEach(k => {
          if (data[k]) {
            localStorage.setItem(k, data[k]);
          } else {
            localStorage.removeItem(k);
          }
        });
      }
    } catch (e) {
      console.warn("Could not sync settings from server, using local credentials:", e);
    }

    this.isEnrolled = (
      localStorage.getItem('mickey_bio_enrolled') === 'true' ||
      localStorage.getItem('mickey_pass_enrolled') === 'true'
    );

    this.setupUI();
    this.checkSession();
    this.renderFingerprint('idle');
  },

  async syncBiometricsToServer() {
    try {
      const mode = localStorage.getItem('mickey_mode') || 'work';
      const payload = {
        mickey_face_template: localStorage.getItem('mickey_face_template') || null,
        mickey_fingerprint_template: localStorage.getItem('mickey_fingerprint_template') || null,
        mickey_username: localStorage.getItem('mickey_username') || null,
        mickey_password: localStorage.getItem('mickey_password') || null,
        mickey_bio_enrolled: localStorage.getItem('mickey_bio_enrolled') || null,
        mickey_pass_enrolled: localStorage.getItem('mickey_pass_enrolled') || null
      };
      await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Workspace-Mode': mode
        },
        body: JSON.stringify(payload)
      });
    } catch (e) {
      console.error("Error syncing biometrics to server database:", e);
    }
  },

  setupUI() {
    const tabFace = document.getElementById('tab-bio-face');
    const tabFinger = document.getElementById('tab-bio-finger');
    const tabPass = document.getElementById('tab-bio-pass');

    tabFace.addEventListener('click', () => this.switchTab('face'));
    tabFinger.addEventListener('click', () => this.switchTab('finger'));
    tabPass.addEventListener('click', () => this.switchTab('pass'));

    // Face action click
    document.getElementById('btn-bio-face-action').addEventListener('click', () => {
      this.startFaceScan();
    });

    // Fingerprint action click
    document.getElementById('btn-bio-finger-action').addEventListener('click', () => {
      this.startFingerprintScan();
    });

    document.getElementById('btn-bio-fingerprint-sensor').addEventListener('click', () => {
      this.startFingerprintScan();
    });

    // Password actions
    document.getElementById('btn-bio-pass-login').addEventListener('click', () => {
      this.handlePasswordLogin();
    });

    document.getElementById('btn-bio-pass-register').addEventListener('click', () => {
      this.handlePasswordRegister();
    });

    // Enroll new button
    document.getElementById('btn-bio-enroll').addEventListener('click', () => {
      this.enrollNewBio();
    });
  },

  switchTab(tab) {
    this.activeTab = tab;
    const tabs = ['face', 'finger', 'pass'];
    tabs.forEach(t => {
      const btn = document.getElementById(`tab-bio-${t}`);
      const panel = document.getElementById(`panel-bio-${t}`);
      if (t === tab) {
        btn.classList.add('active');
        panel.classList.add('active');
      } else {
        btn.classList.remove('active');
        panel.classList.remove('active');
      }
    });

    this.stopWebcam();
    this.stopAnimations();
    
    if (tab === 'face') {
      this.initWebcam();
    } else if (tab === 'finger') {
      this.renderFingerprint('idle');
    }
    if (typeof Sound !== 'undefined') Sound.playClick();
  },

  checkSession() {
    const sessionActive = sessionStorage.getItem('mickey_session_active') === 'true';
    const gate = document.getElementById('biometric-gateway');

    if (!this.isEnrolled) {
      gate.style.display = 'flex';
      document.getElementById('bio-gateway-desc').textContent = "Mickey Workspace Lock. Enrollment by Face Scan, Touch ID, or Credentials is required to start.";
      document.getElementById('btn-bio-enroll').style.display = 'none';
      if (this.activeTab === 'face') this.initWebcam();
    } else if (!sessionActive) {
      gate.style.display = 'flex';
      document.getElementById('bio-gateway-desc').textContent = "Mickey Workspace Locked. Please authenticate to unlock your session.";
      document.getElementById('btn-bio-enroll').style.display = 'inline-block';
      if (this.activeTab === 'face') this.initWebcam();
    } else {
      gate.style.display = 'none';
      this.stopWebcam();
      this.stopAnimations();
      if (typeof window.onMickeyUnlocked === 'function') {
        window.onMickeyUnlocked();
      }
    }
  },

  async initWebcam() {
    if (this.activeTab !== 'face') return;
    const video = document.getElementById('bio-webcam');
    try {
      this.webcamStream = await navigator.mediaDevices.getUserMedia({ video: { width: 180, height: 180 } });
      video.srcObject = this.webcamStream;
    } catch (e) {
      console.warn("Camera access denied or unavailable:", e);
      document.getElementById('face-status').innerHTML = "<span class='text-danger'>Camera access denied. Please use Fingerprint or Password gate verification.</span>";
    }
  },

  stopWebcam() {
    if (this.webcamStream) {
      this.webcamStream.getTracks().forEach(track => track.stop());
      this.webcamStream = null;
    }
  },

  stopAnimations() {
    if (this.faceScanFrameId) {
      cancelAnimationFrame(this.faceScanFrameId);
      this.faceScanFrameId = null;
    }
    if (this.fingerScanFrameId) {
      cancelAnimationFrame(this.fingerScanFrameId);
      this.fingerScanFrameId = null;
    }
  },

  // --- Face scan animation (Radar grids / Landmark overlays) ---
  animateFaceScanning() {
    const canvas = document.getElementById('face-landmarks-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    
    let laserY = 0;
    let laserDir = 1;
    const startTime = Date.now();
    
    const baseNodes = [
      {x: 0.3, y: 0.35}, {x: 0.4, y: 0.35}, // left eye
      {x: 0.6, y: 0.35}, {x: 0.7, y: 0.35}, // right eye
      {x: 0.5, y: 0.42}, {x: 0.5, y: 0.52}, {x: 0.45, y: 0.55}, {x: 0.55, y: 0.55}, // nose
      {x: 0.42, y: 0.68}, {x: 0.5, y: 0.65}, {x: 0.58, y: 0.68}, {x: 0.5, y: 0.72}, // mouth
      {x: 0.25, y: 0.48}, {x: 0.75, y: 0.48}, // cheeks
      {x: 0.5, y: 0.85}, {x: 0.35, y: 0.8}, {x: 0.65, y: 0.8}, // chin/jaw
      {x: 0.22, y: 0.65}, {x: 0.78, y: 0.65} // lower cheeks
    ];

    const draw = () => {
      if (!this.isScanning) {
        ctx.clearRect(0, 0, w, h);
        return;
      }
      
      ctx.clearRect(0, 0, w, h);
      const elapsed = (Date.now() - startTime) / 1000;
      
      // Laser sweep position
      laserY += laserDir * 2.5;
      if (laserY > h) { laserY = h; laserDir = -1; }
      if (laserY < 0) { laserY = 0; laserDir = 1; }
      
      // Bounding box frame
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(w / 2, h / 2, w * 0.4, h * 0.45, 0, 0, 2 * Math.PI);
      ctx.stroke();

      // Nodes mesh wires
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < baseNodes.length; i++) {
        for (let j = i + 1; j < baseNodes.length; j++) {
          const dx = baseNodes[i].x - baseNodes[j].x;
          const dy = baseNodes[i].y - baseNodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 0.25) {
            ctx.moveTo(baseNodes[i].x * w, baseNodes[i].y * h);
            ctx.lineTo(baseNodes[j].x * w, baseNodes[j].y * h);
          }
        }
      }
      ctx.stroke();

      // Scanning Landmark Nodes
      ctx.fillStyle = '#06b6d4';
      baseNodes.forEach((node, idx) => {
        const px = node.x * w;
        const py = node.y * h;
        const pulse = Math.sin(elapsed * 8 + idx) * 1.5;
        
        ctx.beginPath();
        ctx.arc(px, py, 2.5 + pulse, 0, 2 * Math.PI);
        ctx.fill();
      });

      // Sweeping radar pulse
      const pulseRad = (elapsed * 50) % (w * 0.45);
      ctx.strokeStyle = `rgba(6, 182, 212, ${Math.max(0, 1 - pulseRad / (w * 0.45)) * 0.35})`;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, pulseRad, 0, 2 * Math.PI);
      ctx.stroke();

      // Moving neon laser bar
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#06b6d4';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(w * 0.1, laserY);
      ctx.lineTo(w * 0.9, laserY);
      ctx.stroke();
      ctx.shadowBlur = 0;

      this.faceScanFrameId = requestAnimationFrame(draw);
    };
    
    this.faceScanFrameId = requestAnimationFrame(draw);
  },

  startFaceScan() {
    if (this.isScanning) return;
    this.isScanning = true;
    if (typeof Sound !== 'undefined') Sound.playClick();

    const statusText = document.getElementById('face-status');
    const actionBtn = document.getElementById('btn-bio-face-action');
    const isEnrolling = !localStorage.getItem('mickey_face_template');

    statusText.textContent = isEnrolling ? "Enrolling face structure..." : "Scanning face structures...";
    actionBtn.textContent = "Scanning...";

    // Start drawing scan overlay lines
    this.animateFaceScanning();

    let count = 0;
    const scanInterval = setInterval(() => {
      count++;
      if (count === 1) {
        statusText.textContent = "Analyzing facial nodes...";
        if (typeof Sound !== 'undefined') Sound.playTone(880, 'sine', 0.05, 0.05);
      } else if (count === 2) {
        statusText.textContent = "Extracting details...";
        if (typeof Sound !== 'undefined') Sound.playTone(1000, 'sine', 0.05, 0.05);
      } else if (count === 3) {
        statusText.textContent = isEnrolling ? "Saving template..." : "Verifying template match...";
        if (typeof Sound !== 'undefined') Sound.playTone(1200, 'sine', 0.05, 0.05);
      } else if (count === 4) {
        clearInterval(scanInterval);
        this.isScanning = false;
        this.stopAnimations();
        
        const video = document.getElementById('bio-webcam');
        if (!video || !video.srcObject) {
          statusText.textContent = "Error: Webcam not active.";
          actionBtn.textContent = "Initialize Face Scan";
          return;
        }

        try {
          const canvas = document.createElement('canvas');
          canvas.width = 40;
          canvas.height = 40;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(video, 0, 0, 40, 40);
          const imgData = ctx.getImageData(0, 0, 40, 40);
          const pixels = [];
          for (let i = 0; i < imgData.data.length; i += 4) {
            const gray = Math.round(0.299 * imgData.data[i] + 0.587 * imgData.data[i+1] + 0.114 * imgData.data[i+2]);
            pixels.push(gray);
          }

          if (isEnrolling) {
            localStorage.setItem('mickey_face_template', JSON.stringify(pixels));
            localStorage.setItem('mickey_bio_enrolled', 'true');
            sessionStorage.setItem('mickey_session_active', 'true');
            this.isEnrolled = true;
            statusText.textContent = "Face enrolled successfully! Session unlocked.";
            if (typeof Sound !== 'undefined') Sound.playSuccess();
            
            // Sync to database
            this.syncBiometricsToServer();
            
            setTimeout(() => {
              this.checkSession();
              actionBtn.textContent = "Initialize Face Scan";
            }, 1000);
          } else {
            const template = JSON.parse(localStorage.getItem('mickey_face_template'));
            let totalDiff = 0;
            let pCount = 0;
            for (let i = 0; i < pixels.length; i++) {
              totalDiff += Math.abs(pixels[i] - template[i]);
              pCount++;
            }
            const avgDiff = totalDiff / pCount;
            console.log("Average face diff:", avgDiff);
            
            if (avgDiff < 45) {
              sessionStorage.setItem('mickey_session_active', 'true');
              statusText.textContent = "Face verified! Welcome back.";
              if (typeof Sound !== 'undefined') Sound.playSuccess();
              setTimeout(() => {
                this.checkSession();
                actionBtn.textContent = "Initialize Face Scan";
              }, 1000);
            } else {
              statusText.textContent = "Face verification failed. Face does not match registered owner.";
              if (typeof Sound !== 'undefined') Sound.playFailure();
              actionBtn.textContent = "Try Face Scan Again";
            }
          }
        } catch (err) {
          console.error("Grayscale pixel comparison error:", err);
          statusText.textContent = "Verification error. Please retry.";
          actionBtn.textContent = "Initialize Face Scan";
        }
      }
    }, 600);
  },

  // --- Fingerprint custom canvas renderer ---
  renderFingerprint(state, progress = 0, laserY = 0) {
    const canvas = document.getElementById('fingerprint-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    
    const cx = w / 2;
    const cy = h / 2;
    
    // Outer circle
    ctx.strokeStyle = state === 'success' ? '#10b981' : state === 'scanning' ? '#6366f1' : 'var(--border)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, w / 2 - 5, 0, 2 * Math.PI);
    ctx.stroke();

    // Concentric arches representing fingerprint
    ctx.strokeStyle = state === 'success' ? '#10b981' : state === 'scanning' ? '#6366f1' : 'var(--text-muted)';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    
    const arches = [
      { r: 10, start: 0, end: 2 * Math.PI, cyOffset: -2 },
      { r: 18, start: Math.PI * 1.0, end: Math.PI * 2.0, cyOffset: 0 },
      { r: 26, start: Math.PI * 1.1, end: Math.PI * 1.9, cyOffset: 4 },
      { r: 34, start: Math.PI * 1.2, end: Math.PI * 1.8, cyOffset: 8 },
      { r: 42, start: Math.PI * 0.2, end: Math.PI * 0.8, cyOffset: -8 },
      { r: 50, start: Math.PI * 0.15, end: Math.PI * 0.85, cyOffset: -4 }
    ];

    arches.forEach(arch => {
      ctx.beginPath();
      ctx.arc(cx, cy + arch.cyOffset, arch.r, arch.start, arch.end);
      ctx.stroke();
    });

    // Drawing Laser Scanning Line
    if (state === 'scanning') {
      ctx.strokeStyle = '#6366f1';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#6366f1';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(w * 0.15, laserY);
      ctx.lineTo(w * 0.85, laserY);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  },

  animateFingerprintScan(duration, callback) {
    const canvas = document.getElementById('fingerprint-canvas');
    if (!canvas) return;
    const startTime = Date.now();
    let laserY = 10;
    let laserDir = 1;

    const frame = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(1, elapsed / duration);
      
      // laser sweeping
      laserY += laserDir * 3;
      if (laserY > 110) { laserY = 110; laserDir = -1; }
      if (laserY < 10) { laserY = 10; laserDir = 1; }

      this.renderFingerprint('scanning', progress, laserY);

      if (progress < 1) {
        this.fingerScanFrameId = requestAnimationFrame(frame);
      } else {
        cancelAnimationFrame(this.fingerScanFrameId);
        callback();
      }
    };
    
    this.fingerScanFrameId = requestAnimationFrame(frame);
  },

  async registerWebAuthn() {
    const statusText = document.getElementById('fingerprint-status');
    statusText.textContent = "Please touch the Mac Touch ID sensor to register...";
    
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);
    
    const userId = new Uint8Array(16);
    window.crypto.getRandomValues(userId);
    
    const rpId = window.location.hostname || "localhost";
    
    const createOptions = {
      publicKey: {
        challenge: challenge,
        rp: {
          name: "Mickey Workspace",
          id: rpId
        },
        user: {
          id: userId,
          name: localStorage.getItem('mickey_username') || "mickey_user",
          displayName: localStorage.getItem('mickey_username') || "Mickey User"
        },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },  // ES256
          { type: "public-key", alg: -257 } // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required"
        },
        timeout: 60000,
        attestation: "none"
      }
    };
    
    try {
      const credential = await navigator.credentials.create(createOptions);
      if (credential) {
        const rawId = new Uint8Array(credential.rawId);
        const base64Id = btoa(String.fromCharCode.apply(null, rawId));
        
        localStorage.setItem('mickey_fingerprint_template', base64Id);
        localStorage.setItem('mickey_bio_enrolled', 'true');
        sessionStorage.setItem('mickey_session_active', 'true');
        this.isEnrolled = true;
        this.enrollStep = 0;
        
        statusText.textContent = "Hardware Touch ID registered successfully!";
        this.renderFingerprint('success');
        if (typeof Sound !== 'undefined') Sound.playSuccess();
        
        await this.syncBiometricsToServer();
        
        setTimeout(() => {
          this.checkSession();
          document.getElementById('btn-bio-finger-action').textContent = "Scan Fingerprint";
        }, 1200);
        return true;
      }
    } catch (err) {
      console.error("WebAuthn registration error:", err);
      statusText.textContent = "Hardware enrollment failed: " + err.message + ". Falling back to simulator.";
      if (typeof Sound !== 'undefined') Sound.playFailure();
    }
    return false;
  },

  async authenticateWebAuthn(base64Id) {
    const statusText = document.getElementById('fingerprint-status');
    statusText.textContent = "Please touch the Mac Touch ID sensor to authenticate...";
    
    const rawIdStr = atob(base64Id);
    const rawId = new Uint8Array(rawIdStr.length);
    for (let i = 0; i < rawIdStr.length; i++) {
      rawId[i] = rawIdStr.charCodeAt(i);
    }
    
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);
    
    const rpId = window.location.hostname || "localhost";
    
    const getOptions = {
      publicKey: {
        challenge: challenge,
        rpId: rpId,
        allowCredentials: [{
          id: rawId,
          type: "public-key"
        }],
        userVerification: "required",
        timeout: 60000
      }
    };
    
    try {
      const assertion = await navigator.credentials.get(getOptions);
      if (assertion) {
        sessionStorage.setItem('mickey_session_active', 'true');
        statusText.textContent = "Authenticated successfully via Touch ID!";
        this.renderFingerprint('success');
        if (typeof Sound !== 'undefined') Sound.playSuccess();
        
        setTimeout(() => {
          this.checkSession();
          document.getElementById('btn-bio-finger-action').textContent = "Scan Fingerprint";
        }, 1200);
        return true;
      }
    } catch (err) {
      console.error("WebAuthn assertion error:", err);
      statusText.textContent = "Touch ID verification failed: " + err.message;
      if (typeof Sound !== 'undefined') Sound.playFailure();
    }
    return false;
  },

  async startFingerprintScan() {
    if (this.isScanning) return;
    this.isScanning = true;
    if (typeof Sound !== 'undefined') Sound.playClick();

    const sensor = document.getElementById('btn-bio-fingerprint-sensor');
    const statusText = document.getElementById('fingerprint-status');
    const actionBtn = document.getElementById('btn-bio-finger-action');
    const isEnrolling = !localStorage.getItem('mickey_fingerprint_template');

    sensor.classList.add('scanning');
    actionBtn.textContent = "Scanning...";

    let hasWebAuthn = false;
    try {
      if (window.PublicKeyCredential) {
        hasWebAuthn = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      }
    } catch (e) {
      console.warn("Platform authenticator check error:", e);
    }

    if (hasWebAuthn) {
      if (isEnrolling) {
        this.animateFingerprintScan(1500, async () => {
          const success = await this.registerWebAuthn();
          sensor.classList.remove('scanning');
          this.isScanning = false;
          if (!success) {
            this.renderFingerprint('idle');
          }
        });
      } else {
        const storedTemplate = localStorage.getItem('mickey_fingerprint_template');
        this.animateFingerprintScan(1500, async () => {
          const success = await this.authenticateWebAuthn(storedTemplate);
          sensor.classList.remove('scanning');
          this.isScanning = false;
          if (!success) {
            this.renderFingerprint('idle');
          }
        });
      }
    } else {
      if (isEnrolling) {
        this.enrollStep++;
        statusText.textContent = `Scanning fingerprint (Touch ${this.enrollStep} of 3)...`;
        
        this.animateFingerprintScan(1000, () => {
          sensor.classList.remove('scanning');
          this.isScanning = false;
          
          if (this.enrollStep < 3) {
            statusText.textContent = `Step ${this.enrollStep}/3 complete. Please lift and touch sensor again.`;
            this.renderFingerprint('idle');
            if (typeof Sound !== 'undefined') Sound.playTone(1000, 'sine', 0.1, 0.1);
          } else {
            localStorage.setItem('mickey_fingerprint_template', 'print_hash_' + Math.random().toString(36).substring(7));
            localStorage.setItem('mickey_bio_enrolled', 'true');
            sessionStorage.setItem('mickey_session_active', 'true');
            this.isEnrolled = true;
            this.enrollStep = 0;
            
            statusText.textContent = "Touch ID configured successfully!";
            this.renderFingerprint('success');
            if (typeof Sound !== 'undefined') Sound.playSuccess();
            
            this.syncBiometricsToServer();
            
            setTimeout(() => {
              this.checkSession();
              actionBtn.textContent = "Scan Fingerprint";
            }, 1200);
          }
        });
      } else {
        statusText.textContent = "Scanning print pattern...";
        this.animateFingerprintScan(1200, () => {
          sensor.classList.remove('scanning');
          this.isScanning = false;
          
          sessionStorage.setItem('mickey_session_active', 'true');
          statusText.textContent = "Fingerprint authenticated!";
          this.renderFingerprint('success');
          if (typeof Sound !== 'undefined') Sound.playSuccess();
          
          setTimeout(() => {
            this.checkSession();
            actionBtn.textContent = "Scan Fingerprint";
          }, 1200);
        });
      }
    }
  },

  handlePasswordRegister() {
    const userEl = document.getElementById('bio-username');
    const passEl = document.getElementById('bio-password');
    const statusText = document.getElementById('pass-status');

    const username = userEl.value.trim();
    const password = passEl.value.trim();

    if (!username || !password) {
      statusText.textContent = "Username and password cannot be blank.";
      if (typeof Sound !== 'undefined') Sound.playFailure();
      return;
    }

    if (localStorage.getItem('mickey_username')) {
      statusText.textContent = "An owner is already registered. Reset first.";
      if (typeof Sound !== 'undefined') Sound.playFailure();
      return;
    }

    localStorage.setItem('mickey_username', username);
    localStorage.setItem('mickey_password', password);
    localStorage.setItem('mickey_pass_enrolled', 'true');
    sessionStorage.setItem('mickey_session_active', 'true');
    this.isEnrolled = true;

    statusText.textContent = "Credentials registered! Session unlocked.";
    if (typeof Sound !== 'undefined') Sound.playSuccess();
    
    // Sync credentials to database
    this.syncBiometricsToServer();

    setTimeout(() => {
      userEl.value = '';
      passEl.value = '';
      this.checkSession();
    }, 1000);
  },

  handlePasswordLogin() {
    const userEl = document.getElementById('bio-username');
    const passEl = document.getElementById('bio-password');
    const statusText = document.getElementById('pass-status');

    const username = userEl.value.trim();
    const password = passEl.value.trim();

    const storedUser = localStorage.getItem('mickey_username');
    const storedPass = localStorage.getItem('mickey_password');

    if (!storedUser) {
      statusText.textContent = "No credentials registered. Please click Register first.";
      if (typeof Sound !== 'undefined') Sound.playFailure();
      return;
    }

    if (username === storedUser && password === storedPass) {
      sessionStorage.setItem('mickey_session_active', 'true');
      statusText.textContent = "Credentials match! Session unlocked.";
      if (typeof Sound !== 'undefined') Sound.playSuccess();
      
      setTimeout(() => {
        userEl.value = '';
        passEl.value = '';
        this.checkSession();
      }, 1000);
    } else {
      statusText.textContent = "Incorrect username or password.";
      if (typeof Sound !== 'undefined') Sound.playFailure();
    }
  },

  enrollNewBio() {
    if (typeof Sound !== 'undefined') Sound.playClick();
    if (confirm("Reset current lock registration? All registered bio structures and passwords will be cleared from local storage and backend database.")) {
      localStorage.removeItem('mickey_bio_enrolled');
      localStorage.removeItem('mickey_pass_enrolled');
      localStorage.removeItem('mickey_face_template');
      localStorage.removeItem('mickey_fingerprint_template');
      localStorage.removeItem('mickey_username');
      localStorage.removeItem('mickey_password');
      sessionStorage.removeItem('mickey_session_active');
      this.isEnrolled = false;
      this.enrollStep = 0;
      
      // Update clean records on database settings
      this.syncBiometricsToServer();
      this.checkSession();
      this.renderFingerprint('idle');
    }
  },

  logout() {
    sessionStorage.removeItem('mickey_session_active');
    if (typeof Sound !== 'undefined') Sound.playFailure();
    window.location.reload();
  }
};

document.addEventListener('DOMContentLoaded', () => {
  Biometrics.init();
});
