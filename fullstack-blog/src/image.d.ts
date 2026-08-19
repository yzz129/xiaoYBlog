declare module "*.svg";
declare module "*.png";
declare module "*.jpg";
declare module "*.jpeg";
declare module "*.webp";

declare module "mammoth/mammoth.browser" {
    export function extractRawText(input: { arrayBuffer: ArrayBuffer }): Promise<{
        value: string;
        messages: unknown[];
    }>;
}
