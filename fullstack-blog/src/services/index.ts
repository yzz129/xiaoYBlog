/* eslint-disable no-case-declarations */
/* eslint-disable camelcase */
import axios from "axios";
import { message } from "ant-design-vue";
import qs from "qs";

import { PlainObject } from "@/bean/base";
import { CommonResponse } from "@/bean/xhr";
import { eventBus } from "@/utils/eventbus";
import { requestParamsFilter } from "@/utils/helper";

enum InnerCode {
    Unauthorized = "000001",
    TokenExpired = "000002",
    Forbidden = "000003",
}

const api = axios.create({
    baseURL: "/api",
    timeout: 20000,
});

function getToken(): string {
    if (typeof document === "undefined") {
        return "";
    }
    return localStorage.getItem("token") || "";
}

function redirectToLogin() {
    if (window.location.pathname !== "/login") {
        window.location.assign("/login");
    }
}

api.defaults.headers.common["Content-Type"] = "application/x-www-form-urlencoded";
api.defaults.transformRequest = (data) => qs.stringify(data, { encode: true });

api.interceptors.request.use((config) => {
    const token = getToken();
    if (token) {
        config.headers["Authorization"] = `Bearer ${token}`;
    }
    return config;
});

api.interceptors.response.use(
    (response) => {
        const res = response.data;
        const { code, msg } = res;

        if (code === "0") {
            return Promise.resolve(res);
        }

        switch (code) {
            case InnerCode.Unauthorized:
            case InnerCode.TokenExpired:
            case InnerCode.Forbidden:
                eventBus.emit("sessionInvalid");
                redirectToLogin();
                break;
        }

        if (msg) {
            message.error(msg);
        }

        return Promise.reject(res);
    },
    (error) => {
        if (String(error).includes("timeout")) {
            message.error("网络请求超时，请检查网络连接。");
            return Promise.reject(error);
        }

        if (error.response) {
            switch (error.response.status) {
                case 400:
                    message.error("请求参数有误，请稍后重试。");
                    break;
                case 401:
                    message.error("未登录或登录已失效，请重新登录。");
                    break;
                case 403:
                    message.error("无权限访问该资源。");
                    break;
                case 404:
                    message.error("请求的资源不存在。");
                    break;
                case 502:
                case 503:
                case 504:
                    message.error("服务暂时不可用，请稍后重试。");
                    break;
                case 500:
                default:
                    message.error(error.response.data?.message || "系统内部错误，请稍后重试。");
                    break;
            }
        } else {
            message.error("网络连接失败，请检查网络后重试。");
        }

        return Promise.reject(error);
    }
);

export class ApiService {
    private feature: string;

    constructor(feature: string) {
        this.feature = feature;
    }

    protected $get<T extends CommonResponse>(action: string, params: PlainObject = {}, config: PlainObject = {}): Promise<T> {
        return api.get(`/${this.feature}/${action}`, {
            ...config,
            params: requestParamsFilter(params, true),
        });
    }

    protected $del<T extends CommonResponse>(action: string, params: PlainObject = {}, config: PlainObject = {}): Promise<T> {
        return api.delete(`/${this.feature}/${action}`, {
            ...config,
            params: requestParamsFilter(params, true),
        });
    }

    protected $delJson<T extends CommonResponse>(action: string, params: PlainObject = {}, config: PlainObject = {}): Promise<T> {
        const defaultConfig = {
            headers: { "Content-Type": "application/json" },
            transformRequest: (data: PlainObject) => JSON.stringify(data),
        };

        return api.delete(`/${this.feature}/${action}`, {
            ...defaultConfig,
            ...config,
            data: requestParamsFilter(params),
        });
    }

    protected $post<T extends CommonResponse>(action: string, params: PlainObject = {}, config: PlainObject = {}): Promise<T> {
        return api.post(`/${this.feature}/${action}`, requestParamsFilter(params), config);
    }

    protected $postJson<T extends CommonResponse>(action: string, params: PlainObject = {}, config: PlainObject = {}): Promise<T> {
        const defaultConfig = {
            headers: { "Content-Type": "application/json" },
            transformRequest: (data: PlainObject) => JSON.stringify(data),
        };

        return api.post(`/${this.feature}/${action}`, requestParamsFilter(params), { ...defaultConfig, ...config });
    }

    protected $upload<T extends CommonResponse>(
        action: string,
        params: FormData = new FormData(),
        config: PlainObject = {
            headers: { "Content-Type": "multipart/form-data" },
            transformRequest: null,
        }
    ): Promise<T> {
        return api.post(`/${this.feature}/${action}`, params, config);
    }

    protected $put<T extends CommonResponse>(action: string, params: PlainObject = {}, config: PlainObject = {}): Promise<T> {
        return api.put(`/${this.feature}/${action}`, requestParamsFilter(params), config);
    }

    protected $putJson<T extends CommonResponse>(action: string, params: PlainObject = {}, config: PlainObject = {}): Promise<T> {
        const defaultConfig = {
            headers: { "Content-Type": "application/json" },
            transformRequest: (data: PlainObject) => JSON.stringify(data),
        };

        return api.put(`/${this.feature}/${action}`, params, { ...defaultConfig, ...config });
    }

    protected $patch<T extends CommonResponse>(action: string, params: PlainObject = {}, config: PlainObject = {}): Promise<T> {
        return api.patch(`/${this.feature}/${action}`, requestParamsFilter(params), config);
    }

    protected $patchJson<T extends CommonResponse>(action: string, params: PlainObject = {}, config: PlainObject = {}): Promise<T> {
        const defaultConfig = {
            headers: { "Content-Type": "application/json" },
            transformRequest: (data: PlainObject) => JSON.stringify(data),
        };

        return this.$patch(action, params, { ...defaultConfig, ...config });
    }
}
