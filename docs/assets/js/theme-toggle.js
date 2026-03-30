---
---
// Theme Toggle for Just the Docs
(function() {
  'use strict';

  // Create toggle button
  function createToggleButton() {
    // Wait for aux-nav to exist
    const auxList = document.querySelector('.aux-nav .aux-nav-list');
    if (!auxList) {
      console.error('aux-nav-list not found!');
      return null;
    }

    const listItem = document.createElement('li');
    listItem.className = 'aux-nav-list-item';
    
    const link = document.createElement('a');
    link.id = 'theme-toggle';
    link.href = '#';
    link.className = 'site-button';
    link.setAttribute('aria-label', 'Toggle dark mode');
    link.setAttribute('title', 'Toggle dark mode');
    link.textContent = 'Theme';
    
    listItem.appendChild(link);
    auxList.insertBefore(listItem, auxList.firstChild);
    
    console.log('Theme toggle created successfully');
    return link;
  }

  // Apply theme
  function applyTheme(theme) {
    const root = document.documentElement;
    const toggleLink = document.getElementById('theme-toggle');
    
    if (theme === 'dark') {
      root.setAttribute('data-theme', 'dark');
      if (toggleLink) {
        toggleLink.setAttribute('data-theme-icon', 'sun');
      }
      // Load dark stylesheet
      loadColorScheme('dark');
    } else {
      root.setAttribute('data-theme', 'light');
      if (toggleLink) {
        toggleLink.setAttribute('data-theme-icon', 'moon');
      }
      // Load light stylesheet
      loadColorScheme('light');
    }
    
    localStorage.setItem('jtd-theme', theme);
  }

  // Load color scheme stylesheet
  function loadColorScheme(scheme) {
    // Remove existing color scheme link
    const existingLink = document.getElementById('jtd-color-scheme');
    if (existingLink) {
      existingLink.remove();
    }

    // Add new color scheme link
    const link = document.createElement('link');
    link.id = 'jtd-color-scheme';
    link.rel = 'stylesheet';
    link.href = '{{ "/assets/css/just-the-docs-" | relative_url }}' + scheme + '.css';
    document.head.appendChild(link);
  }

  // Initialize
  document.addEventListener('DOMContentLoaded', function() {
    const savedTheme = localStorage.getItem('jtd-theme') || 'light';
    const toggleBtn = createToggleButton();
    
    if (!toggleBtn) {
      console.error('Failed to create theme toggle button');
      return;
    }
    
    // Apply saved theme
    applyTheme(savedTheme);
    
    // Toggle on click
    toggleBtn.addEventListener('click', function(e) {
      e.preventDefault();
      const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
      const newTheme = currentTheme === 'light' ? 'dark' : 'light';
      applyTheme(newTheme);
    });
  });
})();
