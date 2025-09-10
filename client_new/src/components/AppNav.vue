<script setup>

  /******************************************************************/
  /*                                                                */
  /*  App AnsibleForms Nav component                                */
  /*  Contains the top navigation bar                               */
  /*                                                                */
  /******************************************************************/

  import { ref, computed, onMounted } from "vue";
  import { useAppStore } from "@/stores/app";
  import Theme from "@/lib/Theme";

  // INIT
  const store = useAppStore();
  
  // ENV-BASED HOME MENU LABEL/ICON
  const navHomeLabel = ref("Forms");
  const navHomeIcon = ref("home");

  import axios from "axios";

  onMounted(async () => {
    try {
      const res = await axios.get("/api/v2/app/config");
      navHomeLabel.value = res.data?.navHomeLabel || navHomeLabel.value;
      navHomeIcon.value = res.data?.navHomeIcon || navHomeIcon.value;
    } catch (e) {
      // fallback to defaults if API fails
      console.error("Failed to fetch app config:", e);
    }
  });
  
  // DATA

  const showVersion = ref(false);
  const showProfile = ref(false);
  const currentTheme = ref(Theme.load());
  const menuOptions = [
    { title: "Jobs", link: "/jobs", icon: "history" },
    { title: "Settings", link: "/admin/settings", icon: "gear" },
    { title: "Designer", link: "/designer", icon: "pen-to-square" }
  ];
  const helpMenuOptions = [
    { title: "Documentation", href: "https://ansibleforms.com", icon: "globe", target: "_blank" },
    { title: "Api docs", link: "/api-docs", icon: "code", target: "_blank" }
  ];
  const profileMenu = [
    { title: "Change Password", link: "/change-password", icon: "key", target: "_self", local_only: true },
    { title: "Logout", link: "/logout", icon: "arrow-right-from-bracket", target: "_self" },
  ];

  // COMPUTED

  const menu = computed(() => {
    // Clone menuOptions to avoid mutating the original array
    let m = menuOptions.map(item => ({ ...item }));

    // Add badge to Jobs menu
    const jobsMenu = m.find(item => item.link === "/jobs");
    if (jobsMenu) {
      jobsMenu.badge = store.approvals;
    }

    // Add home menu item
    m.unshift({
      title: navHomeLabel.value,
      link: "/",
      icon: navHomeIcon.value,
      target: "_self"
    });


    if (!(store?.profile?.options?.showSettings ?? store.isAdmin)) {
      m = m.filter(m => m.link != "/admin/settings");
    }
    if (!(store?.profile?.options?.showDesigner ?? store.isAdmin)) {
      m = m.filter(m => m.link != "/designer");
    }
    return m;
  });

  const helpMenu = computed(() => {
    var m = helpMenuOptions;
    if(!(store?.profile?.options?.showLogs ?? store.isAdmin)){
      m = m.filter(m => m.link != "/logs");
    }
    return m;
  });

</script>

