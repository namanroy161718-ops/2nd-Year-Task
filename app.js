// ProofPass Web Interface JavaScript

const API_BASE = (window.location.port === '8000')
  ? 'http://127.0.0.1:8000' 
  : '';

const sessionCertificates = new Set();

// DOM Content Loaded
document.addEventListener('DOMContentLoaded', () => {
  initHealthCheck();
  initTabs();
  initSampleFillers();
  initForms();
  initCopyButtons();
  initClearLogs();
  
  // Set today's date on all date inputs
  const today = new Date().toISOString().split('T')[0];
  const regDateInput = document.getElementById('reg-issue-date');
  const verDateInput = document.getElementById('ver-issue-date');
  if (regDateInput) regDateInput.value = today;
  if (verDateInput) verDateInput.value = today;
});

// Toast System
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <div class="toast-content">
      <span>${escapeHtml(message)}</span>
    </div>
  `;
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Health Check
async function initHealthCheck() {
  const chip = document.getElementById('api-status-chip');
  const text = document.getElementById('api-status-text');
  
  async function check() {
    try {
      const res = await fetch(`${API_BASE}/api/health`);
      if (res.ok) {
        text.textContent = 'API Online (8000)';
        chip.querySelector('.status-dot').style.backgroundColor = 'var(--emerald)';
      } else {
        throw new Error('API degraded');
      }
    } catch {
      text.textContent = 'API Offline';
      chip.querySelector('.status-dot').style.backgroundColor = 'var(--danger)';
    }
  }
  
  check();
  setInterval(check, 10000);
}

// Tab Switching
function initTabs() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabPanes = document.querySelectorAll('.tab-content');
  
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-tab');
      
      tabButtons.forEach(b => b.classList.remove('active'));
      tabPanes.forEach(p => {
        p.classList.remove('active');
        p.classList.add('hidden');
      });
      
      btn.classList.add('active');
      const targetPane = document.getElementById(`pane-${tabId}`);
      if (targetPane) {
        targetPane.classList.remove('hidden');
        targetPane.classList.add('active');
      }
    });
  });
}

// Sample Data Fillers
function initSampleFillers() {
  const btnSampleReg = document.getElementById('btn-fill-sample-reg');
  const btnValidVerify = document.getElementById('btn-fill-valid-verify');
  const btnTamperVerify = document.getElementById('btn-fill-tampered-verify');
  
  const sample = {
    id: `CERT-2026-${Math.floor(100 + Math.random() * 900)}`,
    student: 'Sayan Roy',
    course: 'Distributed Systems & Ethereum Smart Contracts',
    issuer: 'Decentralized Tech Institute',
    date: new Date().toISOString().split('T')[0]
  };

  if (btnSampleReg) {
    btnSampleReg.addEventListener('click', () => {
      document.getElementById('reg-cert-id').value = sample.id;
      document.getElementById('reg-student-name').value = sample.student;
      document.getElementById('reg-course-name').value = sample.course;
      document.getElementById('reg-issuer').value = sample.issuer;
      document.getElementById('reg-issue-date').value = sample.date;
      showToast('Sample certificate parameters populated', 'info');
    });
  }

  if (btnValidVerify) {
    btnValidVerify.addEventListener('click', () => {
      // Pick first registered certificate if any exists
      const firstCert = Array.from(sessionCertificates)[0] || 'CERT-2026-001';
      document.getElementById('ver-cert-id').value = firstCert;
      document.getElementById('ver-student-name').value = 'Alice Smith';
      document.getElementById('ver-course-name').value = 'Blockchain Architecture';
      document.getElementById('ver-issuer').value = 'ProofPass Academy';
      document.getElementById('ver-issue-date').value = '2026-09-27';
      showToast('Valid registered certificate data loaded', 'info');
    });
  }

  if (btnTamperVerify) {
    btnTamperVerify.addEventListener('click', () => {
      const firstCert = Array.from(sessionCertificates)[0] || 'CERT-2026-001';
      document.getElementById('ver-cert-id').value = firstCert;
      document.getElementById('ver-student-name').value = 'Eve Fraudulent (Tampered)';
      document.getElementById('ver-course-name').value = 'Blockchain Architecture';
      document.getElementById('ver-issuer').value = 'ProofPass Academy';
      document.getElementById('ver-issue-date').value = '2026-09-27';
      showToast('Tampered name injected to test cryptographic failure', 'info');
    });
  }
}

// Form Handlers
function initForms() {
  // 1. Register Form
  const formRegister = document.getElementById('form-register');
  if (formRegister) {
    formRegister.addEventListener('submit', async (e) => {
      e.preventDefault();
      const spinner = document.getElementById('spinner-register');
      const submitBtn = document.getElementById('btn-submit-register');
      
      const payload = {
        certificateId: document.getElementById('reg-cert-id').value.trim(),
        studentName: document.getElementById('reg-student-name').value.trim(),
        courseName: document.getElementById('reg-course-name').value.trim(),
        issuer: document.getElementById('reg-issuer').value.trim(),
        issueDate: document.getElementById('reg-issue-date').value,
      };

      setButtonLoading(submitBtn, spinner, true);

      try {
        const response = await fetch(`${API_BASE}/api/certificates/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.detail || 'Registration failed on chain');
        }

        const data = await response.json();
        renderRegistrationResult(data);
        
        // Add to session certificates and logs
        addSessionCertificate(payload.certificateId);
        logActivity('REGISTER', payload.certificateId, 'SUCCESS', `Block #${data.blockchain?.blockNumber || '-'}`);
        showToast(`Certificate ${payload.certificateId} registered on-chain!`, 'success');

        // Fetch QR Code
        fetchCertificateQR(payload.certificateId, 'reg');

      } catch (err) {
        showToast(err.message, 'error');
        logActivity('REGISTER', payload.certificateId, 'ERROR', err.message);
      } finally {
        setButtonLoading(submitBtn, spinner, false);
      }
    });
  }

  // 2. Verify Form
  const formVerify = document.getElementById('form-verify');
  if (formVerify) {
    formVerify.addEventListener('submit', async (e) => {
      e.preventDefault();
      const spinner = document.getElementById('spinner-verify');
      const submitBtn = document.getElementById('btn-submit-verify');

      const payload = {
        certificateId: document.getElementById('ver-cert-id').value.trim(),
        studentName: document.getElementById('ver-student-name').value.trim(),
        courseName: document.getElementById('ver-course-name').value.trim(),
        issuer: document.getElementById('ver-issuer').value.trim(),
        issueDate: document.getElementById('ver-issue-date').value,
      };

      setButtonLoading(submitBtn, spinner, true);

      try {
        const response = await fetch(`${API_BASE}/api/certificates/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await response.json();
        renderVerificationResult(data);

        logActivity('VERIFY', payload.certificateId, data.status, `Submitted Hash vs On-Chain`);
        
        if (data.status === 'VALID') {
          showToast('Certificate verified authentic!', 'success');
        } else if (data.status === 'TAMPERED') {
          showToast('Tamper alert: cryptographic hash mismatch!', 'error');
        } else if (data.status === 'REVOKED') {
          showToast('Certificate has been revoked by issuer!', 'error');
        } else {
          showToast('Certificate ID not found on blockchain.', 'info');
        }
      } catch (err) {
        showToast(err.message, 'error');
        logActivity('VERIFY', payload.certificateId, 'ERROR', err.message);
      } finally {
        setButtonLoading(submitBtn, spinner, false);
      }
    });
  }

  // 3. Lookup Form
  const formLookup = document.getElementById('form-lookup');
  if (formLookup) {
    formLookup.addEventListener('submit', async (e) => {
      e.preventDefault();
      const certId = document.getElementById('lookup-cert-id').value.trim();
      executeLookup(certId);
    });
  }

  // 4. Revoke Form
  const formRevoke = document.getElementById('form-revoke');
  if (formRevoke) {
    formRevoke.addEventListener('submit', async (e) => {
      e.preventDefault();
      const certId = document.getElementById('revoke-cert-id').value.trim();
      const spinner = document.getElementById('spinner-revoke');
      const submitBtn = document.getElementById('btn-submit-revoke');

      setButtonLoading(submitBtn, spinner, true);

      try {
        const response = await fetch(`${API_BASE}/api/certificates/revoke`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ certificateId: certId })
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.detail || 'Revocation failed');
        }

        const data = await response.json();
        renderRevocationResult(data, certId);
        logActivity('REVOKE', certId, 'REVOKED', `Tx: ${data.transactionHash?.slice(0, 10)}...`);
        showToast(`Certificate ${certId} revoked on chain!`, 'success');
      } catch (err) {
        showToast(err.message, 'error');
        logActivity('REVOKE', certId, 'ERROR', err.message);
      } finally {
        setButtonLoading(submitBtn, spinner, false);
      }
    });
  }
}

// Lookup Logic
async function executeLookup(certId) {
  if (!certId) return;
  const spinner = document.getElementById('spinner-lookup');
  const submitBtn = document.getElementById('btn-submit-lookup');

  setButtonLoading(submitBtn, spinner, true);

  try {
    const response = await fetch(`${API_BASE}/api/verify/${encodeURIComponent(certId)}`);
    const data = await response.json();
    renderLookupResult(data);
    fetchCertificateQR(certId, 'lookup');
    logActivity('LOOKUP', certId, data.status, `State: ${data.status}`);
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    setButtonLoading(submitBtn, spinner, false);
  }
}

// Fetch QR Code
async function fetchCertificateQR(certId, prefix) {
  try {
    const res = await fetch(`${API_BASE}/api/certificates/${encodeURIComponent(certId)}/qr`);
    if (!res.ok) return;
    const data = await res.json();
    
    const imgEl = document.getElementById(`${prefix}-qr-img`);
    const linkEl = document.getElementById(`${prefix}-qr-link`);
    
    if (imgEl && data.dataUrl) {
      imgEl.src = data.dataUrl;
    }
    if (linkEl && data.verificationUrl) {
      linkEl.href = data.verificationUrl;
      linkEl.textContent = `Open Direct API Verification Endpoint`;
    }
  } catch (err) {
    console.warn('QR generation skipped:', err);
  }
}

// Render Results
function renderRegistrationResult(data) {
  document.getElementById('reg-placeholder').classList.add('hidden');
  document.getElementById('reg-details').classList.remove('hidden');

  const badge = document.getElementById('reg-badge');
  badge.className = 'badge badge-valid';
  badge.textContent = 'MINTED & CONFIRMED';

  document.getElementById('res-cert-id').textContent = data.certificateId;
  document.getElementById('res-cert-hash').textContent = data.hash;
  document.getElementById('res-tx-hash').textContent = data.blockchain?.transactionHash || '-';
  document.getElementById('res-block-num').textContent = `#${data.blockchain?.blockNumber ?? '-'}`;
  document.getElementById('res-issuer-addr').textContent = data.blockchain?.issuer || '-';
}

function renderVerificationResult(data) {
  document.getElementById('ver-placeholder').classList.add('hidden');
  document.getElementById('ver-details').classList.remove('hidden');

  const badge = document.getElementById('ver-badge');
  const banner = document.getElementById('verdict-banner');
  const icon = document.getElementById('verdict-icon');
  const title = document.getElementById('verdict-title');
  const desc = document.getElementById('verdict-desc');
  const matchStatus = document.getElementById('hash-match-status');

  document.getElementById('ver-submitted-hash').textContent = data.submittedHash || '-';
  document.getElementById('ver-stored-hash').textContent = data.storedHash || 'Not Found';
  document.getElementById('ver-issuer-addr').textContent = data.issuer || 'N/A';
  document.getElementById('ver-timestamp').textContent = data.issuedAt 
    ? new Date(data.issuedAt * 1000).toLocaleString() 
    : 'N/A';
  document.getElementById('ver-revoked-status').textContent = data.revoked ? 'REVOKED' : 'Active (Not Revoked)';

  banner.className = 'verdict-banner';

  if (data.status === 'VALID') {
    badge.className = 'badge badge-valid';
    badge.textContent = 'VALID & UNTAMPERED';
    banner.classList.add('valid');
    icon.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`;
    title.textContent = 'Cryptographic Proof Verified Authentic';
    desc.textContent = 'The recalculated SHA-256 hash strictly matches the immutable hash on the blockchain. Credential has not been tampered with.';
    matchStatus.className = 'badge-mini badge-valid';
    matchStatus.textContent = 'MATCHED';
  } else if (data.status === 'TAMPERED') {
    badge.className = 'badge badge-tampered';
    badge.textContent = 'TAMPER DETECTED';
    banner.classList.add('tampered');
    icon.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
    title.textContent = 'Tampered Credential Alert';
    desc.textContent = 'The computed hash of the submitted data does NOT match the hash recorded on chain. One or more fields have been altered!';
    matchStatus.className = 'badge-mini badge-tampered';
    matchStatus.textContent = 'MISMATCH';
  } else if (data.status === 'REVOKED') {
    badge.className = 'badge badge-revoked';
    badge.textContent = 'REVOKED CREDENTIAL';
    banner.classList.add('revoked');
    icon.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>`;
    title.textContent = 'Certificate Has Been Revoked';
    desc.textContent = 'The credential was previously issued but has been formally revoked by an authorized authority on-chain.';
    matchStatus.className = 'badge-mini badge-revoked';
    matchStatus.textContent = 'REVOKED';
  } else {
    badge.className = 'badge badge-notfound';
    badge.textContent = 'NOT FOUND';
    banner.classList.add('notfound');
    icon.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
    title.textContent = 'Certificate Not Found';
    desc.textContent = 'No certificate with this ID exists on the smart contract registry.';
    matchStatus.className = 'badge-mini badge-notfound';
    matchStatus.textContent = 'N/A';
  }
}

function renderLookupResult(data) {
  document.getElementById('lookup-placeholder').classList.add('hidden');
  document.getElementById('lookup-details').classList.remove('hidden');

  const badge = document.getElementById('lookup-badge');
  const statusText = document.getElementById('lookup-status-text');

  if (data.status === 'REGISTERED') {
    badge.className = 'badge badge-valid';
    badge.textContent = 'REGISTERED';
    statusText.textContent = 'Active On Blockchain';
    statusText.style.color = 'var(--emerald)';
  } else if (data.status === 'REVOKED') {
    badge.className = 'badge badge-revoked';
    badge.textContent = 'REVOKED';
    statusText.textContent = 'Revoked by Authority';
    statusText.style.color = 'var(--amber)';
  } else {
    badge.className = 'badge badge-notfound';
    badge.textContent = 'NOT FOUND';
    statusText.textContent = 'Unregistered / Does Not Exist';
    statusText.style.color = 'var(--text-dim)';
  }

  document.getElementById('lookup-issuer-addr').textContent = data.issuer || 'N/A';
  document.getElementById('lookup-timestamp').textContent = data.issuedAt 
    ? new Date(data.issuedAt * 1000).toLocaleString() 
    : 'N/A';
}

function renderRevocationResult(data, certId) {
  document.getElementById('revoke-placeholder').classList.add('hidden');
  document.getElementById('revoke-details').classList.remove('hidden');

  const badge = document.getElementById('revoke-badge');
  badge.className = 'badge badge-revoked';
  badge.textContent = 'CONFIRMED REVOKED';

  document.getElementById('rev-cert-id').textContent = certId;
  document.getElementById('rev-tx-hash').textContent = data.transactionHash || '-';
  document.getElementById('rev-block-num').textContent = `#${data.blockNumber ?? '-'}`;
  document.getElementById('rev-revoked-by').textContent = data.revokedBy || '-';
}

// Session Certificates Quick-Pick
function addSessionCertificate(certId) {
  sessionCertificates.add(certId);
  const container = document.getElementById('recent-chips');
  if (!container) return;

  container.innerHTML = '';
  sessionCertificates.forEach(id => {
    const chip = document.createElement('span');
    chip.className = 'chip-tag';
    chip.textContent = id;
    chip.title = 'Click to query this certificate';
    chip.addEventListener('click', () => {
      document.getElementById('lookup-cert-id').value = id;
      executeLookup(id);
    });
    container.appendChild(chip);
  });
}

// Activity Logging
function logActivity(action, certId, status, details) {
  const tbody = document.getElementById('activity-tbody');
  const emptyRow = document.getElementById('empty-row');
  if (emptyRow) emptyRow.remove();

  const now = new Date().toLocaleTimeString();
  const tr = document.createElement('tr');

  let statusClass = 'text-muted';
  if (status === 'SUCCESS' || status === 'VALID' || status === 'REGISTERED') statusClass = 'text-green font-semibold';
  if (status === 'TAMPERED' || status === 'ERROR') statusClass = 'text-danger font-semibold';
  if (status === 'REVOKED') statusClass = 'text-amber font-semibold';

  tr.innerHTML = `
    <td class="mono text-xs">${now}</td>
    <td><span class="badge-mini" style="background: rgba(255,255,255,0.06); font-family: var(--font-mono);">${escapeHtml(action)}</span></td>
    <td class="mono text-xs font-semibold">${escapeHtml(certId || '-')}</td>
    <td class="${statusClass}">${escapeHtml(status)}</td>
    <td class="text-xs text-muted mono">${escapeHtml(details || '-')}</td>
  `;

  tbody.insertBefore(tr, tbody.firstChild);
}

function initClearLogs() {
  const btn = document.getElementById('btn-clear-logs');
  if (btn) {
    btn.addEventListener('click', () => {
      const tbody = document.getElementById('activity-tbody');
      tbody.innerHTML = `
        <tr class="empty-row" id="empty-row">
          <td colspan="5">No actions recorded in this session yet. Try registering or verifying a certificate above!</td>
        </tr>
      `;
      showToast('Activity log cleared', 'info');
    });
  }
}

// Copy Buttons
function initCopyButtons() {
  document.querySelectorAll('[data-copy]').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-copy');
      const el = document.getElementById(targetId);
      if (el && el.textContent) {
        navigator.clipboard.writeText(el.textContent.trim()).then(() => {
          showToast('Copied to clipboard!', 'info');
        });
      }
    });
  });
}

// Utilities
function setButtonLoading(btn, spinner, isLoading) {
  if (!btn) return;
  btn.disabled = isLoading;
  if (spinner) {
    if (isLoading) spinner.classList.remove('hidden');
    else spinner.classList.add('hidden');
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
