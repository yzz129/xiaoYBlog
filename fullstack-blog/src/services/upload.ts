import { ApiService } from "@/services/index";
import { RecordResponse } from "@/bean/xhr";

export interface UploadImageResponse {
    bucket: string;
    objectName: string;
    url: string;
}

class UploadService extends ApiService {
    public uploadImage(file: File, folder: "avatar" | "article-cover" | "common") {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("folder", folder);

        return this.$upload<RecordResponse<UploadImageResponse>>("image", formData);
    }
}

export const uploadService = new UploadService("upload");
