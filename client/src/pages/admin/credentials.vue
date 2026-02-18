<script setup>
import { toast } from 'vue-sonner';
import Profile from '@/lib/Profile';
import axios from 'axios';
import Helpers from '@/lib/Helpers';
import settings from '@/config/settings';
import TokenStorage from '@/lib/TokenStorage';


const authenticated = ref(false);
const tests = ref({});

async function test_connection(item) {
    if (item) {
        if(!tests.value[item.id]){
            try {
                tests.value[item.id] = "Testing...";
                const result = await axios.get(`/api/v2/credential/testdb/${item.id}`, TokenStorage.getAuthentication());
                toast.success(result.data.message);
            } catch (err) {
                toast.error(Helpers.parseAxiosResponseError(err, "Connection test failed"));
            } finally {
                delete tests.value[item.id];
            }
        }else {
            toast.warning("Test already in progress");
        }
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
            <AppAdminMulti v-if="authenticated" apiVersion="2" :settings="settings.credentials" @test="test_connection" :busyItems="tests" />
        </main>
    </div>

</template>
