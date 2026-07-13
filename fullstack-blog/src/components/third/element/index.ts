/**
 * @author: 小Y
 * @description: 全局按需注册 Element Plus 组件
 */
import { App } from "vue";
import { ElImage, ElScrollbar } from "element-plus";

const components = [ElImage, ElScrollbar];

export default {
    install(app: App): App {
        components.forEach((component) => {
            if (component.name) {
                app.component(component.name, component);
            }
        });
        return app;
    },
};
