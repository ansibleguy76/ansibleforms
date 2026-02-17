<script setup>
import Profile from "@/lib/Profile";
import Form from "@/lib/Form";
import Helpers from "@/lib/Helpers";
import TokenStorage from "@/lib/TokenStorage";
import { useRoute, useRouter } from "vue-router";

const authenticated = ref(false);
const formConfig = ref({});
const search = ref("");
const viewMode = ref('tiles') // 'tiles' or 'list'



const route = useRoute();
const router = useRouter();
const showWarnings = ref(false);

const forms = computed(() => {
    var payload = TokenStorage.getPayload();
    var intersect = [];
    return formConfig.value?.forms
        ?.sort((a, b) => {
            // First, sort by "order" (undefined orders go last)
            const orderA = a.order !== undefined ? a.order : Number.MAX_SAFE_INTEGER;
            const orderB = b.order !== undefined ? b.order : Number.MAX_SAFE_INTEGER;
            if (orderA !== orderB) {
            return orderA - orderB;
            }
            // Then, sort by name (case-insensitive)
            const nameA = (a.name || "").toLowerCase();
            const nameB = (b.name || "").toLowerCase();
            if (nameA > nameB) return 1;
            if (nameA < nameB) return -1;
            return 0;
        });
});

const currentCategory = computed(() => {
    return decodeURIComponent(route.query?.category || "");
});

const roles = computed(() => {
    return TokenStorage.getPayload().user.roles;
});

const isAll = computed(() => {
    return currentCategory.value == "";
});

const filteredFormsBySearch = computed(() => {
    var f = forms.value || [];
    if (search.value) {
        return f.filter((x) =>
            x.name.toLowerCase().includes(search.value.toLowerCase())
        );
    } else {
        return f;
    }
});

function setView(m){
    if(m!=='tiles' && m!=='list') return;
    viewMode.value = m;
    Helpers.setCookie('forms_view_mode', m, 365);
}

function select(path) {
    if (path) {
        router
            .replace({ path: "/", query: { category: encodeURIComponent(path) } })
            .catch((e) => { });
    } else {
        router.replace({ path: "/" }).catch((e) => { });
    }
}

function isAdmin(payload) {
    return payload.user.roles.includes("admin");
}

const getForms = computed(() => {
    return filterForms(currentCategory.value);
});

function filterForms(category) {
    var f = filteredFormsBySearch.value || [];
    if (!category) {
        return f;
    } else {
        return f.filter((item) => {
            if (item.categories != undefined) {
                for (let j = 0; j < item.categories.length; j++) {
                    if (inCategory(item.categories[j], category)) return true;
                }
                return false;
            } else {
                return category == "Default";
            }
        });
    }
}

function inCategory(c, category) {
    var x = category.split("/");
    var y = c.split("/");
    for (let i = 0; i < x.length; i++) {
        if (i < y.length) {
            if (x[i] != y[i]) {
                return false;
            }
        } else {
            return false;
        }
    }
    return true;
}

function getFormClass(form) {
    return (form.tileClass == undefined ? "bg-primary-subtle" : form.tileClass)
        .replace("has-background-", "bg-")
        .replace("light", "subtle");
}

