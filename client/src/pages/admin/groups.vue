<script setup>
    import settings from '@/config/settings'
    import Profile from '@/lib/Profile';

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
            <AppAdminMulti v-if="authenticated" :settings="settings.groups" />
        </main>
    </div>    
    
</template>
