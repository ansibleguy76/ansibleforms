<script setup>

    /******************************************************************/
    /*                                                                */
    /*  App AnsibleForms Settings Sidebar menu                        */
    /*                                                                */
    /******************************************************************/

    import { useI18n } from 'vue-i18n';
    import { computed } from 'vue';

    const { t } = useI18n();

    const items = computed(() => [
        { title: t('sidebar.ansibleForms'), icon: "fac,ansibleforms", link: "/admin/settings" },
        { title: t('sidebar.backups'), icon: "database", link: "/admin/backups" },
        { title: t('sidebar.mail'), icon: "envelope", link: "/admin/mailSettings"},
        { title: "divider" },
        { title: t('sidebar.groups'), icon: "users", link: "/admin/groups" },
        { title: t('sidebar.users'), icon: "user", link: "/admin/users" },
        { title: t('sidebar.ldap'), icon: "globe", link: "/admin/ldap" },
        { title: t('sidebar.oauth2'), icon: "fac,oauth", link: "/admin/oauth2" },
        { title: "divider" },
        { title: t('sidebar.credentials'), icon: "lock", link: "/admin/credentials" },
        { title: t('sidebar.ssh'), icon: "key", link: "/admin/ssh" },
        { title: t('sidebar.knownHosts'), icon: "server", link: "/admin/knownHosts" },
        { title: t('sidebar.aap'), icon: "fac,ansible", link: "/admin/aap" },
        { title: t('sidebar.repositories'), icon: "fab,git", link: "/admin/repositories"},
        { title: "divider" },
        { title: t('sidebar.schedules'), icon: "clock", link: "/admin/schedules" },
        { title: t('sidebar.storedJobs'), icon: "floppy-disk", link: "/admin/stored-jobs" }
    ]);
</script>
<template>
    <BsSidebar title="" icon="" :items="items" />
</template>
<style scoped>
</style>