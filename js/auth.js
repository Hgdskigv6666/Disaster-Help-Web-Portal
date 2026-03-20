/**
 * auth.js
 * Handles UI interactions for login and registration
 */

document.addEventListener('DOMContentLoaded', () => {
  // Common UI elements
  const roleTabs = document.querySelectorAll('.role-tab');
  const roleInput = document.getElementById('roleInput');
  const alertBox = document.getElementById('authAlert');
  const authForm = document.getElementById('authForm');

  // Handle Role selection tabs
  if (roleTabs.length > 0) {
    roleTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        // Update active class
        roleTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        // Update hidden input
        const selectedRole = tab.getAttribute('data-role');
        if (roleInput) roleInput.value = selectedRole;

        // Specific UI changes for Admin login
        if (window.location.pathname.includes('login.html')) {
          const phoneLabel = document.getElementById('phoneLabel');
          const phoneInput = document.getElementById('phoneInput');
          if (selectedRole === 'admin') {
            phoneLabel.textContent = 'Username';
            phoneInput.type = 'text';
            phoneInput.placeholder = 'e.g. admin';
          } else {
            phoneLabel.textContent = 'Phone Number';
            phoneInput.type = 'tel';
            phoneInput.placeholder = 'e.g. 9876543210';
          }
        }
      });
    });
  }

  function showAlert(msg, type = 'error') {
    if (!alertBox) return;
    alertBox.textContent = msg;
    alertBox.className = `alert-msg ${type}`;
    // Clear after 5 seconds
    setTimeout(() => {
      alertBox.className = 'alert-msg';
    }, 5000);
  }

  // Handle Login logic
  if (window.location.pathname.includes('login.html') && authForm) {
    authForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const role = roleInput.value;
      const phoneOrUser = document.getElementById('phoneInput').value.trim();
      const password = document.getElementById('passwordInput').value;

      if (!phoneOrUser || !password) {
        return showAlert('Please fill all fields');
      }

      const user = findUser(phoneOrUser, password, role);
      
      if (user) {
        setSession(user);
        // Redirect based on role
        if (role === 'admin') window.location.href = 'admin-dashboard.html';
        else if (role === 'volunteer') window.location.href = 'volunteer-dashboard.html';
        else window.location.href = 'victim-dashboard.html';
      } else {
        showAlert('Invalid credentials for selected role');
      }
    });
  }

  // Handle Registration logic
  if (window.location.pathname.includes('register.html') && authForm) {
    authForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const role = roleInput.value;
      const name = document.getElementById('nameInput').value.trim();
      const phone = document.getElementById('phoneInput').value.trim();
      const password = document.getElementById('passwordInput').value;
      const confirmPassword = document.getElementById('confirmPasswordInput').value;

      if (password !== confirmPassword) {
        return showAlert('Passwords do not match');
      }

      try {
        const newUser = createUser({
          name,
          phone,
          password,
          role
        });

        // Auto login after register
        setSession(newUser);
        
        if (role === 'volunteer') window.location.href = 'volunteer-dashboard.html';
        else window.location.href = 'victim-dashboard.html';

      } catch (err) {
        showAlert(err.message);
      }
    });
  }

  // Handle Logout (if logout button exists on page)
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      clearSession();
      window.location.href = 'login.html';
    });
  }

  // Auto redirect / session awareness on auth pages
  const session = getSession();
  const path = window.location.pathname;
  const urlParams = new URLSearchParams(window.location.search);
  const requestedRole = urlParams.get('role');

  if (session && (path.includes('login.html') || path.includes('register.html'))) {
    if (requestedRole && session.role !== requestedRole) {
      // User is logged in as a DIFFERENT role than what was requested
      // Show a friendly banner instead of silently logging them out
      const banner = document.createElement('div');
      const dashHref = session.role === 'admin'     ? 'admin-dashboard.html'
                     : session.role === 'volunteer' ? 'volunteer-dashboard.html'
                     : 'victim-dashboard.html';
      const roleLabel = session.role.charAt(0).toUpperCase() + session.role.slice(1);
      banner.innerHTML = `
        <div style="background:rgba(0,176,255,0.12);border:1px solid rgba(0,176,255,0.4);
                    border-radius:10px;padding:1rem 1.25rem;margin-bottom:1.5rem;
                    font-size:0.9rem;text-align:center;line-height:1.8;">
          <i class="fa-solid fa-circle-info" style="color:var(--info)"></i>
          You are already logged in as <strong>${session.name}</strong> (${roleLabel}).<br>
          <a href="${dashHref}" style="color:var(--info);font-weight:600;">Go to my Dashboard</a>
          &nbsp;|&nbsp;
          <a href="#" id="switchRoleBtn" style="color:var(--warning);font-weight:600;">Logout &amp; Switch Role</a>
        </div>`;
      const alertBox = document.getElementById('authAlert');
      if (alertBox) alertBox.parentNode.insertBefore(banner, alertBox);

      document.getElementById('switchRoleBtn').addEventListener('click', (e) => {
        e.preventDefault();
        clearSession();
        window.location.reload(); // reload same login page, now without session
      });
    } else if (!requestedRole) {
      // No specific role requested → send to their own dashboard
      if (session.role === 'admin')     window.location.href = 'admin-dashboard.html';
      else if (session.role === 'volunteer') window.location.href = 'volunteer-dashboard.html';
      else window.location.href = 'victim-dashboard.html';
    }
    // If requestedRole === session.role, send directly to dashboard
    else {
      if (session.role === 'admin')          window.location.href = 'admin-dashboard.html';
      else if (session.role === 'volunteer') window.location.href = 'volunteer-dashboard.html';
      else                                   window.location.href = 'victim-dashboard.html';
    }
  }

});
