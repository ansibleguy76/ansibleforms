import { useAppStore } from "@/stores/app";

var Theme = {
  load() {
    const store = useAppStore();
    store.theme = localStorage.getItem("theme") || Theme.getMediaPreference();
    Theme.set(store.theme);
    return store.theme
  },
  set(theme){
    // apply the theme
    const store = useAppStore();
    localStorage.setItem("theme", theme);
    store.theme = theme
    const el = document.documentElement
    el.setAttribute("data-bs-theme",theme);
  },
  themes(){
    return [
        { title: "Light", value: "light", icon:"fac,brightness" },
        { title: "Dark", value: "dark", icon:"moon" },
        { title: "Color", value: "color", icon:"palette" },
    ];
  },
  getMediaPreference() {
    const hasDarkPreference = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;
    if (hasDarkPreference) {
      return "dark";
    } else {
      return "light";
    }
  },  
};

export default Theme;
