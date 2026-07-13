/**
 * @author: 小Y
 * @description: 入口文件
 */
import "./styles/index.scss";
// 中文使用清爽手写体，英文与数字使用圆润字体；字体随应用本地打包，不依赖外部 CDN。
import "lxgw-wenkai-webfont/lxgwwenkai-regular.css";
import "lxgw-wenkai-webfont/lxgwwenkai-bold.css";
import "@fontsource-variable/nunito/index.css";
import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import { createPinia } from "pinia";
import globalComponents from "./components";
import "ant-design-vue/dist/reset.css";
import "element-plus/theme-chalk/base.css";
import "element-plus/theme-chalk/el-image.css";
import "element-plus/theme-chalk/el-scrollbar.css";

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(router);
app.use(globalComponents);
app.mount("#app");
