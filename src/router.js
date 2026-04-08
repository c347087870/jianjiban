import { createRouter, createWebHashHistory } from 'vue-router';
import Home from './pages/Home.vue';
import Editor from './pages/Editor.vue';
import Settings from './pages/Settings.vue';
import Tooltip from './pages/Tooltip.vue';

// 路由配置数组
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
    },
    {
        path: '/tooltip',
        name: 'Tooltip',
        component: Tooltip
    }
];

// 创建路由实例
const router = createRouter({
    history: createWebHashHistory(),
    routes
});

export default router;
