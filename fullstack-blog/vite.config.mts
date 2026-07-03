import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "path";
import viteCompression from "vite-plugin-compression";

export default defineConfig({
    base: "/",
    plugins: [
        vue(),
        viteCompression({
            algorithm: "gzip",
            ext: ".gz",
            threshold: 10240, // only compress files > 10KB
            deleteOriginFile: false, // keep original files for servers that support negotiated gzip
        }),
        viteCompression({
            algorithm: "brotliCompress",
            ext: ".br",
            threshold: 10240,
            deleteOriginFile: false,
        }),
    ],
    server: {
        port: 8080,
        open: true,
        proxy: {
            "/api": {
                target: "http://localhost:8002",
                changeOrigin: true,
                rewrite: (requestPath) => requestPath.replace(/^\/api/, ""),
            },
            "/socket.io": {
                target: "http://localhost:8002",
                changeOrigin: true,
                ws: true,
            },
        },
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    css: {
        preprocessorOptions: {
            less: {
                javascriptEnabled: true,
            },
            scss: {
                api: "modern-compiler",
                additionalData: '@use "@/styles/preload.scss" as *;',
            },
        },
    },
    build: {
        target: "es2020",
        sourcemap: false,
        chunkSizeWarningLimit: 900,
        cssCodeSplit: true,
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (!id.includes("node_modules")) {
                        return;
                    }

                    // ant-design-vue icon library — large but rarely changes (good cache)
                    if (id.includes("@ant-design/icons-vue") || id.includes("@ant-design/icons-svg")) {
                        return "antd-icons";
                    }

                    // ant-design-vue core dependencies
                    if (
                        id.includes("@ant-design/colors") ||
                        id.includes("@ant-design/cssinjs") ||
                        id.includes("async-validator")
                    ) {
                        return "antd-core";
                    }

                    // ant-design-vue rc-* components
                    if (id.includes("@rc-component/") || id.includes("\\rc-") || id.includes("/rc-")) return "antd-rc";

                    // ant-design-vue main library
                    if (id.includes("ant-design-vue")) return "antd";

                    // element-plus — only ElImage is used, but isolate to avoid bundling into vendor
                    if (id.includes("element-plus")) return "element";

                    // Heavy document processing libraries (lazy-loaded)
                    if (id.includes("pdfjs-dist")) return "pdf";
                    if (id.includes("mammoth")) return "mammoth";

                    // Markdown rendering (now lazy-loaded via dynamic import)
                    if (id.includes("highlight.js")) return "highlight";
                    if (id.includes("marked") || id.includes("dompurify")) return "markdown";

                    // Socket.IO
                    if (id.includes("socket.io-client")) return "socket";

                    // Date utility
                    if (id.includes("dayjs")) return "date";

                    // Lodash utilities
                    if (id.includes("lodash-es")) return "utils";

                    // Core framework (small, shared across all routes)
                    if (
                        id.includes("/vue/") ||
                        id.includes("/vue-router/") ||
                        id.includes("/pinia/") ||
                        id.includes("/axios/")
                    ) {
                        return "vendor";
                    }
                },
            },
        },
    },
});
