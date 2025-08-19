<script setup>

    /******************************************************************/
    /*                                                                */
    /*  App AnsibleForms Settings Sidebar menu                        */
    /*                                                                */
    /******************************************************************/

    const items = [
        { title: "Ansible Forms", icon: "fac,ansibleforms", link: "/admin/settings" },
        { title: "Backups", icon: "database", link: "/admin/backups" },
        { title: "Mail", icon: "envelope", link: "/admin/mailSettings"},
        { title: "divider" },
        { title: "Groups", icon: "users", link: "/admin/groups" },
        { title: "Users", icon: "user", link: "/admin/users" },
        { title: "Ldap", icon: "globe", link: "/admin/ldap" },
        { title: "Entra ID", icon: "fac,azure", link: "/admin/entraId" },
        { title: "Open ID", icon: "fac,openid", link: "/admin/openId" },
        { title: "divider" },
        { title: "Credentials", icon: "lock", link: "/admin/credentials" },
        { title: "Ssh", icon: "key", link: "/admin/ssh" },
        { title: "Known Hosts", icon: "server", link: "/admin/knownHosts" },
        { title: "A.A.P.", icon: "fac,ansible", link: "/admin/aap" },
        { title: "Repositories", icon: "fab,git", link: "/admin/repositories"},
        { title: "divider" },
        { title: "Data Schemas", icon: "database", link: "/admin/dataSchemas" },
        { title: "Data Sources", icon: "file-import", link: "/admin/dataSources" },
        { title: "divider" },
        { title: "Schedules", icon: "clock", link: "/admin/schedules" }
    ];
</script>
<template>
    <BsSidebar title="" icon="" :items="items" />
</template>
<style scoped>
</style>