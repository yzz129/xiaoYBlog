import { App } from "vue";
import IconSvg from "./icon-svg/index.vue";
import BaseLayout from "./base-layout/index.vue";
import AntDesignVueComponents from "./third/ant-design-vue";
import ElementComponents from "./third/element";

export default {
    install(app: App): App {
        app.component("IconSvg", IconSvg);
        app.component("BaseLayout", BaseLayout);

        app.use(AntDesignVueComponents);
        app.use(ElementComponents);
        return app;
    },
};
