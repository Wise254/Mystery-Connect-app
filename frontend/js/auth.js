// ============================================
// MYSTERY CONNECT - FRONTEND AUTHENTICATION
// ============================================

// Global variables
let selectedAvatar = '🦊';
let currentRecoveryCode = '';

// ========== MODAL FUNCTIONS ==========

// Show recovery code modal
function showRecoveryModal(code) {
    currentRecoveryCode = code;
    document.getElementById('modalRecoveryCode').textContent = code;
    document.getElementById('recoveryModal').style.display = 'flex';
}

// Close recovery modal
function closeRecoveryModal() {
    document.getElementById('recoveryModal').style.display = 'none';
    showLogin();
    document.getElementById('signupForm').reset();
    document.querySelectorAll('.avatar-option').forEach(opt => opt.classList.remove('selected'));
    document.querySelector('[data-avatar="🦊"]').classList.add('selected');
    selectedAvatar = '🦊';
}

// Copy recovery code to clipboard
function copyModalRecoveryCode() {
    navigator.clipboard.writeText(currentRecoveryCode).then(() => {
        alert('✅ Recovery code copied to clipboard!');
    }).catch(() => {
        const textArea = document.createElement('textarea');
        textArea.value = currentRecoveryCode;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert('✅ Recovery code copied!');
    });
}

// ========== SECURITY FUNCTIONS ==========

// Generate recovery code (client-side fallback)
function generateRecoveryCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 12; i++) {
        if (i === 4 || i === 8) {
            code += '-';
        }
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// Validate security questions
function validateSecurityQuestions() {
    const q1 = document.getElementById('securityQuestion1').value;
    const q2 = document.getElementById('securityQuestion2').value;
    const a1 = document.getElementById('securityAnswer1').value.trim();
    const a2 = document.getElementById('securityAnswer2').value.trim();
    
    if (!q1 || !q2) {
        showError('signupError', 'Please select both security questions');
        return false;
    }
    
    if (q1 === q2) {
        showError('signupError', 'Please select two different security questions');
        return false;
    }
    
    if (a1.length < 2 || a2.length < 2) {
        showError('signupError', 'Security answers must be at least 2 characters');
        return false;
    }
    
    return true;
}

// Calculate age from date of birth
function calculateAge(dateOfBirth) {
    const birthDate = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;
}

// ========== UI FUNCTIONS ==========

// Tab switching
function showLogin() {
    document.getElementById('loginForm').classList.add('active');
    document.getElementById('signupForm').classList.remove('active');
    document.querySelectorAll('.auth-tab')[0].classList.add('active');
    document.querySelectorAll('.auth-tab')[1].classList.remove('active');
}

function showSignup() {
    document.getElementById('signupForm').classList.add('active');
    document.getElementById('loginForm').classList.remove('active');
    document.querySelectorAll('.auth-tab')[0].classList.remove('active');
    document.querySelectorAll('.auth-tab')[1].classList.add('active');
}

// Error display
function showError(elementId, message, type = 'error') {
    const errorElement = document.getElementById(elementId);
    if (!errorElement) return;
    
    errorElement.textContent = message;
    errorElement.style.display = 'block';
    errorElement.style.color = type === 'success' ? '#38a169' : '#e53e3e';
    
    if (type === 'error') {
        errorElement.classList.add('error-shake');
        setTimeout(() => {
            errorElement.classList.remove('error-shake');
        }, 500);
    }
    
    setTimeout(() => {
        errorElement.style.display = 'none';
    }, 5000);
}

// ========== PASSWORD FUNCTIONS ==========

// Password strength checker
function checkPasswordStrength(password) {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    
    const strengthBar = document.getElementById('passwordStrength');
    if (strengthBar) {
        strengthBar.className = 'strength-bar ';
        if (password.length === 0) {
            strengthBar.className = 'strength-bar';
            strengthBar.style.width = '0%';
        } else if (strength <= 2) {
            strengthBar.classList.add('weak');
            strengthBar.style.width = '33%';
        } else if (strength <= 4) {
            strengthBar.classList.add('medium');
            strengthBar.style.width = '66%';
        } else {
            strengthBar.classList.add('strong');
            strengthBar.style.width = '100%';
        }
    }
}

// Password match checker
function checkPasswordMatch() {
    const password = document.getElementById('signupPassword')?.value || '';
    const confirmPassword = document.getElementById('signupConfirmPassword')?.value || '';
    const matchIndicator = document.getElementById('passwordMatch');
    const signupBtn = document.getElementById('signupBtn');
    
    if (!matchIndicator || !signupBtn) return;
    
    if (confirmPassword.length === 0) {
        matchIndicator.className = 'match-indicator invalid';
        matchIndicator.innerHTML = '<i class="fas fa-times"></i> Confirm your password';
        signupBtn.disabled = true;
        return;
    }
    
    if (password === confirmPassword && password.length >= 8) {
        matchIndicator.className = 'match-indicator valid';
        matchIndicator.innerHTML = '<i class="fas fa-check"></i> Passwords match!';
        signupBtn.disabled = false;
    } else {
        matchIndicator.className = 'match-indicator invalid';
        matchIndicator.innerHTML = '<i class="fas fa-times"></i> Passwords don\'t match';
        signupBtn.disabled = true;
    }
}

// ========== VALIDATION FUNCTIONS ==========

// Validate signup form
function validateSignup() {
    const username = document.getElementById('signupUsername')?.value || '';
    const dateOfBirth = document.getElementById('signupDateOfBirth')?.value;
    const ageCheck = document.getElementById('signupAgeCheck')?.checked || false;
    
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        showError('signupError', 'Username can only contain letters, numbers, and underscores');
        return false;
    }
    
    if (username.length < 3 || username.length > 20) {
        showError('signupError', 'Username must be 3-20 characters');
        return false;
    }
    
    if (!dateOfBirth) {
        showError('signupError', 'Please enter your date of birth');
        return false;
    }
    
    const age = calculateAge(dateOfBirth);
    if (age < 18) {
        showError('signupError', `You must be at least 18 years old (you are ${age})`);
        return false;
    }
    
    if (age > 120) {
        showError('signupError', 'Please enter a valid date of birth');
        return false;
    }
    
    if (!ageCheck) {
        showError('signupError', 'You must confirm you are 18+');
        return false;
    }
    
    if (!validateSecurityQuestions()) {
        return false;
    }
    
    return true;
}

