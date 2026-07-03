/**
 * @author: 小Y
 * @description: 入口文件
 */
import "./styles/index.scss";
import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import { createPinia } from "pinia";
import globalComponents from "./components";
import "ant-design-vue/dist/reset.css";
import "element-plus/theme-chalk/base.css";
import "element-plus/theme-chalk/el-image.css";

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(router);
app.use(globalComponents);
app.mount("#app");
