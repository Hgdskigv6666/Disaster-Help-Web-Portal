/**
 * volunteer.js
 * Logic for the volunteer dashboard
 */

document.addEventListener('DOMContentLoaded', () => {
  const session = requireAuth(['volunteer']);
  if (!session) return;

  document.getElementById('userNameDisplay').textContent = session.name;

  let map;
  let markers = {}; // Store markers by requestId

  function initMap() {
    // Default to a central coordinate, try to focus on India if no active requests
    map = L.map('vMap').setView([20.5937, 78.9629], 5);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);
  }

  // Define marker icons
  const iconPending = L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-gold.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
  });

  const iconSOS = L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
  });

  const iconActive = L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
  });

  function renderMapMarkers(requests) {
    // Clear old markers
    for (let id in markers) {
      map.removeLayer(markers[id]);
    }
    markers = {};

    let bounds = [];

    requests.forEach(req => {
      // Only show pending OR tasks accepted by THIS volunteer
      if (req.status === 'pending' || (req.status === 'accepted' && req.acceptedBy === session.id)) {
        let icon = iconPending;
        if (req.type === 'SOS' || req.isEmergency) icon = iconSOS;
        if (req.status === 'accepted') icon = iconActive;

        const m = L.marker([req.location.lat, req.location.lng], { icon }).addTo(map);
        
        m.bindPopup(`
          <strong>${req.type}</strong><br>
          ${req.description}<br>
          <small>By: ${req.userName}</small>
        `);
        
        markers[req.id] = m;
        bounds.push([req.location.lat, req.location.lng]);
      }
    });

    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
    }
  }

  function renderFeeds() {
    const db = getDb();
    const openFeed = document.getElementById('openFeed');
    const activeFeed = document.getElementById('activeTasksFeed');

    const pendingRequests = db.requests.filter(r => r.status === 'pending').sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
    const myTasks = db.requests.filter(r => r.status === 'accepted' && r.acceptedBy === session.id);

    // Render Map Points
    renderMapMarkers([...pendingRequests, ...myTasks]);

    // Open Feed List
    if (pendingRequests.length === 0) {
      openFeed.innerHTML = '<p class="text-muted text-center" style="padding: 1rem 0;">No open requests nearby.</p>';
    } else {
      openFeed.innerHTML = pendingRequests.map(req => `
        <div class="task-card" style="${req.isEmergency ? 'border-color: var(--danger); background: rgba(255,23,68,0.1);' : ''}">
          <div class="task-header">
            <strong style="color: ${req.isEmergency ? 'var(--danger)' : 'white'}">
              ${req.isEmergency ? '<i class="fa-solid fa-triangle-exclamation"></i>' : ''} ${req.type}
            </strong>
            <small class="text-muted">${new Date(req.timestamp).toLocaleTimeString()}</small>
          </div>
          <p style="font-size: 0.9rem; margin-bottom: 0.5rem;">${req.description}</p>
          <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 1rem;">
            <i class="fa-solid fa-user"></i> ${req.userName}
          </div>
          <button class="btn btn-primary w-100" style="padding: 0.5rem;" onclick="acceptTask('${req.id}')">
            Accept Task
          </button>
        </div>
      `).join('');
    }

    // Active Feed List
    if (myTasks.length === 0) {
      activeFeed.innerHTML = '<p class="text-muted text-center" style="padding: 1rem 0;">No active tasks.</p>';
    } else {
      activeFeed.innerHTML = myTasks.map(req => `
        <div class="task-card" style="border-left: 3px solid var(--info);">
          <div class="task-header">
            <strong>${req.type}</strong>
            <span class="badge badge-accepted">Active</span>
          </div>
          <p style="font-size: 0.9rem; margin-bottom: 0.5rem;">${req.description}</p>
          <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 1rem;">
            <i class="fa-solid fa-location-arrow"></i> Navigate to Victim
          </div>
          
          <div style="display: flex; gap: 0.5rem;">
             <a href="https://www.google.com/maps/dir/?api=1&destination=${req.location.lat},${req.location.lng}" target="_blank" class="btn btn-secondary w-100" style="padding: 0.5rem; justify-content: center; text-align: center;">
               <i class="fa-solid fa-map"></i> Google Maps
             </a>
             <button class="btn btn-primary w-100" style="padding: 0.5rem; background: var(--success);" onclick="resolveTask('${req.id}')">
               Mark Resolved
             </button>
          </div>
        </div>
      `).join('');
    }
  }

  // Expose methods to global scope BEFORE first render so onclick attrs work immediately
  window.acceptTask = function(reqId) {
    const db = getDb();
    const req = db.requests.find(r => r.id === reqId);
    if (req && req.status === 'pending') {
      req.status = 'accepted';
      req.acceptedBy = session.id;
      saveDb(db);
      renderFeeds();
      // Visual feedback
      const toast = document.createElement('div');
      toast.textContent = '✅ Task accepted! You are now responsible for this request.';
      toast.style.cssText = 'position:fixed;bottom:1.5rem;right:1.5rem;background:var(--success);color:#000;padding:0.75rem 1.25rem;border-radius:8px;font-weight:600;z-index:9999;animation:fadeIn 0.3s ease;';
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 3000);
    }
  };

  window.resolveTask = function(reqId) {
    const db = getDb();
    const req = db.requests.find(r => r.id === reqId);
    if (req) {
      req.status = 'resolved';
      saveDb(db);
      renderFeeds();
      const toast = document.createElement('div');
      toast.textContent = '🎉 Task marked as resolved!';
      toast.style.cssText = 'position:fixed;bottom:1.5rem;right:1.5rem;background:var(--info);color:#000;padding:0.75rem 1.25rem;border-radius:8px;font-weight:600;z-index:9999;animation:fadeIn 0.3s ease;';
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 3000);
    }
  };

  initMap();
  renderFeeds();

  // Polling simulation for real-time updates (every 5 seconds)
  setInterval(() => {
    // Only re-render if data changed significantly, but for demo we just re-render
    renderFeeds();
  }, 5000);

  // Handle Logout
  document.getElementById('logoutBtn').addEventListener('click', (e) => {
    e.preventDefault();
    clearSession();
    window.location.href = 'login.html';
  });

});
