import { createRouter, createWebHashHistory } from 'vue-router';
import Home from './pages/Home.vue';
import Editor from './pages/Editor.vue';
import Settings from './pages/Settings.vue';

const routes = [
    {
        path: '/',
        name: 'Home',
        component: Home
    },
    {
        path: '/editor',
        name: 'Editor',
        component: Editor
    },
    {
        path: '/settings',
        name: 'Settings',
        component: Settings
    }
];

const router = createRouter({
    history: createWebHashHistory(),
    routes
});

export default router;
