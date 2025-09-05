var Navigate = {

  toLogin(router,route) {
    if (route?.name != "/login") {
      // redirect to login page with original route as query parameter
      router
        .replace({ name: "/login", query: { from: (route.fullPath!="/logout")?route.fullPath:'' } })
        .catch((err) => {}); // no token found, logout
    }
  },

  toHome(router,route) {
    console.log("Redirecting to home")
    router.push({ name: "/" }).catch((err) => {});
  },
  toError(router) {
      console.log("Redirecting to error")
      router.push({ name: "/error" }).catch((err) => {});
  },

  toSchema(router) {
      console.log("Redirecting to schema")
      router.push({ name: "/schema" }).catch((err) => {});
  },

   toPath(router, path, query = "") {
      console.log("Redirecting to page");
      // Use router.resolve for robust route parsing (supports dynamic routes, params, query)
      let resolved;
      if (typeof path === 'object') {
         resolved = router.resolve(path);
      } else {
         // If path is a string and contains a query string, parse and merge with explicit query
         let pathOnly = path;
         let mergedQuery = {};
         if (typeof path === 'string' && path.includes('?')) {
           const [pathname, search] = path.split('?');
           pathOnly = pathname;
           const params = new URLSearchParams(search);
           for (const [key, value] of params.entries()) {
             mergedQuery[key] = value;
           }
         }
         // Merge with explicit query if provided
         if (query && typeof query === 'object') {
           Object.assign(mergedQuery, query);
         }
         resolved = router.resolve({ path: pathOnly, query: mergedQuery });
      }
      router.push(resolved).catch((err) => {});
   },

  toOrigin(router, route){
  
    if (route.query.from && route.query.from != "/login" && route.query.from != "/logout") {
        // authentication, redirect to original route
        console.log("Redirecting to original route")
        router.push({ path: route.query.from }).catch(err => { });
     } else {
        // is there a route name?
        console.log("No original route")
        if (route.name) {
           // we don't allow origin for login/logout & schema
           if (route.name == "/login" || route.name == "/logout" || route.name == '/schema') {
              Navigate.toHome(router,route);
           } else {
              Navigate.toPath(router,route.fullPath)
           }
        } else {
           // default home
           Navigate.toHome(router,route);
        }
     }
  }
};

export default Navigate;
