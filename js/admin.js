/**
 * admin.js
 * Logic for the admin dashboard
 */

document.addEventListener('DOMContentLoaded', () => {
  const session = requireAuth(['admin']);
  if (!session) return;

  document.getElementById('userNameDisplay').textContent = session.name;

  let statusChartInstance = null;

  function renderAdmin() {
    const db = getDb();
    
    // Calculate Stats
    const victims = db.users.filter(u => u.role === 'victim').length;
    const volunteers = db.users.filter(u => u.role === 'volunteer').length;
    
    let pendingCount = 0;
    let emergencyCount = 0;
    let acceptedCount = 0;
    let resolvedCount = 0;

    db.requests.forEach(r => {
      if (r.status === 'pending') pendingCount++;
      if (r.status === 'accepted') acceptedCount++;
      if (r.status === 'resolved') resolvedCount++;
      if (r.isEmergency && r.status !== 'resolved') emergencyCount++;
    });

    // Update DOM Stats
    document.getElementById('statVictims').textContent = victims;
    document.getElementById('statVols').textContent = volunteers;
    document.getElementById('statPending').textContent = pendingCount;
    document.getElementById('statEmergencies').textContent = emergencyCount;

    // Render Chart
    const ctx = document.getElementById('statusChart').getContext('2d');
    
    if (statusChartInstance) {
      statusChartInstance.data.datasets[0].data = [pendingCount, acceptedCount, resolvedCount];
      statusChartInstance.update();
    } else {
      Chart.defaults.color = '#a0aab2';
      statusChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Pending', 'Accepted (Active)', 'Resolved'],
          datasets: [{
            data: [pendingCount, acceptedCount, resolvedCount],
            backgroundColor: [
              'rgba(255, 179, 0, 0.8)', // warning
              'rgba(0, 176, 255, 0.8)', // info
              'rgba(0, 230, 118, 0.8)'  // success
            ],
            borderColor: '#0f1115',
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'right' }
          }
        }
      });
    }

    // Render Requests Table
    const reqBody = document.getElementById('reqTableBody');
    const sortedReqs = [...db.requests].sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 10); // Show last 10
    
    if (sortedReqs.length === 0) {
      reqBody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No requests found</td></tr>';
    } else {
      reqBody.innerHTML = sortedReqs.map(req => {
        let badgeClass = 'badge-pending';
        if (req.status === 'accepted') badgeClass = 'badge-accepted';
        if (req.status === 'resolved') badgeClass = 'badge-resolved';
        if (req.isEmergency) badgeClass = 'badge-sos';

        return `
          <tr>
            <td>
              <strong style="${req.isEmergency ? 'color: var(--danger)' : ''}">
                ${req.isEmergency ? '<i class="fa-solid fa-triangle-exclamation"></i>' : ''} ${req.type}
              </strong>
            </td>
            <td>${req.userName}</td>
            <td><span class="badge ${badgeClass}">${req.status}</span></td>
            <td>
              ${req.status !== 'resolved' ? 
                `<button class="btn btn-secondary" style="padding: 0.25rem 0.5rem; font-size: 0.8rem;" onclick="markResolved('${req.id}')">Resolve</button>` 
                : '<span class="text-muted"><i class="fa-solid fa-check"></i></span>'}
              <button class="btn btn-secondary" style="padding: 0.25rem 0.5rem; font-size: 0.8rem; border-color: var(--danger); color: var(--danger);" onclick="deleteReq('${req.id}')"><i class="fa-solid fa-trash"></i></button>
            </td>
          </tr>
        `;
      }).join('');
    }

    // Render Users Table
    const usrBody = document.getElementById('userTableBody');
    // Don't list admin users for deletion to prevent lockout
    const mainUsers = db.users.filter(u => u.role !== 'admin');
    
    if (mainUsers.length === 0) {
      usrBody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No users found</td></tr>';
    } else {
      usrBody.innerHTML = mainUsers.map(u => `
        <tr>
          <td>${u.name}</td>
          <td style="text-transform: capitalize;">${u.role}</td>
          <td>${u.phone}</td>
          <td>
            <button class="btn btn-secondary" style="padding: 0.25rem 0.5rem; font-size: 0.8rem; border-color: var(--danger); color: var(--danger);" onclick="deleteUser('${u.id}')"><i class="fa-solid fa-trash"></i></button>
          </td>
        </tr>
      `).join('');
    }
  }

  // Global actions
  window.markResolved = function(reqId) {
    if(confirm("Force resolve this request?")) {
      const db = getDb();
      const req = db.requests.find(r => r.id === reqId);
      if(req) req.status = 'resolved';
      saveDb(db);
      renderAdmin();
    }
  };

  window.deleteReq = function(reqId) {
    if(confirm("Delete this request record permanently?")) {
      const db = getDb();
      db.requests = db.requests.filter(r => r.id !== reqId);
      saveDb(db);
      renderAdmin();
    }
  };

  window.deleteUser = function(userId) {
    if(confirm("Delete this user? They will not be able to log in.")) {
      const db = getDb();
      db.users = db.users.filter(u => u.id !== userId);
      // Optional: purge their requests too
      db.requests = db.requests.filter(r => r.userId !== userId && r.acceptedBy !== userId);
      saveDb(db);
      renderAdmin();
    }
  };

  // Broadcast Alert functionality
  document.getElementById('broadcastForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const msg = document.getElementById('alertMsg').value.trim();
    if (msg) {
      const db = getDb();
      // Deactivate older alerts
      db.alerts.forEach(a => a.active = false);
      db.alerts.unshift({
        id: 'alt_' + Date.now(),
        message: msg,
        timestamp: new Date().toISOString(),
        active: true
      });
      saveDb(db);
      alert("Emergency alert broadcasted globally!");
      document.getElementById('alertMsg').value = '';
    }
  });

  document.getElementById('clearAlertBtn').addEventListener('click', () => {
    const db = getDb();
    db.alerts.forEach(a => a.active = false);
    saveDb(db);
    alert("Alerts cleared from the portal landing page.");
  });

  // Handle Logout
  document.getElementById('logoutBtn').addEventListener('click', (e) => {
    e.preventDefault();
    clearSession();
    window.location.href = 'login.html';
  });

  // Initial render
  renderAdmin();

  // Poll
  setInterval(renderAdmin, 5000);
});
