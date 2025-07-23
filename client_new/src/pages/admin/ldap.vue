<script setup>
import { useToast } from 'vue-toastification';
import Profile from '@/lib/Profile';
import axios from 'axios';
import settings from '@/config/settings'
import TokenStorage from '@/lib/TokenStorage';

const toast = useToast();
const authenticated = ref(false);

async function test_connection(ldap) {

    try{
        const result = await axios.post(`/api/v1/ldap/check`, ldap , TokenStorage.getAuthentication());
    if (result.data.status == "error") {
        toast.error(result.data.message + ", " + result.data.data.error);
    } else {
        toast.success(result.data.message);
    }
    }catch(err){
        toast.error(err.message);
    }

}
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
            <AppAdminSingle v-if="authenticated" :settings="settings.ldap" @test="test_connection" />
        </main>
    </div>
  
</template>
<route lang="yaml">
    meta:
      layout: settings
</route>  