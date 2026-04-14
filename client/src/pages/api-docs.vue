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
            
            <div class="alert alert-warning border-warning mb-3" role="alert">
              <h5 class="alert-heading mb-2">
                <i class="bi bi-exclamation-triangle-fill me-2"></i>API v1 is Deprecated
              </h5>
              <p class="mb-0">
                <strong>API v1</strong> is deprecated as it does not follow REST API standards. 
                Please migrate all integrations to <strong>API v2</strong>. 
                New features will only be added to v2.
              </p>
            </div>

            <ul>
              <li><strong>v1</strong>: <span class="badge bg-warning text-dark">DEPRECATED</span> Legacy API, not following REST standards.</li>
              <li><strong>v2</strong>: <span class="badge bg-success">RECOMMENDED</span> Standards-compliant REST API. All new features are added here.</li>
            </ul>
            <div class="bg-light p-3 rounded border mb-3">
              <div class="mb-2">API Docs Endpoints:</div>
              <pre class="mb-0" style="font-family: 'Fira Mono', 'Consolas', monospace; background: none; border: none;">
<a href="/api/v1/docs">/api/v1/docs</a> <span class="text-warning">(deprecated)</span>
<a href="/api/v2/docs">/api/v2/docs</a> <span class="text-success">(recommended)</span>
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