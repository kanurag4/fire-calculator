(function () {
  var KEY = 'kv-theme'
  var SUN = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>'
  var MOON = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>'

  function read() {
    try { var s = localStorage.getItem(KEY); return s ? JSON.parse(s) : 'dark' } catch (e) { return 'dark' }
  }

  function write(t) {
    try { localStorage.setItem(KEY, JSON.stringify(t)) } catch (e) {}
  }

  function apply(t) {
    document.documentElement.classList.toggle('dark', t === 'dark')
    document.querySelectorAll('.theme-toggle').forEach(function (btn) {
      btn.innerHTML = t === 'dark' ? SUN : MOON
      btn.setAttribute('aria-label', t === 'dark' ? 'Switch to light mode' : 'Switch to dark mode')
    })
  }

  var theme = read()
  if (theme !== 'light') { theme = 'dark'; write(theme) }

  // Anti-flash: apply class immediately, before any CSS renders
  document.documentElement.classList.toggle('dark', theme === 'dark')

  window.kvTheme = {
    toggle: function () {
      theme = theme === 'dark' ? 'light' : 'dark'
      write(theme)
      apply(theme)
    }
  }

  // Update icons once DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { apply(theme) })
  } else {
    apply(theme)
  }
})()
