<script setup>
import { ref, onMounted } from 'vue';
// import { toast } from 'vue-sonner';
import Profile from '@/lib/Profile';
// import axios from 'axios';
import settings from '@/config/settings';
// import TokenStorage from '@/lib/TokenStorage';

// 
const authenticated = ref(false);

onMounted(async () => {
    authenticated.value = !!(await Profile.load());
    if (!authenticated.value) {
        return;
    }
});
</script>
<template>
    <AppNav />
    <div class="flex-shrink-0">
        <main class="d-flex flex-nowrap container-xxl">
            <AppSidebar />
            <div class="d-flex flex-column w-100">
                <AppAdminMulti v-if="authenticated" :apiVersion="2" :settings="settings.oauth2_providers" />
                <div class="accordion m-3" id="providerHelpAccordion">
                    <div class="accordion-item">
                        <h2 class="accordion-header" id="headingEntraId">
                            <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapseEntraId" aria-expanded="false" aria-controls="collapseEntraId">
                                Entra ID Help
                            </button>
                        </h2>
                        <div id="collapseEntraId" class="accordion-collapse collapse" aria-labelledby="headingEntraId" data-bs-parent="#providerHelpAccordion">
                            <div class="accordion-body">
                                <strong>Required API Permissions</strong><br>
                                <ul>
                                    <li>Delegated User.Read</li>
                                    <li>Delegated GroupMember.Read.All</li>
                                </ul>
                                <strong>Required Group Claims</strong>
                                <ul>
                                    <li>Security Groups</li>
                                    <li>Access &gt; samAccountName</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                    <div class="accordion-item">
                        <h2 class="accordion-header" id="headingOpenId">
                            <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapseOpenId" aria-expanded="false" aria-controls="collapseOpenId">
                                Open ID Help
                            </button>
                        </h2>
                        <div id="collapseOpenId" class="accordion-collapse collapse" aria-labelledby="headingOpenId" data-bs-parent="#providerHelpAccordion">
                            <div class="accordion-body">
                                <strong>Notice:</strong> Open ID has only been tested with Keycloak so far.
                            </div>
                        </div>
                    </div>
                    <!-- Add more accordion-item blocks here for other providers as needed -->
                </div>
            </div>
        </main>
    </div>
</template>
