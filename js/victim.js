/**
 * victim.js
 * Logic for the victim dashboard
 */

document.addEventListener('DOMContentLoaded', () => {
  // Require auth and ensure victim role
  const session = requireAuth(['victim']);
  if (!session) return;

  // Update UI with user info
  document.getElementById('userNameDisplay').textContent = session.name;

  // Setup Map (Leaflet)
  let map, marker;
  // Default center (can be anywhere, let's use a generic point or try to get user location immediately)
  const defaultCoords = [20.5937, 78.9629]; // India center as default
  
  function initMap(lat, lng, zoom = 5) {
    if (map) return; // already initialized
    map = L.map('map').setView([lat, lng], zoom);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    // Map click to set location manually
    map.on('click', function(e) {
      setPin(e.latlng.lat, e.latlng.lng);
    });
  }

  function setPin(lat, lng) {
    if (marker) {
      marker.setLatLng([lat, lng]);
    } else {
      marker = L.marker([lat, lng]).addTo(map);
    }
    map.setView([lat, lng], 15);
    document.getElementById('latInput').value = lat;
    document.getElementById('lngInput').value = lng;
    document.getElementById('locationStatus').innerHTML = `<span style="color: var(--success)"><i class="fa-solid fa-check"></i> Location Set (${lat.toFixed(4)}, ${lng.toFixed(4)})</span>`;
  }

  // Initialize map blank
  initMap(defaultCoords[0], defaultCoords[1]);

  // Handle Get Location Button
  document.getElementById('getLocationBtn').addEventListener('click', () => {
    if (navigator.geolocation) {
      document.getElementById('locationStatus').textContent = "Fetching location...";
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setPin(position.coords.latitude, position.coords.longitude);
        },
        (error) => {
          document.getElementById('locationStatus').innerHTML = `<span style="color: var(--danger)">Error: ${error.message}. Please click on map.</span>`;
        }
      );
    } else {
      alert("Geolocation is not supported by this browser.");
    }
  });

  // Load My Requests
  function loadMyRequests() {
    const db = getDb();
    const myReqs = db.requests.filter(r => r.userId === session.id).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    const listEl = document.getElementById('myRequestsList');
    
    if (myReqs.length === 0) {
      listEl.innerHTML = '<p class="text-muted text-center" style="padding: 2rem 0;">No requests submitted yet.</p>';
      return;
    }

    listEl.innerHTML = myReqs.map(req => {
      let badgeClass = 'badge-pending';
      if (req.status === 'accepted') badgeClass = 'badge-accepted';
      if (req.status === 'resolved') badgeClass = 'badge-resolved';
      if (req.type === 'SOS' || req.isEmergency) badgeClass = 'badge-sos';

      return `
        <div class="request-item">
          <div class="req-header">
            <span class="req-type">
              ${req.type === 'SOS' ? '<i class="fa-solid fa-triangle-exclamation text-danger"></i>' : ''} 
              ${req.type}
            </span>
            <span class="badge ${badgeClass}">${req.status}</span>
          </div>
          <div class="text-muted" style="font-size: 0.9rem;">${req.description}</div>
          <div class="text-muted" style="font-size: 0.8rem; margin-top: 0.5rem;">
            <i class="fa-regular fa-clock"></i> ${new Date(req.timestamp).toLocaleString()}
          </div>
        </div>
      `;
    }).join('');
  }

  loadMyRequests();

  // Handle Form Submission
  document.getElementById('requestForm').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const type = document.getElementById('reqType').value;
    const desc = document.getElementById('reqDesc').value;
    const lat = document.getElementById('latInput').value;
    const lng = document.getElementById('lngInput').value;

    if (!lat || !lng) {
      alert("Please provide your location by clicking 'Get Current Location' or clicking on the map.");
      return;
    }

    const db = getDb();
    const newReq = {
      id: 'req_' + Date.now(),
      userId: session.id,
      userName: session.name,
      type: type,
      description: desc,
      location: { lat: parseFloat(lat), lng: parseFloat(lng) },
      status: 'pending', // pending, accepted, resolved
      timestamp: new Date().toISOString(),
      acceptedBy: null
    };

    db.requests.push(newReq);
    saveDb(db);
    
    // Reset form
    e.target.reset();
    document.getElementById('locationStatus').innerHTML = "Location not set. Click map to pin or use button above.";
    if (marker) {
      map.removeLayer(marker);
      marker = null;
    }
    document.getElementById('latInput').value = '';
    document.getElementById('lngInput').value = '';
    
    loadMyRequests();
    alert("Help request submitted successfully. Volunteers will be notified.");
  });

  // Handle SOS Button
  document.getElementById('sosBtn').addEventListener('click', () => {
    if (confirm("Are you sure you want to trigger an SOS alert? This will immediately notify all emergency responders.")) {
      // Try to get location
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => triggerSOS(pos.coords.latitude, pos.coords.longitude),
          (err) => {
            // Check if map pin exists as fallback
            const lat = document.getElementById('latInput').value;
            const lng = document.getElementById('lngInput').value;
            if (lat && lng) {
              triggerSOS(parseFloat(lat), parseFloat(lng));
            } else {
              alert("Unable to get location for SOS. Please click on the map first to pin your location, then hit SOS.");
            }
          }
        );
      } else {
        alert("Geolocation not supported. Can't send precise SOS.");
      }
    }
  });

  function triggerSOS(lat, lng) {
    const db = getDb();
    const sosReq = {
      id: 'req_sos_' + Date.now(),
      userId: session.id,
      userName: session.name,
      type: 'SOS EMERGENCY',
      description: 'IMMEDIATE LIFE-THREATENING EMERGENCY',
      isEmergency: true,
      location: { lat, lng },
      status: 'pending',
      timestamp: new Date().toISOString(),
      acceptedBy: null
    };

    db.requests.push(sosReq);
    saveDb(db);
    loadMyRequests();
    alert("SOS Sent! Responders have been alerted to your exact coordinates.");
  }

  // Handle Logout
  document.getElementById('logoutBtn').addEventListener('click', (e) => {
    e.preventDefault();
    clearSession();
    window.location.href = 'login.html';
  });

});
