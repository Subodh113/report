// auth.js - handles sign in / sign up with Firebase (compat)
document.addEventListener('DOMContentLoaded', () => {
  const loginBtn = document.getElementById('loginBtn');
  const signupBtn = document.getElementById('signupBtn');
  const emailEl = document.getElementById('email');
  const passEl = document.getElementById('password');
  const loginMsg = document.getElementById('loginMsg');

  if (loginBtn) loginBtn.addEventListener('click', async () => {
    const email = emailEl.value.trim(), pass = passEl.value;
    if (!email || !pass) { loginMsg.textContent = 'Enter email & password'; return; }
    try {
      await auth.signInWithEmailAndPassword(email, pass);
      if (adminEmails.includes(email)) window.location.href = 'kpi.html'; else window.location.href = 'supervisor.html';
    } catch (err) { console.error(err); loginMsg.textContent = err.message || 'Login failed'; }
  });

  if (signupBtn) signupBtn.addEventListener('click', async () => {
    const email = emailEl.value.trim(), pass = passEl.value;
    if (!email || !pass) { loginMsg.textContent = 'Enter email & password to sign up'; return; }
    try {
      const cred = await auth.createUserWithEmailAndPassword(email, pass);
      await db.collection('users').doc(cred.user.uid).set({email, role: 'supervisor', createdAt: firebase.firestore.FieldValue.serverTimestamp()});
      window.location.href = 'supervisor.html';
    } catch (err) { console.error(err); loginMsg.textContent = err.message || 'Signup failed'; }
  });
});
