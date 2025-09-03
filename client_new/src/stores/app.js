// Utilities
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAppStore = defineStore('app', () => {
  const theme = ref('light') // default theme
  const profile = ref(null)
  const authenticated = ref(false)
  const isAdmin = ref(false)
  const version = ref('')
  const approvals = ref(0)
  const errorMessage = ref('')
  const schemaData = ref(null)


  // const doubleCount = computed(() => count.value * 2)
  // function increment() {
  //   count.value++
  // }

  return { theme, profile, authenticated, isAdmin, version, approvals, errorMessage, schemaData }
})