onMounted(async () => {
    authenticated.value = !!(await Profile.load());
    if (!authenticated.value) {
        return;
    }
    formConfig.value = await Form.list();
    // restore view mode from cookie if present
    const vm = Helpers.getCookie('forms_view_mode');
    if(vm && (vm === 'tiles' || vm === 'list')) viewMode.value = vm;
});
</script>
<template>

    <AppNav />
    <!-- WARNINGS -->
    <!-- <BsOffCanvas v-if="(warnings || Object.keys(queryerrors).length > 0) && showWarnings" :show="true" icon="triangle-exclamation" title="Form warnings" @close="showWarnings = false">
        <template #actions> </template>
        <template #default>
            <p v-for="w, i in warnings" :key="'warning' + i" class="mb-3" v-html="w"></p>
            <p v-for="q, i in Object.keys(queryerrors)" :key="'queryerror' + i" class="mb-3 has-text-danger">
                '{{ q }}' has query errors<br>{{ queryerrors[q] }}
            </p>
        </template>
    </BsOffCanvas>     -->
    <BsOffCanvas
        :show="showWarnings && (formConfig?.warnings?.length > 0 || formConfig?.errors?.length > 0)"
        icon="triangle-exclamation"
        title="Form warnings"
        @close="showWarnings = false"
    >
        <template #default>
            <p v-for="(w, i) in formConfig.warnings" :key="'warning' + i" class="mb-3" v-html="w"></p>
            <p v-for="(e, i) in formConfig.errors" :key="'error' + i" class="mb-3 has-text-danger" v-html="e"></p>
        </template>
    </BsOffCanvas>
    <div class="flex-shrink-0">
        <main class="d-flex container-xxl">
            <div v-if="authenticated && forms" class="container-fluid min-vh-100 d-flex flex-column">
                <div class="row flex-grow-1">
                    <div class="col-md-auto bg-categories h-100 border-top-0">
                        <div class="d-flex align-items-center p-3 mb-3 link-body-emphasis text-decoration-none border-bottom">
                            <FaIcon icon="fas,layer-group" />
                            <span class="ms-2 fs-5 fw-bold">Categories</span>
                        </div>
                        <ul class="list-unstyled my-3">
                            <li role="button">
                                <div class="d-flex justify-content-between menu-item p-2 my-1" :class="{ 'bg-primary-forced': isAll }" @click="select('')">
                                    <span :class="{ 'text-light': isAll }">
                                        <span class="me-2">
                                            <FaIcon icon="check-double" :fixedwidth="true"></FaIcon>
                                        </span>
                                        All Forms</span>
                                    <span v-if="isAll" class="badge px-3 rounded-pill active">{{ forms.length }}</span>
                                    <span v-else class="badge px-3 rounded-pill">{{
                                        forms.length
                                        }}</span>
                                </div>
                            </li>
                            <AppMenuItem @click="select" v-for="item in formConfig?.categories" :key="item.name" :currentPath="currentCategory" parent="" :menu="item" :forms="forms" :roles="roles" />
                        </ul>
                    </div>
                    <div class="col h-100 bg-body">
                        <div v-if="forms" class="p-3">
                            <div class="d-flex justify-content-end mb-2">
                                <button
                                    v-if="formConfig?.warnings?.length > 0 || formConfig?.errors?.length > 0"
                                    @click="showWarnings = !showWarnings"
                                    class="btn btn-warning btn-sm"
                                    type="button"
                                >
                                    <span class="me-1">
                                        <FaIcon icon="exclamation-triangle" />
                                    </span>
                                    {{ showWarnings ? 'Hide' : 'This config has' }} Warnings or Errors
                                </button>
                                <button class="btn btn-outline-secondary btn-sm ms-2" @click="(viewMode==='tiles')?setView('list'):setView('tiles')" title="Toggle view">
                                    <span class="me-1"><FaIcon :icon="viewMode==='tiles'? 'th-list' : 'th'" /></span>
                                    <span v-if="viewMode==='tiles'">List</span>
                                    <span v-else>Tiles</span>
                                </button>
                            </div>
                            <BsInput v-model="search" placeholder="Search" label="Filter" type="text" icon="search" />
                            <div v-if="viewMode==='tiles'" class="row align-content-stretch g-4">
                                <TransitionGroup>
                                    <div class="col-md-6 col-lg-4 col-xxl-3" v-for="form in getForms" :key="form.name">
                                        <router-link :to="'/form?form=' + encodeURI(form.name)" class="card h-100 p-4 text-reset text-decoration-none" :class="getFormClass(form)">
                                            <div class="row">
                                                <div v-if="form.image || form.icon" class="col-3 text-center">
                                                    <img v-if="form.image" :src="form.image" alt="Image" class="img-fluid" />
                                                    <span v-if="form.icon" class="icon is-large text-body">
                                                        <FaIcon 
                                                            :icon="form.icon" 
                                                            :size="form.iconSize"
                                                            :color="form.iconColor"
                                                            :overlayIcon="form.overlayIcon"
                                                            :overlayIconTransform="form.overlayIconTransform"
                                                            :overlayIconColor="form.overlayIconColor"
                                                            :overlayIconText="form.overlayIconText"
                                                            :overlayIconTextPosition="form.overlayIconTextPosition"
                                                            :overlayIconTextColor="form.overlayIconTextColor"
                                                        />
                                                    </span>
                                                </div>
                                                <div class="col text-body">
                                                    <p class="fw-bold" :class="getFormClass(form)">
                                                        {{ form.name }}
                                                    </p>
                                                    <p>{{ form.description }}</p>
                                                </div>
                                            </div>
                                        </router-link>
                                    </div>
                                </TransitionGroup>
                            </div>
                            <div v-else class="table-responsive">
                                <table class="table table-bordered table-hover">
                                    <thead>
                                        <tr>
                                            <th>Name</th>
                                            <th>Description</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr
                                            v-for="form in getForms"
                                            :key="form.name"
                                            style="cursor:pointer"
                                            @click="$router.push({ path: '/form', query: { form: form.name } })"
                                        >
                                            <td :class="getFormClass(form)">
                                                {{ form.name }}
                                            </td>
                                            <td :class="getFormClass(form)">
                                                {{ form.description }}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                            
                        </div>
                    </div>
                </div>
            </div>
        </main>
    </div>
</template>
<style scoped lang="scss">
.badge {
    background-color: var(--af-bg-badge) !important;
    color: var(--af-text-badge) !important;

    &.active {
        background-color: var(--af-text-badge) !important;
        color: var(--af-bg-badge) !important;
    }
}

.v-enter-active,
.v-leave-active {
    transition: opacity .2s ease;
}

.v-enter-from,
.v-leave-to {
    opacity: 0;
}
</style>
