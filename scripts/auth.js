// scripts/auth.js
document.addEventListener('DOMContentLoaded', () => {
  const loginBtn = document.getElementById('loginBtn');
  const signupBtn = document.getElementById('signupBtn');
  const emailEl = document.getElementById('email');
  const passEl = document.getElementById('password');
  const loginMsg = document.getElementById('loginMsg');

  // ---------------- Department Mapping ----------------
  const emailDepartmentMap = {
    "hk@jll.com": "H&K",
    "me@jll.com": "M&E",
    "security@jll.com": "Security"
  };

  // ---------------- Login ----------------
  if (loginBtn) loginBtn.addEventListener('click', async () => {
    const email = emailEl.value.trim().toLowerCase();
    const pass = passEl.value;

    if (!email || !pass) {
      loginMsg.textContent = 'Enter email & password';
      return;
    }

    try {
      const userCred = await auth.signInWithEmailAndPassword(email, pass);
      const department = emailDepartmentMap[email];

      if (department) {
        // Supervisor login
        localStorage.setItem('role', 'supervisor');
        localStorage.setItem('supervisorDept', department);

        // Ask for supervisor name if not stored yet
        let supervisorName = localStorage.getItem('supervisorName');
        if (!supervisorName) {
          supervisorName = prompt("Enter your name (Supervisor):") || "Supervisor";
          localStorage.setItem('supervisorName', supervisorName);
        }

        console.log(`Supervisor: ${supervisorName}, Dept: ${department}`);
        window.location.href = 'supervisor-dashboard.html';
      } else {
        // Treat as admin
        localStorage.setItem('role', 'admin');
        localStorage.setItem('supervisorName', 'Admin');
        console.log("Admin login:", email);
        window.location.href = 'kpi.html';
      }
    } catch (err) {
      console.error(err);
      loginMsg.textContent = err.message || 'Login failed';
    }
  });

  // ---------------- Signup ----------------
  if (signupBtn) signupBtn.addEventListener('click', async () => {
    const email = emailEl.value.trim().toLowerCase();
    const pass = passEl.value;

    if (!email || !pass) {
      loginMsg.textContent = 'Enter email & password to sign up';
      return;
    }

    try {
      const cred = await auth.createUserWithEmailAndPassword(email, pass);

      const department = emailDepartmentMap[email] || "General";
      await db.collection('users').doc(cred.user.uid).set({
        email,
        role: department ? 'supervisor' : 'admin',
        department,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      localStorage.setItem('role', department ? 'supervisor' : 'admin');
      localStorage.setItem('supervisorDept', department);

      // Ask for supervisor name
      let supervisorName = prompt("Enter your name (Supervisor):") || "Supervisor";
      localStorage.setItem('supervisorName', supervisorName);

      console.log("Signup successful:", email, "Department:", department);
      window.location.href = department ? 'supervisor-dashboard.html' : 'admin.html';
    } catch (err) {
      console.error(err);
      loginMsg.textContent = err.message || 'Signup failed';
    }
  });

  // ---------------- Date Autofill (for dashboards) ----------------
  // If any date input exists, set today as default
  const dateInputs = document.querySelectorAll('input[type="date"]');
  if (dateInputs.length) {
    const today = new Date().toISOString().split('T')[0];
    dateInputs.forEach(input => {
      if (!input.value) input.value = today;
    });
  }
});