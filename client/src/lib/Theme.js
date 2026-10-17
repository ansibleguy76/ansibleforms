import { useAppStore } from '@/stores/app';

var Theme = {
  load() {
    const store = useAppStore();
    // the user picked Follow the browser : light or dark as the browser is, and as it changes
    if (Theme.isFollowingBrowser()) {
      Theme.followBrowser();
      return store.theme;
    }
    store.theme = localStorage.getItem('theme') || Theme.getMediaPreference();
    Theme.set(store.theme);
    if (store.theme === 'color') {
      const saved = localStorage.getItem('themeColor');
      if (saved) Theme.applyColor(saved);
    }
    return store.theme;
  },
  // Applies the server/env default, unless the user picked a theme themselves.
  // The "theme" key cannot be that marker: Theme.load() writes it on every load
  // (so a refresh keeps the rendered theme), which is why an explicit choice gets
  // its own key - the same split as the af_language cookie for the language.
  applyServerDefault(theme, color) {
    if (Theme.isUserChoice()) return;
    // none set, or Follow the browser : light or dark as the browser is, and as it changes
    if (!theme || theme === 'system') {
      Theme.followBrowser();
      return;
    }
    Theme.stopFollowingBrowser();
    Theme.set(theme);
    if (theme === 'color' && color) {
      Theme.applyColor(color);
    } else {
      Theme.clearColor();
    }
  },
  isUserChoice() {
    return localStorage.getItem('themeChosen') === '1';
  },
  // the user picked this theme: remember the choice so the server default no
  // longer overrides it
  choose(theme) {
    localStorage.setItem('themeChosen', '1');
    localStorage.removeItem('themeFollow');
    Theme.stopFollowingBrowser();
    Theme.set(theme);
  },
  // the user picked Follow the browser (Profile > Preferences) : its own choice too, so the server
  // default no longer overrides it, but light or dark as the browser is, and as it changes
  chooseBrowser() {
    localStorage.setItem('themeChosen', '1');
    localStorage.setItem('themeFollow', '1');
    Theme.followBrowser();
  },
  isFollowingBrowser() {
    return localStorage.getItem('themeFollow') === '1';
  },
  set(theme) {
    const store = useAppStore();
    localStorage.setItem('theme', theme);
    store.theme = theme;
    const el = document.documentElement;
    el.setAttribute('data-bs-theme', theme);
  },
  // The color theme : the header in the color picked, and every blue of the app - links, the
  // primary and outline buttons, the selected menu entry and its badges, the tabs, the pager,
  // checkboxes, switches and focus rings - in tones of it (styles/textColors.scss reads these
  // under [data-bs-theme=color]). The status pills keep their own colors : they say a state.
  applyColor(hex) {
    hex = Theme.current(hex);
    localStorage.setItem('themeColor', hex);
    Theme.paintColor(hex);
  },
  // the color's tones on the page, nothing saved (applyColor, previewColor)
  paintColor(hex) {
    hex = Theme.current(hex);
    const el = document.documentElement;
    el.style.setProperty('--af-bg-navbar', hex);
    el.style.setProperty('--af-navbar-link-hover-color', '#ffffff');
    el.style.setProperty('--af-navbar-link-active-color', '#ffffff');
    for (const [name, value] of Object.entries(Theme.tones(hex))) el.style.setProperty(name, value);
  },
  // A color hovered in a palette (the header's theme menu, Profile > Preferences, Settings >
  // Appearance > Defaults) : the app shows that color theme while the pointer is on it, nothing
  // saved ; the next color hovered shows its own, and leaving the palette shows the user's theme
  // again (endPreview).
  previewColor(hex) {
    useAppStore().themePreview = 'color';
    document.documentElement.setAttribute('data-bs-theme', 'color');
    Theme.paintColor(hex);
  },
  endPreview() {
    const store = useAppStore();
    store.themePreview = null;
    const theme = store.theme || localStorage.getItem('theme') || Theme.getMediaPreference();
    document.documentElement.setAttribute('data-bs-theme', theme);
    if (theme === 'color') Theme.paintColor(Theme.getColor());
    else Theme.clearColor();
  },
  clearColor() {
    const el = document.documentElement;
    el.style.removeProperty('--af-bg-navbar');
    el.style.removeProperty('--af-navbar-link-hover-color');
    el.style.removeProperty('--af-navbar-link-active-color');
    for (const name of Object.keys(Theme.tones('#000000'))) el.style.removeProperty(name);
  },
  /**
   * The tones of a color the app's blue is replaced with : the color itself, darker ones for
   * text and links on white (readable) and for hover, and light tints for the subtle
   * backgrounds and borders.
   *
   * Args:
   *   hex (string): the color picked (#rrggbb).
   *
   * Returns:
   *   object: CSS custom properties and their values.
   */
  tones(hex) {
    const rgb = Theme.hexToRgb(hex) || [0, 140, 186];
    const mix = (to, amount) => rgb.map((c, i) => Math.round(c + (to[i] - c) * amount));
    const css = (c) => `rgb(${c.join(', ')})`;
    const black = [0, 0, 0];
    const white = [255, 255, 255];
    const text = mix(black, 0.25);
    const hover = mix(black, 0.15);
    return {
      '--bs-primary': hex,
      '--bs-primary-rgb': rgb.join(', '),
      '--bs-link-color': css(text),
      '--bs-link-color-rgb': text.join(', '),
      '--bs-link-hover-color': css(mix(black, 0.4)),
      '--bs-link-hover-color-rgb': mix(black, 0.4).join(', '),
      '--bs-primary-text-emphasis': css(mix(black, 0.5)),
      '--bs-primary-bg-subtle': css(mix(white, 0.85)),
      '--bs-primary-border-subtle': css(mix(white, 0.6)),
      '--bs-focus-ring-color': `rgba(${rgb.join(', ')}, 0.25)`,
      '--af-accent-hover': css(hover),
      '--af-accent-text': css(text),
    };
  },
  /**
   * A #rrggbb (or #rgb) color as its red, green and blue.
   *
   * Args:
   *   hex (string): the color.
   *
   * Returns:
   *   number[]|null: [r, g, b], or null when it is not a color.
   */
  hexToRgb(hex) {
    let h = String(hex || '')
      .trim()
      .replace(/^#/, '');
    if (h.length === 3)
      h = h
        .split('')
        .map((c) => c + c)
        .join('');
    if (!/^[0-9a-f]{6}$/i.test(h)) return null;
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  },
  getColor() {
    return Theme.current(localStorage.getItem('themeColor') || '#008cba');
  },
  /**
   * A color of the palette as it is now : the bright indigo, purple, pink, red, orange and teal
   * it once offered were hard on the eye, and its cyan was hardly told from the blue - each became
   * a darker tone of the same color. A pick of one of those (saved in the browser, or the server's
   * default) reads as its darker tone.
   *
   * Args:
   *   hex (string): the color picked.
   *
   * Returns:
   *   string: the color to show.
   */
  current(hex) {
    const RETIRED = {
      '#6610f2': '#521ea6',
      '#744fc6': '#4a2a8f',
      '#0190ce': '#0369a1',
      '#dc3545': '#b92d34',
      '#ff8800': '#c2570c',
      '#20c997': '#0f766e',
      '#d63384': '#bb1c5e',
    };
    return RETIRED[String(hex || '').toLowerCase()] || hex;
  },
  themes() {
    return [
      { title: 'Light', value: 'light', icon: 'fac,brightness' },
      { title: 'Dark', value: 'dark', icon: 'moon' },
      { title: 'Color', value: 'color', icon: 'palette' },
    ];
  },
  // the browser's light / dark preference followed live (a system that switches at night) while
  // the user has not picked a theme of their own, or picked Follow the browser
  followBrowser() {
    Theme.clearColor();
    Theme.set(Theme.getMediaPreference());
    if (Theme._media || typeof window === 'undefined' || !window.matchMedia) return;
    Theme._media = window.matchMedia('(prefers-color-scheme: dark)');
    Theme._onMedia = () => {
      if (!Theme.isUserChoice() || Theme.isFollowingBrowser()) Theme.set(Theme.getMediaPreference());
    };
    Theme._media.addEventListener?.('change', Theme._onMedia);
  },
  stopFollowingBrowser() {
    Theme._media?.removeEventListener?.('change', Theme._onMedia);
    Theme._media = null;
  },
  getMediaPreference() {
    const hasDarkPreference = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (hasDarkPreference) {
      return 'dark';
    } else {
      return 'light';
    }
  },
};

export default Theme;
