---
---
// Generate right-side table of contents with auto-follow and collapsible property sections
(function() {
  'use strict';
  
  function generateRightTOC() {
    // Only generate on pages with main content
    const mainContent = document.querySelector('.main-content');
    if (!mainContent) return;
    
    // Find all h2 headings (skip h1 as it's the page title)
    const h2Headings = mainContent.querySelectorAll('h2');
    if (h2Headings.length === 0) return;
    
    // Create TOC container
    const tocContainer = document.createElement('div');
    tocContainer.className = 'right-toc';
    
    const tocTitle = document.createElement('div');
    tocTitle.className = 'right-toc-title';
    tocTitle.textContent = 'On this page';
    tocContainer.appendChild(tocTitle);
    
    // Build TOC structure
    const tocList = document.createElement('ul');
    const allTargets = []; // Track all targets for scroll spy
    
    h2Headings.forEach((h2, index) => {
      // Ensure heading has an ID
      if (!h2.id) {
        h2.id = 'heading-' + index;
      }
      
      const h2Li = document.createElement('li');
      const h2Link = document.createElement('a');
      h2Link.href = '#' + h2.id;
      h2Link.textContent = h2.textContent.replace(/^#\s*/, '');
      h2Link.dataset.target = h2.id;
      h2Li.appendChild(h2Link);
      tocList.appendChild(h2Li);
      
      allTargets.push({ id: h2.id, element: h2, link: h2Link, level: 'h2' });
      
      // Look for H3 headings following this H2 (before the next H2)
      const h3List = buildH3List(h2);
      if (h3List && h3List.children.length > 0) {
        h2Li.appendChild(h3List);
        // Collect all H3 targets
        h3List.querySelectorAll('a').forEach(link => {
          const targetId = link.dataset.target;
          const targetEl = document.getElementById(targetId);
          if (targetEl) {
            allTargets.push({ 
              id: targetId, 
              element: targetEl, 
              link: link,
              level: 'h3'
            });
          }
        });
      }
      
      // Look for property groups in tables following this H2
      const groupList = buildPropertyGroups(h2);
      if (groupList && groupList.children.length > 0) {
        h2Li.appendChild(groupList);
        // Collect all targets from groups
        groupList.querySelectorAll('a').forEach(link => {
          const targetId = link.dataset.target;
          const targetEl = document.getElementById(targetId);
          if (targetEl) {
            allTargets.push({ 
              id: targetId, 
              element: targetEl, 
              link: link,
              level: link.classList.contains('toc-group') ? 'group' : 'property'
            });
          }
        });
      }
    });
    
    tocContainer.appendChild(tocList);
    document.body.appendChild(tocContainer);
    
    // Add scroll spy functionality
    setupScrollSpy(allTargets, tocContainer);
  }
  
  function buildH3List(h2) {
    // Find all H3 headings between this H2 and the next H2
    const h3List = document.createElement('ul');
    let nextEl = h2.nextElementSibling;
    let h3Index = 0;
    
    while (nextEl && nextEl.tagName !== 'H2') {
      if (nextEl.tagName === 'H3') {
        // Ensure heading has an ID
        if (!nextEl.id) {
          nextEl.id = h2.id + '-h3-' + h3Index;
          h3Index++;
        }
        
        const h3Li = document.createElement('li');
        const h3Link = document.createElement('a');
        h3Link.href = '#' + nextEl.id;
        h3Link.textContent = nextEl.textContent.replace(/^#\s*/, '');
        h3Link.dataset.target = nextEl.id;
        h3Li.appendChild(h3Link);
        h3List.appendChild(h3Li);
      } else if (nextEl.tagName === 'TABLE' || (nextEl.classList && nextEl.classList.contains('table-wrapper'))) {
        // Handle both direct tables and wrapped tables
        const table = nextEl.tagName === 'TABLE' ? nextEl : nextEl.querySelector('table');
        if (table) {
          console.log('Found table after H2:', h2.textContent);
          
          // Also look for H3 headings inside table cells
          const tableH3s = table.querySelectorAll('h3');
          console.log('Found', tableH3s.length, 'H3 elements in table');
          tableH3s.forEach((h3) => {
            // Find the parent TR element to use as ID if H3 doesn't have one
            const parentTr = h3.closest('tr');
            const targetId = h3.id || (parentTr && parentTr.id) || (h2.id + '-h3-' + h3Index);
            
            if (!h3.id && parentTr && parentTr.id) {
              // Use parent TR's ID as target
            } else if (!h3.id) {
              h3.id = targetId;
            }
            
            h3Index++;
            
            const h3Li = document.createElement('li');
            const h3Link = document.createElement('a');
            h3Link.href = '#' + targetId;
            h3Link.textContent = h3.textContent.replace(/^#\s*/, '');
            h3Link.dataset.target = targetId;
            h3Li.appendChild(h3Link);
            h3List.appendChild(h3Li);
          });
          
          // Also look for span[id] elements in table cells (for properties without groups)
          // Only if this table doesn't have group headers
          const hasGroupHeaders = table.querySelectorAll('th.af-group-header').length > 0;
          console.log('Table has group headers:', hasGroupHeaders);
          if (!hasGroupHeaders) {
            const propertySpans = table.querySelectorAll('tbody tr td:first-child span[id]');
            console.log('Found', propertySpans.length, 'span[id] elements in table');
            propertySpans.forEach((span) => {
              const h3Li = document.createElement('li');
              const h3Link = document.createElement('a');
              h3Link.href = '#' + span.id;
              h3Link.textContent = span.textContent.replace(/^#\s*/, '');
              h3Link.dataset.target = span.id;
              h3Li.appendChild(h3Link);
              h3List.appendChild(h3Li);
            });
          }
        }
      }
      nextEl = nextEl.nextElementSibling;
    }
    
    return h3List.children.length > 0 ? h3List : null;
  }
  
  function buildPropertyGroups(h2) {
    // Find the next table after this H2 (may be wrapped in div.table-wrapper)
    let nextEl = h2.nextElementSibling;
    let table = null;
    
    // Search through siblings for a table (direct or wrapped)
    while (nextEl && !table && nextEl.tagName !== 'H2') {
      if (nextEl.tagName === 'TABLE') {
        table = nextEl;
      } else if (nextEl.classList && nextEl.classList.contains('table-wrapper')) {
        // Table is wrapped in a div
        table = nextEl.querySelector('table');
      }
      nextEl = nextEl.nextElementSibling;
    }
    
    if (!table) {
      console.log('No table found after H2:', h2.textContent);
      return null;
    }
    
    const groupHeaders = table.querySelectorAll('th.af-group-header');
    
    console.log('Found', groupHeaders.length, 'group headers for', h2.textContent);
    
    if (groupHeaders.length === 0) {
      return null;
    }
    
    const groupList = document.createElement('ul');
    groupList.className = 'toc-groups';
    
    groupHeaders.forEach(groupHeader => {
      if (!groupHeader.id) return;
      
      const groupLi = document.createElement('li');
      groupLi.className = 'toc-group-item';
      
      // Group header link (clickable and collapsible)
      const groupLink = document.createElement('a');
      groupLink.href = '#' + groupHeader.id;
      groupLink.textContent = groupHeader.textContent;
      groupLink.dataset.target = groupHeader.id;
      groupLink.className = 'toc-group';
      
      // Collapse toggle
      const toggle = document.createElement('span');
      toggle.className = 'toc-toggle';
      groupLink.insertBefore(toggle, groupLink.firstChild);
      
      groupLi.appendChild(groupLink);
      
      // Find properties in this group
      const propertyList = buildPropertiesForGroup(groupHeader);
      if (propertyList && propertyList.children.length > 0) {
        groupLi.appendChild(propertyList);
        
        // Add toggle functionality
        groupLink.addEventListener('click', function(e) {
          // Allow navigation but also toggle
          groupLi.classList.toggle('collapsed');
        });
        
        // Start collapsed
        groupLi.classList.add('collapsed');
      }
      
      groupList.appendChild(groupLi);
    });
    
    return groupList;
  }
  
  function buildPropertiesForGroup(groupHeader) {
    // Find all property rows between this group header and the next group header
    const propertyList = document.createElement('ul');
    propertyList.className = 'toc-properties';
    
    let currentRow = groupHeader.closest('tr').nextElementSibling;
    
    while (currentRow) {
      // Stop if we hit another group header
      if (currentRow.querySelector('th.af-group-header')) {
        break;
      }
      
      // Look for property spans with IDs in the first td
      const firstTd = currentRow.querySelector('td:first-child');
      if (firstTd) {
        const propertySpan = firstTd.querySelector('span[id]');
        if (propertySpan && propertySpan.id) {
          const propertyLi = document.createElement('li');
          const propertyLink = document.createElement('a');
          propertyLink.href = '#' + propertySpan.id;
          propertyLink.textContent = propertySpan.textContent;
          propertyLink.dataset.target = propertySpan.id;
          propertyLink.className = 'toc-property';
          propertyLi.appendChild(propertyLink);
          propertyList.appendChild(propertyLi);
        }
      }
      
      currentRow = currentRow.nextElementSibling;
    }
    
    return propertyList.children.length > 0 ? propertyList : null;
  }
  
  function setupScrollSpy(targets, tocContainer) {
    const links = tocContainer.querySelectorAll('a');
    
    // Throttle scroll event
    let ticking = false;
    
    function updateActiveLink() {
      const viewportTop = 150; // Offset from top of viewport for "active" threshold
      
      let currentActive = null;
      let currentActiveLevel = null;
      
      // Find the first element that's currently in view or above viewport
      for (let i = 0; i < targets.length; i++) {
        const target = targets[i];
        const element = target.element;
        
        // Get element's position relative to viewport
        let rect;
        if (element.tagName === 'TH' || element.tagName === 'SPAN') {
          const row = element.closest('tr');
          rect = row ? row.getBoundingClientRect() : element.getBoundingClientRect();
        } else {
          rect = element.getBoundingClientRect();
        }
        
        // If this element is above or near the top of the viewport, it's the active one
        if (rect.top <= viewportTop) {
          currentActive = target.id;
          currentActiveLevel = target.level;
          // Continue to find the LAST element that meets this criteria
          // (the one closest to but still above the threshold)
        } else {
          // We've passed the threshold, use the previous one
          break;
        }
      }
      
      // Update active states
      let activeGroupItem = null;
      
      links.forEach(link => {
        const isActive = link.dataset.target === currentActive;
        
        if (isActive) {
          link.classList.add('active');
          
          // If it's a property or group, expand its parent group
          if (link.classList.contains('toc-property') || link.classList.contains('toc-group')) {
            const groupItem = link.closest('.toc-group-item');
            if (groupItem) {
              activeGroupItem = groupItem;
              groupItem.classList.remove('collapsed');
            }
          }
          
          // Scroll the TOC to keep active link in view
          const linkTop = link.offsetTop;
          const containerScrollTop = tocContainer.scrollTop;
          const containerHeight = tocContainer.clientHeight;
          
          // Check if link is outside visible area
          if (linkTop < containerScrollTop || linkTop > containerScrollTop + containerHeight - 50) {
            // Scroll to center the active link
            tocContainer.scrollTo({
              top: linkTop - containerHeight / 2,
              behavior: 'smooth'
            });
          }
        } else {
          link.classList.remove('active');
        }
      });
      
      // Collapse all other groups that aren't active
      tocContainer.querySelectorAll('.toc-group-item').forEach(groupItem => {
        if (groupItem !== activeGroupItem) {
          groupItem.classList.add('collapsed');
        }
      });
      
      ticking = false;
    }
    
    window.addEventListener('scroll', function() {
      if (!ticking) {
        window.requestAnimationFrame(updateActiveLink);
        ticking = true;
      }
    });
    
    // Smooth scroll on click
    links.forEach(link => {
      link.addEventListener('click', function(e) {
        e.preventDefault();
        const targetId = this.dataset.target;
        const targetElement = document.getElementById(targetId);
        if (targetElement) {
          // For table elements, scroll to the row
          let scrollTarget = targetElement;
          if (targetElement.tagName === 'TH' || targetElement.tagName === 'SPAN') {
            const row = targetElement.closest('tr');
            if (row) scrollTarget = row;
          }
          
          scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
          
          // Highlight the row temporarily
          if (targetElement.classList && targetElement.classList.contains('af-group-header')) {
            const row = targetElement.closest('tr');
            if (row) {
              row.classList.add('highlight-row');
              setTimeout(() => row.classList.remove('highlight-row'), 2000);
            }
          }
          
          // Update URL without jumping
          history.pushState(null, null, '#' + targetId);
        }
      });
    });
    
    // Initial update
    updateActiveLink();
  }
  
  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', generateRightTOC);
  } else {
    generateRightTOC();
  }
})();

