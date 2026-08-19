import { App } from "vue";
import IconSvg from "./icon-svg/index.vue";
import BaseLayout from "./base-layout/index.vue";
import AntDesignVueComponents from "./third/ant-design-vue";

export default {
    install(app: App): App {
        app.component("IconSvg", IconSvg);
        app.component("BaseLayout", BaseLayout);

        app.use(AntDesignVueComponents);
        return app;
    },
};
