/**
 * @author: 小Y
 * @description: 全局注册项目中常用的 Ant Design Vue 组件
 */
import { App } from "vue";
import {
    Avatar,
    Badge,
    Breadcrumb,
    Button,
    Card,
    Checkbox,
    Col,
    ConfigProvider,
    Divider,
    Drawer,
    Dropdown,
    Empty,
    Form,
    Image,
    Input,
    Layout,
    Menu,
    Modal,
    Pagination,
    Radio,
    Result,
    Row,
    Select,
    Skeleton,
    Space,
    Spin,
    Table,
    Tag,
    Timeline,
    Upload,
} from "ant-design-vue";

const components = [
    Avatar,
    Badge,
    Breadcrumb,
    Button,
    Card,
    Checkbox,
    Col,
    ConfigProvider,
    Divider,
    Drawer,
    Dropdown,
    Empty,
    Form,
    Image,
    Input,
    Layout,
    Menu,
    Modal,
    Pagination,
    Radio,
    Result,
    Row,
    Select,
    Skeleton,
    Space,
    Spin,
    Table,
    Tag,
    Timeline,
    Upload,
];

export default {
    install(app: App): App {
        components.forEach((component) => {
            app.use(component);
        });
        return app;
    },
};