<template>
  <BsModal v-if="showVersion" @close="showVersion = false" >
    <template v-slot:title>
      Ansible Forms <badge class="badge rounded-pill text-bg-info">v{{ store.version }}</badge>
    </template>
    <template v-slot>
      <p class="mt-3 fs-6 user-select-none">
        This program is free software: you can redistribute it and/or modify
        it under the terms of the <strong>GNU General Public License</strong> as published by
        the Free Software Foundation, either version 3 of the License, or
        (at your option) any later version.<br>
        <br>
        This program is distributed in the hope that it will be useful,
        but WITHOUT ANY WARRANTY; without even the implied warranty of
        MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
        GNU General Public License for more details.<br>

        <br>You can find the GNU General Public License at
        <a target="_blank" href="http://www.gnu.org/licenses/">http://www.gnu.org/licenses/</a><br>
      </p>
    </template>
  </BsModal>
  <BsModal v-if="showProfile" @close="showProfile = false" >
    <template v-slot:title>
      About me
    </template>

    <div class="row gy-2 m-2">
      <div class="col m-2 bg-info-subtle">
        <div class="p-2">
          <strong>Username : </strong>{{ store?.profile?.username }}
        </div>
      </div>
      <div class="col m-2 bg-info-subtle">
        <div class="p-2">
          <strong>Type : </strong>{{ store?.profile?.type }}
        </div>
      </div>
    </div>
    <div class="row gy-2 m-2">
      <div class="col m-2 bg-success-subtle">
        <div class="p-2">
          <strong>Groups : </strong>
          <ul class="list-unstyled">
            <li v-for="g in store?.profile?.groups || []" :key="g"><font-awesome-icon icon="check" /> {{ g }}</li>
          </ul>
        </div>
      </div>
      <div class="col m-2 bg-warning-subtle">
        <div class="p-2">
          <strong>Roles : </strong>
          <ul class="list-unstyled">
            <li v-for="r in store?.profile?.roles || []" :key="r"><font-awesome-icon icon="check" /> {{ r }}</li>
          </ul>
          <strong>Options : </strong>
          <ul class="list-unstyled">
            <li v-for="r in Object.keys(store?.profile?.options || [])" :key="r"><font-awesome-icon icon="check" /> {{ r }} : {{ store?.profile?.options[r] }}</li>
          </ul>          
        </div>
      </div>
    </div>
  </BsModal>
  <BsNavBar :currentTheme="currentTheme">
    <ul class="navbar-nav ms-auto mb-2 mb-md-0">
      <BsNavLink v-for="m in menu" :link="m" />
      <!-- help menu -->
      <BsNavDivider />
      <BsNavItem :dropdown="true">
        <BsNavMenu icon="circle-question" title="Help">
          <li v-for="m in helpMenu">
            <a v-if="m.href" type="button" class="dropdown-item d-flex align-items-center" :href="m.href" :target="m.target">
              <span class="icon"><font-awesome-icon :icon="m.icon" /></span>
              <span class="ms-2">{{ m.title }}</span>
            </a>
            <router-link v-else class="dropdown-item d-flex align-items-center" :to="m.link" :target="m.target">
              <span class="icon"><font-awesome-icon :icon="m.icon" /></span>
              <span class="ms-2">{{ m.title }}</span>
            </router-link>
          </li>
          <hr>
          <li>
            <button type="button" class="dropdown-item d-flex align-items-center" @click="showVersion = true">
              <span class="icon"><font-awesome-icon icon="code-branch" /></span>
              <span class="ms-2">About v{{ store.version }}</span>
            </button>
          </li>
        </BsNavMenu>
      </BsNavItem>

      <!-- user profile -->
      <BsNavDivider />
      <BsNavItem :dropdown="true">
        <BsNavMenu icon="user" :title="store.profile?.username || ''" :showTitle="true">
          <li v-for="m in profileMenu">
            <template v-if="(store.profile?.type=='local' && m.local_only) || !m.local_only">
                <a v-if="m.href" type="button" class="dropdown-item d-flex align-items-center" :href="m.href">
                  <span class="icon"><font-awesome-icon :icon="m.icon" /></span>
                  <span class="ms-2">{{ m.title }}</span>
                </a>
                <router-link v-else class="dropdown-item d-flex align-items-center" :to="m.link" :target="m.target">
                  <span class="icon"><font-awesome-icon :icon="m.icon" /></span>
                  <span class="ms-2">{{ m.title }}</span>
                </router-link>
            </template>
          </li>
          <hr>
          <li>
            <button type="button" class="dropdown-item d-flex align-items-center" @click="showProfile = true">
              <span class="icon"><font-awesome-icon icon="address-card" /></span>
              <span class="ms-2">About me</span>
            </button>
          </li>
        </BsNavMenu>
      </BsNavItem>


      <!-- theme switcher -->
      <BsNavDivider />
      <BsNavItem :dropdown="true">
        <BsThemeSwitcher v-model="currentTheme" />
      </BsNavItem>

    </ul>
  </BsNavBar>


</template>

<style scoped lang="scss"></style>