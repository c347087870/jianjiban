import { createApp } from 'vue';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import zhCn from 'element-plus/dist/locale/zh-cn.mjs';
import * as ElementPlusIconsVue from '@element-plus/icons-vue';
import App from './App.vue';
import router from './router';
import './assets/index.css';

// 创建 Vue 应用实例
const app = createApp(App);

// 注册 Element Plus 并配置中文语言
app.use(ElementPlus, {
    locale: zhCn,
});

// 注册所有图标为全局组件
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
    app.component(key, component);
}

// 注册路由
app.use(router);

// 挂载应用
app.mount('#app');
