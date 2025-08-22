import { createRouter, createWebHistory } from 'vue-router';
import App from './App.vue';

const routes = [
  {
    path: '/',
    name: 'Home',
    component: App,
  },
  {
    path: '/room/:roomId',
    name: 'Room',
    component: App,
    props: true,
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
