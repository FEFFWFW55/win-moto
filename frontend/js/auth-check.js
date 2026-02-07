// Define logout globally first
window.logout = function () {
    console.log('Logging out...');
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = '/login.html';
};

(function () {
    const token = localStorage.getItem('token');
    let role = localStorage.getItem('role');
    const path = window.location.pathname;

    // Helper to parse JWT
    function parseJwt(token) {
        try {
            return JSON.parse(atob(token.split('.')[1]));
        } catch (e) {
            return null;
        }
    }

    // Auto-fix missing phone and other user data from token
    if (token) {
        let phone = localStorage.getItem('phone');
        // Handle both null and string "undefined"
        if (!phone || phone === 'undefined') {
            const decoded = parseJwt(token);
            if (decoded && decoded.phone) {
                console.log('Restoring phone from token:', decoded.phone);
                localStorage.setItem('phone', decoded.phone);
                localStorage.setItem('name', decoded.name);
                localStorage.setItem('role', decoded.role);
                role = decoded.role; // Update local role variable
            } else {
                console.warn('Invalid token data');
            }
        }
    }

    // List of public pages
    const publicPages = ['/login.html'];
    const isPublicPage = publicPages.some(p => path.endsWith(p));

    // If token was present but invalid/missing data, and it's a protected page, force logout
    // Check if phone is still missing after attempted restore
    const currentPhone = localStorage.getItem('phone');
    if (token && (!currentPhone || currentPhone === 'undefined') && !isPublicPage) {
        console.warn('Missing phone data for a protected page, forcing logout.');
        window.logout();
        return;
    }

    if (!token) {
        if (!isPublicPage) {
            window.location.href = '/login.html';
        }
        return;
    }

    // Role-based protection
    if (path.includes('/user/') && role !== 'user') {
        window.location.href = role === 'admin' ? '/admin/index.html' : '/driver/dashboard.html';
        return;
    } else if (path.includes('/driver/') && role !== 'driver') {
        window.location.href = role === 'admin' ? '/admin/index.html' : '/user/home.html';
        return;
    } else if (path.includes('/admin/') && role !== 'admin') {
        window.location.href = role === 'driver' ? '/driver/dashboard.html' : '/user/home.html';
        return;
    }

    // Redirect from common pages to role-specific dashboard
    if (token && (isPublicPage || path === '/' || path.endsWith('index.html'))) {
        if (role === 'driver') {
            window.location.href = '/driver/dashboard.html';
        } else if (role === 'admin') {
            window.location.href = '/admin/index.html';
        } else {
            window.location.href = '/user/home.html';
        }
    }
})();
