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

  toPath(router,path,query) {
      console.log("Redirecting to page")
      router.push({ name: path, query: query }).catch((err) => {});
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
           // if authenticated but on login page, redirect to home
           // console.log("Route name found")
           if (route.name == "/login" || route.name == "/logout") {
              Navigate.toHome(router,route);
           } else {
              router.push(route.fullPath).catch(err => { });
           }
        } else {
           // default home
           Navigate.toHome(router,route);
        }
     }
  }
};

export default Navigate;
