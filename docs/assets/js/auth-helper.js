// Auth Helper for Strike Master
// Simple authentication utilities for use in HTML pages

const auth = {
  // Get current user from localStorage
  getUser: function() {
    const userStr = localStorage.getItem('bowling_user');
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch (e) {
      return null;
    }
  },

  // Get auth token
  getToken: function() {
    return localStorage.getItem('bowling_token');
  },

  // Check if user is logged in
  isLoggedIn: function() {
    return !!(this.getUser() && this.getToken());
  },

  // Check if user is a coach/director
  isCoach: function() {
    const user = this.getUser();
    return user && user.role === 'coach';
  },

  // Require authentication - redirect to login if not authenticated
  requireAuth: function(loginUrl) {
    if (!this.isLoggedIn()) {
      const defaultLoginUrl = loginUrl || '../../pages/auth/teacherLogin.html';
      window.location.href = defaultLoginUrl;
      return false;
    }
    return true;
  },

  // Require coach role - redirect to login if not a coach
  requireCoach: function(loginUrl) {
    if (!this.isCoach()) {
      const defaultLoginUrl = loginUrl || '../../pages/auth/teacherLogin.html';
      window.location.href = defaultLoginUrl;
      return false;
    }
    return true;
  },

  // Logout - clear session and redirect
  logout: function(redirectUrl) {
    localStorage.removeItem('bowling_user');
    localStorage.removeItem('bowling_token');
    const defaultRedirectUrl = redirectUrl || '../../index.html';
    window.location.href = defaultRedirectUrl;
  },

  // Get user display name
  getDisplayName: function() {
    const user = this.getUser();
    if (!user) return 'Guest';
    if (user.first_name && user.last_name) {
      return user.first_name + ' ' + user.last_name;
    }
    return user.email || 'User';
  }
};
