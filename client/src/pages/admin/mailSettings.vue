<script setup>
import { toast } from 'vue-sonner';
import { useVuelidate } from '@vuelidate/core';
import { required, helpers, email } from "@vuelidate/validators";
import Profile from '@/lib/Profile';
import settings from '@/config/settings';
import axios from 'axios';
import TokenStorage from '@/lib/TokenStorage';

const authenticated = ref(false);

const rules = {
    test: {
        to: {
            required: helpers.withMessage("Enter you mail destination", required),
            email: helpers.withMessage("Must be a valid email", email),
        },
    }
};

const test = ref({
    to: ""
});


const $v = useVuelidate(rules, { test });


async function test_connection(mail) {
    if($v.value.test.$invalid) {
        $v.value.test.$touch();
        return;
    }
    try {
        const result = await axios.post(`/api/v1/settings/mailcheck`, {...mail,...test.value}, TokenStorage.getAuthentication());
        if (result.data.status == "error") {
            toast.error(result.data.message + ", " + result.data.data.error);
        } else {
            toast.success(result.data.message);
        }
    } catch (err) {
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
            <AppAdminSingle v-if="authenticated" :settings="settings.mailSettings" @test="test_connection">
                <BsInput :isFloating="false" v-model="test.to" icon="envelope" type="email" label="Mail To" help="For testing only" :required="true" :hasError="$v.test.to.$invalid && $v.test.to.$dirty" :errors="$v.test.to.$errors" />
            </AppAdminSingle>   
        </main>
    </div>

 
</template>
