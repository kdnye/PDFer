(() => {
  const menuRoot = document.querySelector('[data-account-menu]');
  if (!menuRoot) return;

  const toggle = menuRoot.querySelector('[data-account-menu-toggle]');
  const menu = menuRoot.querySelector('[data-account-menu-list]');
  const items = Array.from(menuRoot.querySelectorAll('[data-account-menu-item]'));

  if (!toggle || !menu || items.length === 0) return;

  const setExpanded = (expanded) => {
    toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    menu.hidden = !expanded;
  };

  const focusItem = (nextIndex) => {
    const bounded = ((nextIndex % items.length) + items.length) % items.length;
    items[bounded].focus();
  };

  const openMenu = (focusIndex = 0) => {
    setExpanded(true);
    focusItem(focusIndex);
  };

  const closeMenu = (restoreFocus = true) => {
    setExpanded(false);
    if (restoreFocus) {
      toggle.focus();
    }
  };

  const isOpen = () => toggle.getAttribute('aria-expanded') === 'true';

  toggle.addEventListener('click', () => {
    if (isOpen()) {
      closeMenu(false);
      return;
    }
    openMenu(0);
  });

  toggle.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openMenu(0);
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      openMenu(items.length - 1);
    }
  });

  menu.addEventListener('keydown', (event) => {
    const currentIndex = items.indexOf(document.activeElement);

    if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu(true);
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusItem(currentIndex + 1);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      focusItem(currentIndex - 1);
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      focusItem(0);
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      focusItem(items.length - 1);
      return;
    }

    if (event.key === 'Tab') {
      closeMenu(false);
    }
  });

  document.addEventListener('click', (event) => {
    if (!menuRoot.contains(event.target)) {
      setExpanded(false);
    }
  });
})();