// ========== API CALLS ==========

// Login
async function login(event) {
    event.preventDefault();
    
    const username = document.getElementById('loginUsername')?.value || '';
    const password = document.getElementById('loginPassword')?.value || '';
    const ageCheck = document.getElementById('loginAge')?.checked || false;
    
    if (!ageCheck) {
        showError('loginError', 'You must confirm you are 18+');
        return;
    }
    
    try {
        const response = await fetch('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            localStorage.setItem('mysteryToken', data.token);
            localStorage.setItem('mysteryUser', JSON.stringify(data.user));
            localStorage.setItem('profileCompleted', data.profileCompleted ? 'true' : 'false');
            
            if (data.profileCompleted) {
                window.location.href = 'dashboard.html';
            } else {
                window.location.href = 'complete-profile.html';
            }
        } else {
            showError('loginError', data.message || 'Login failed');
        }
    } catch (error) {
        showError('loginError', 'Network error. Is the server running?');
        console.error('Login error:', error);
    }
}

// Signup
async function signup(event) {
    event.preventDefault();
    
    if (!validateSignup()) return;
    
    const username = document.getElementById('signupUsername')?.value || '';
    const email = document.getElementById('signupEmail')?.value || '';
    const password = document.getElementById('signupPassword')?.value || '';
    const dateOfBirth = document.getElementById('signupDateOfBirth')?.value;
    const avatar = selectedAvatar;
    
    const securityQuestions = [
        {
            question: document.getElementById('securityQuestion1')?.value || '',
            answer: document.getElementById('securityAnswer1')?.value.trim() || ''
        },
        {
            question: document.getElementById('securityQuestion2')?.value || '',
            answer: document.getElementById('securityAnswer2')?.value.trim() || ''
        }
    ];
    
    const userData = { 
        username, 
        password, 
        dateOfBirth, 
        avatar,
        securityQuestions
    };
    
    if (email && email.trim() !== '') {
        userData.email = email.trim();
    }
    
    try {
        const response = await fetch('http://localhost:3000/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Show recovery code modal
            if (typeof showRecoveryModal === 'function') {
                showRecoveryModal(data.recoveryCode);
            } else {
                alert(`Your recovery code: ${data.recoveryCode}\n\nPlease save this code!`);
            }
            
            // Clear form
            document.getElementById('signupForm')?.reset();
            document.querySelectorAll('.avatar-option').forEach(opt => opt.classList.remove('selected'));
            document.querySelector('[data-avatar="🦊"]')?.classList.add('selected');
            selectedAvatar = '🦊';
            
            // Reset password strength
            const strengthBar = document.getElementById('passwordStrength');
            if (strengthBar) strengthBar.style.width = '0%';
            
            const matchIndicator = document.getElementById('passwordMatch');
            if (matchIndicator) {
                matchIndicator.className = 'match-indicator invalid';
                matchIndicator.innerHTML = '<i class="fas fa-times"></i> Passwords don\'t match';
            }
            
            const signupBtn = document.getElementById('signupBtn');
            if (signupBtn) signupBtn.disabled = true;
            
        } else {
            showError('signupError', data.message || 'Registration failed');
        }
        
    } catch (error) {
        showError('signupError', 'Network error. Is the server running?');
        console.error('Signup error:', error);
    }
}

