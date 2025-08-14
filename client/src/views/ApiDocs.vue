<template>
  <section class="section">
    <div class="container">
      <div class="columns is-centered">
        <div class="column is-8">
          <div class="box has-background-light">
            <h1 class="title is-3 mb-3">API Documentation</h1>
            <p class="subtitle is-5">Welcome to the AnsibleForms API documentation portal.</p>
            <div class="content">
              <p>There are currently <strong>two versions</strong> of the API:</p>
              <ul>
                <li><strong>v1</strong>: First version and less standards-compliant (will become deprecated).</li>
                <li><strong>v2</strong>: More standards-compliant. <span class="has-text-info">All new features will be added to v2 only.</span></li>
              </ul>
            </div>
            <div class="notification is-light is-family-monospace mb-4">
              <div class="mb-2 has-text-weight-semibold">API Docs Endpoints:</div>
              <div>
                <a href="/api/v1/docs" rel="noopener" class="has-text-link">/api/v1/docs</a><br>
                <a href="/api/v2/docs" rel="noopener" class="has-text-link">/api/v2/docs</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script>
export default {
  name: 'ApiDocs'
}
</script>
