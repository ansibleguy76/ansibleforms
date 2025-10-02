<script setup>
// No script logic needed for this info page
</script>

<template>
  <AppNav />
  <div class="container py-5">
    <div class="row justify-content-center">
      <div class="col-lg-8">
        <div class="card shadow-sm border-0 mb-4">
          <div class="card-body">
            <h1 class="mb-3">API Documentation</h1>
            <p class="lead">Welcome to the AnsibleForms API documentation portal.</p>
            <p>There are currently <strong>two versions</strong> of the API:</p>
            <ul>
              <li><strong>v1</strong>: Production ready and stable.</li>
              <li><strong>v2</strong>: Also production ready, more standards-compliant, and preferred for all new features. <span class="text-info">All new features will be added to v2 only.</span></li>
            </ul>
            <div class="bg-light p-3 rounded border mb-3">
              <div class="mb-2">API Docs Endpoints:</div>
              <pre class="mb-0" style="font-family: 'Fira Mono', 'Consolas', monospace; background: none; border: none;">
<a href="/api/v1/docs">/api/v1/docs</a>
<a href="/api/v2/docs">/api/v2/docs</a>
              </pre>
            </div>
            <p class="mb-0 text-muted">
              Click the links above or enter them in your browser to access the interactive Swagger UI for each API version.
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>