<template>
    <section class="section">
      <div class="container">
        <h1 class="title has-text-info"><font-awesome-icon icon="arrows-spin" /> Install</h1>
        <div v-if="isLoading">
          <p class="has-text-info">Performing checks...</p>
        </div>
        <div v-else>
          <div v-if="checksError" class="notification is-danger">
            <p class="has-text-danger">{{ checksError }}</p>
          </div>
          <div v-else>
            <div v-for="(check, checkName) in checkResults.data.output" :key="checkName">
              <p :class="getStatusColorClass(check.status)">
                <span class="icon" :class="getIcon(check.status)">
                  <font-awesome-icon :icon="check.status === 'OK' ? 'check-circle' : 'times-circle'" />
                </span>
                {{ check.label }} [{{ check.status }}]
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  </template>
  
  
  <script>
  import Vue from 'vue';
  import axios from 'axios';
  
  export default {
    name: "AfInstall",
    data() {
      return {
        isLoading: false,
        checksError: null,
        checkResults: {},
      };
    },
    methods: {
      load() {

        this.isLoading = true;
        this.checkResults = {}; // Reset check results
        this.checksError = null; // Reset error message
  
        axios.get(`/api/v1/install`)
          .then((result) => {
            // Process check results from the API response
            const checks = result.data; // Assuming the API returns check results as an object
  
            // Update check results in the component's data
            this.checkResults = checks;
            this.isLoading = false;
          })
          .catch((err) => {
            // Handle API error
            this.checksError = "Failed to perform checks. Please try again later.";
            this.isLoading = false;
          });
      },
      getStatusColorClass(status) {
        return {
          'has-text-success': status === 'OK',
          'has-text-danger': status === 'Failed',
          'has-text-grey': status === 'Skipped',
        };
      },
      getIcon(status) {
        return status === 'OK' ? 'check-circle' : (status === 'Failed' ? 'times-circle' : 'question-circle');
      },
    },
    mounted() {
      this.load();
    },
  };
  </script>
  
  <style scoped>
  </style>
  