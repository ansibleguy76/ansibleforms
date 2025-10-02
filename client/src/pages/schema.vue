<script setup>
import axios from 'axios'
import { ref, computed } from 'vue'
import { useAppStore } from '@/stores/app'
import { useToast } from 'vue-toastification'
import { useRoute, useRouter } from 'vue-router'
import State from '@/lib/State'
import Navigate from '@/lib/Navigate'

const store = useAppStore()
const toast = useToast()
const router = useRouter()
const route = useRoute()

const emit = defineEmits(['recheckSchema'])

const error = store.errorMessage
const loading = ref(false)

const success = computed(() => {
  return store.schemaData?.success?.join('<br>') || ''
})

const failed = computed(() => {
  return store.schemaData?.failed?.join('<br>') || ''
})

async function create() {
  loading.value = true
  toast.info("Creating schema and tables...")
  try {
    const createResult = await axios.post(`/api/v2/schema`, {})
    const result = await State.checkDatabase();
    if (result) {
      toast.success(createResult.data.message)
      await State.init(router, route)
    }
  } catch (error) {
    toast.error(error.message)
  } finally {
    loading.value = false
  }
}


onMounted(async () => {
  const result = await State.checkDatabase();
  if (result) {
    Navigate.toHome(router, route);
  }
});

</script>

<template>
  <section class="min-vh-100 bg-light d-flex align-items-center">
    <div class="container">
      <div v-if="!loading" class="row justify-content-center">
        <div class="col-12 col-md-8 col-lg-6">
          <div class="alert alert-danger" v-if="error != ''" v-text="error"></div>
          <div class="alert alert-success" v-if="success" v-html="success"></div>
          <div class="alert alert-warning" v-if="failed" v-html="failed"></div>
          <div v-if="error != 'Schema creation is disabled'">
            <form action="" class="card p-4 mb-3" v-if="failed && !success">
              <div class="mb-3">
                If this is the first time setup and you don't have your own schema and tables.<br><br>
                Would you like me to try and create the schema and tables ?<br>
                I would create the following : <br><br>
                <table class="table table-bordered">
                  <tbody>
                    <tr>
                      <th>Databaseschema</th>
                      <td>AnsibleForms</td>
                    </tr>
                    <tr>
                      <th>Tables</th>
                      <td>All required tables</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div class="mb-3">
                <button type="button" class="btn btn-success" @click="create()">
                  <span class="me-2"><font-awesome-icon icon="magic" /></span><span>Create</span>
                </button>
              </div>
            </form>
            <form action="" class="card p-4 mb-3" v-if="failed && success">
              <div>
                It appears that you have an unuseable schema. Part of the database is present, and part is missing.<br>
                Please contact your database or application administrator to either restore from a backup, or create the
                missing tables or remove the database so I can create it for you.  When using K8s, it's best that you don't create a default database.
                For now there is nothing I can do for you, until the schema and tables are in a consistent state.
              </div>
            </form>
          </div>
          <div v-else class="card p-4 mb-3">
            <div>
              Schema creation is disabled by your administrator.<br>
              Please contact your database or application administrator to create the schema and tables.
            </div>
          </div>
          <div v-if="error == 'FATAL ERROR'" class="card p-4 mb-3">
            <div>
              Something went wrong. Most likely the database is simply not reachable.
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
