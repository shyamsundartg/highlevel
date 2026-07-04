import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "../stores/auth";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/login",
      name: "login",
      component: () => import("../views/LoginView.vue"),
      meta: { public: true },
    },
    {
      path: "/",
      redirect: "/projects",
    },
    {
      path: "/projects",
      name: "projects",
      component: () => import("../views/ProjectsView.vue"),
    },
    {
      path: "/projects/:projectId",
      name: "workspace",
      component: () => import("../views/WorkspaceView.vue"),
    },
  ],
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  if (!auth.ready) {
    await auth.init();
  }

  if (!to.meta.public && !auth.user) {
    return { name: "login", query: { redirect: to.fullPath } };
  }

  if (to.name === "login" && auth.user) {
    return { name: "projects" };
  }

  return true;
});

export default router;