// ========== FORGOT PASSWORD FUNCTIONS ==========

function showForgotPassword() {
    const modal = document.getElementById('forgotPasswordModal');
    if (modal) {
        modal.style.display = 'flex';
        document.getElementById('forgotPasswordStep1').style.display = 'block';
        document.getElementById('forgotPasswordStep2').style.display = 'none';
        document.getElementById('forgotUsername').value = '';
        document.getElementById('forgotUsername').focus();
    }
}

function hideForgotPassword() {
    const modal = document.getElementById('forgotPasswordModal');
    if (modal) {
        modal.style.display = 'none';
        document.getElementById('forgotUsername').value = '';
        document.getElementById('securityAnswer').value = '';
        document.getElementById('recoveryCodeInput').value = '';
        document.getElementById('newPassword').value = '';
    }
}

async function verifyUser() {
    const username = document.getElementById('forgotUsername')?.value.trim() || '';
    
    if (!username) {
        alert('Please enter your username');
        return;
    }
    
    try {
        const verifyBtn = document.querySelector('#forgotPasswordStep1 button');
        if (verifyBtn) {
            verifyBtn.textContent = 'Verifying...';
            verifyBtn.disabled = true;
        }
        
        const response = await fetch('http://localhost:3000/api/auth/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        });
        
        const data = await response.json();
        
        if (data.success) {
            if (data.hasSecurityQuestion) {
                document.getElementById('securityQuestionText').textContent = data.securityQuestion;
                document.getElementById('securityAnswer').style.display = 'block';
            } else {
                document.getElementById('securityQuestionText').textContent = 'No security question set. Use your recovery code:';
                document.getElementById('securityAnswer').style.display = 'none';
            }
            
            document.getElementById('forgotPasswordStep1').style.display = 'none';
            document.getElementById('forgotPasswordStep2').style.display = 'block';
        } else {
            alert(data.message || 'User not found');
        }
    } catch (error) {
        alert('Error verifying user. Is the server running?');
        console.error('Verify user error:', error);
    } finally {
        const verifyBtn = document.querySelector('#forgotPasswordStep1 button');
        if (verifyBtn) {
            verifyBtn.textContent = 'Verify Account';
            verifyBtn.disabled = false;
        }
    }
}

async function resetPassword() {
    const username = document.getElementById('forgotUsername')?.value.trim() || '';
    const answer = document.getElementById('securityAnswer')?.value.trim() || '';
    const recoveryCode = document.getElementById('recoveryCodeInput')?.value.trim().toUpperCase() || '';
    const newPassword = document.getElementById('newPassword')?.value || '';
    
    if (!newPassword || newPassword.length < 8) {
        alert('New password must be at least 8 characters');
        return;
    }
    
    if (!answer && !recoveryCode) {
        alert('Please provide either security answer or recovery code');
        return;
    }
    
    try {
        const response = await fetch('http://localhost:3000/api/auth/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username,
                securityAnswer: answer || undefined,
                recoveryCode: recoveryCode || undefined,
                newPassword
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('✅ Password reset successful! Please login with your new password.');
            hideForgotPassword();
            showLogin();
            document.getElementById('loginUsername').value = username;
            document.getElementById('loginPassword').focus();
        } else {
            alert(data.message || 'Password reset failed. Check your answer or recovery code.');
        }
    } catch (error) {
        alert('Error resetting password');
        console.error('Reset password error:', error);
    }
}

// ========== INITIALIZATION ==========

document.addEventListener('DOMContentLoaded', function() {
    // Avatar selection listeners
    document.querySelectorAll('.avatar-option').forEach(option => {
        option.addEventListener('click', function() {
            document.querySelectorAll('.avatar-option').forEach(opt => opt.classList.remove('selected'));
            this.classList.add('selected');
            selectedAvatar = this.dataset.avatar;
        });
    });
    
    // Password strength listener
    const passwordInput = document.getElementById('signupPassword');
    if (passwordInput) {
        passwordInput.addEventListener('input', function() {
            checkPasswordStrength(this.value);
            checkPasswordMatch();
        });
    }
    
    // Password match listener
    const confirmInput = document.getElementById('signupConfirmPassword');
    if (confirmInput) {
        confirmInput.addEventListener('input', checkPasswordMatch);
    }
    
    // Set max date for date picker (18 years ago)
    const dateInput = document.getElementById('signupDateOfBirth');
    if (dateInput) {
        const today = new Date();
        const maxDate = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
        dateInput.max = maxDate.toISOString().split('T')[0];
    }
    
    // Check if already logged in
    const token = localStorage.getItem('mysteryToken');
    if (token) {
        const profileCompleted = localStorage.getItem('profileCompleted');
        
        if (profileCompleted === 'true') {
            window.location.href = 'dashboard.html';
        } else if (profileCompleted === 'false') {
            window.location.href = 'complete-profile.html';
        } else {
            // Verify with server
            fetch('http://localhost:3000/api/auth/verify', {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    localStorage.setItem('profileCompleted', data.user?.profileCompleted ? 'true' : 'false');
                    
                    if (data.user?.profileCompleted) {
                        window.location.href = 'dashboard.html';
                    } else {
                        window.location.href = 'complete-profile.html';
                    }
                } else {
                    localStorage.removeItem('mysteryToken');
                    localStorage.removeItem('mysteryUser');
                    localStorage.removeItem('profileCompleted');
                }
            })
            .catch(() => {
                console.log('Server might be down, staying on auth page');
            });
        }
    }
});

// Make functions globally available
window.showLogin = showLogin;
window.showSignup = showSignup;
window.login = login;
window.signup = signup;
window.showForgotPassword = showForgotPassword;
window.hideForgotPassword = hideForgotPassword;
window.verifyUser = verifyUser;
window.resetPassword = resetPassword;
window.copyModalRecoveryCode = copyModalRecoveryCode;
window.closeRecoveryModal = closeRecoveryModal;