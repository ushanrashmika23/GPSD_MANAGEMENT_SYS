import api from "./axios";
import type { Lesson } from "../lib/types";

//=====================================API calls for authentication===========================================

// Send the Google ID token to the backend, get a JWT back
const firebaseLogin = async (idToken: string): Promise<any> => {
    try {
        const response = await api.post("/auth/firebase-login", { idToken });
        return response.data;
    } catch (error) {
        console.error("Error during Firebase login:", error);
        throw error;
    }
};

// Restore the session from the JWT stored in localStorage (attached automatically by the axios interceptor)
const autoLogin = async (): Promise<any> => {
    try {
        const response = await api.post("/auth/auto-login");
        return response.data;
    } catch (error) {
        console.error("Error during auto login:", error);
        throw error;
    }
};

//=====================================API call for manipulating lessons===========================================

//API call to get all lessons with pagination and search
const getAllLessons = async (page: number = 1, limit: number = 50, search: string = ""): Promise<any> => {
    try {
        const response = await api.get(`/lessons?page=${page}&limit=${limit}&search=${search}`);
        return response.data;
    } catch (error) {
        console.error("Error fetching lessons:", error);
        throw error;
    }
};
//API call to update a lesson
const updateLesson = async (lessonId: string, updatedData: Partial<Lesson>): Promise<any> => {
    const data = {
        title: updatedData.title,
        description: updatedData.description,
        type: updatedData.type,
    };
    try {
        const response = await api.put(`/lessons/${lessonId}`, data);
        console.log(data);

        return response.data;
    } catch (error) {
        console.error("Error updating lesson:", error);
        throw error;
    }
}
//API call to delete a lesson
const deleteLesson = async (lessonId: string): Promise<any> => {
    try {
        const response = await api.delete(`/lessons/${lessonId}`);
        return response.data;
    } catch (error) {
        console.error("Error deleting lesson:", error);
        throw error;
    }
};
//API call to add a new lesson
const addLesson = async (newLesson: Partial<Lesson>): Promise<any> => {
    const data = {
        title: newLesson.title,
        description: newLesson.description,
        type: newLesson.type,
    };
    console.log(data);

    try {
        const response = await api.post(`/lessons`, data);
        return response.data;
    } catch (error) {
        console.error("Error adding lesson:", error);
        throw error;
    }
};


//================================ALL CALLS FOR MANIPULATING BATCHES=====================================================

const getAllBatches = async (page: number = 1, limit: number = 50, search: string = ""): Promise<any> => {
    try {
        const response = await api.get(`/batches?page=${page}&limit=${limit}&search=${search}`);
        return response.data;
    } catch (error) {
        console.error("Error fetching batches:", error);
        throw error;
    }
};

// Map frontend camelCase → backend snake_case
interface BatchFormData {
    name?: string;
    examDate?: string;   // ISO date string for exam_date
    fee?: number;        // → class_fee
    startTime?: string;  // → start_time
    endTime?: string;    // → end_time
    active?: boolean;    // → is_active
    day?: string;        // → day
}

const addBatch = async (batchData: BatchFormData): Promise<any> => {
    const data = {
        name: batchData.name,
        exam_date: batchData.examDate,
        class_fee: batchData.fee,
        start_time: batchData.startTime,
        end_time: batchData.endTime,
        is_active: batchData.active,
        day: batchData.day,
    };
    try {
        const response = await api.post("/batches", data);
        return response.data;
    } catch (error) {
        console.error("Error adding batch:", error);
        throw error;
    }
};

const updateBatch = async (batchId: string, batchData: BatchFormData): Promise<any> => {
    const data = {
        name: batchData.name,
        exam_date: batchData.examDate,
        class_fee: batchData.fee,
        start_time: batchData.startTime,
        end_time: batchData.endTime,
        is_active: batchData.active,
        day: batchData.day,
    };
    try {
        const response = await api.put(`/batches/${batchId}`, data);
        return response.data;
    } catch (error) {
        console.error("Error updating batch:", error);
        throw error;
    }
};

const deleteBatch = async (batchId: string): Promise<any> => {
    try {
        const response = await api.delete(`/batches/${batchId}`);
        return response.data;
    } catch (error) {
        console.error("Error deleting batch:", error);
        throw error;
    }
};

//================================ALL CALLS FOR MANIPULATING STUDENTS====================================================

const addStudent = async (studentData: any): Promise<any> => {
    const data = {
        email: studentData.email,
        password: studentData.password,
        callUpNo: studentData.callupNo,
        firstName: studentData.firstName,
        lastName: studentData.lastName,
        school: studentData.school,
        address: studentData.address,
        mobile: studentData.mobile,
        parentName: studentData.parentName,
        parentMobile: studentData.parentMobile,
        batchId: studentData.batchId,
    };

    try {
        const response = await api.post("/students", data);
        return response.data;
    } catch (error) {
        console.error("Error adding student:", error);
        throw error;
    }
}

const getAllStudents = async (page: number = 1, limit: number = 50, search: string = "", batchId: string = ""): Promise<any> => {
    try {
        const response = await api.get(`/students?page=${page}&limit=${limit}&search=${search}&batch_id=${batchId}`);
        return response.data;
    } catch (error) {
        console.error("Error fetching students:", error);
        throw error;
    }
}

const getStudentById = async (studentId: string): Promise<any> => {
    try {
        const response = await api.get(`/students/${studentId}`);
        return response.data;
    } catch (error) {
        console.error("Error fetching student by ID:", error);
        throw error;
    }
}

const updateStudent = async (studentId: string, studentData: any): Promise<any> => {
    const data: Record<string, any> = {
        firstName: studentData.firstName,
        lastName: studentData.lastName,
        mobile: studentData.mobile,
        address: studentData.address,
        callUpNo: studentData.callupNo,
        school: studentData.school,
        parentName: studentData.parentName,
        parentMobile: studentData.parentMobile,
        batchId: studentData.batchId ?? studentData.batchIds?.[0],
    };
    // Only include isActive if explicitly set (boolean)
    if (typeof studentData.active === "boolean") {
        data.isActive = studentData.active;
    }

    try {
        const response = await api.put(`/students/${studentId}`, data);
        return response.data;
    } catch (error) {
        console.error("Error updating student:", error);
        throw error;
    }
}

const deleteStudent = async (studentId: string): Promise<any> => {
    try {
        const response = await api.delete(`/students/${studentId}`);
        return response.data;
    } catch (error) {
        console.error("Error deleting student:", error);
        throw error;
    }
}


const resetStudentPassword = async (studentId: string, newPassword: string): Promise<any> => {
    try {
        const response = await api.put(`/students/${studentId}/reset-password`, { password: newPassword });
        return response.data;
    } catch (error) {
        console.error("Error resetting student password:", error);
        throw error;
    }
}


//================================ALL CALLS FOR ATTENDANCE====================================================

const getTodayClasses = async (day: string = ""): Promise<any> => {
    try {
        const response = await api.get(`/attendance/today?day=${day}`);
        return response.data;
    } catch (error) {
        console.error("Error fetching today classes:", error);
        throw error;
    }
};

const createNewDay = async (date: string, batchId: string): Promise<any> => {
    try {
        const response = await api.post("/attendance/new-day", { date, batch_id: batchId });
        return response.data;
    } catch (error) {
        console.error("Error creating new day:", error);
        throw error;
    }
};

const markAttendance = async (callUpNo: string): Promise<any> => {
    try {
        const response = await api.post("/attendance/mark-attendance", { call_up_no: callUpNo });
        return response.data;
    } catch (error) {
        console.error("Error marking attendance:", error);
        throw error;
    }
};

const unmarkAttendance = async (callUpNo: string): Promise<any> => {
    try {
        const response = await api.post("/attendance/unmark-attendance", { call_up_no: callUpNo });
        return response.data;
    } catch (error) {
        console.error("Error unmarking attendance:", error);
        throw error;
    }
};

const getAttendanceHistory = async (page: number = 1, limit: number = 12): Promise<any> => {
    try {
        const response = await api.get(`/attendance/history?page=${page}&limit=${limit}`);
        return response.data;
    } catch (error) {
        console.error("Error fetching attendance history:", error);
        throw error;
    }
};

const deleteClassDay = async (classDayId: string): Promise<any> => {
    try {
        const response = await api.delete(`/attendance/class-day/${classDayId}`);
        return response.data;
    } catch (error) {
        console.error("Error deleting class day:", error);
        throw error;
    }
};


//================================ALL CALLS FOR MANIPULATING PAYMENTS====================================================

const getAllPayments = async (page: number = 1, limit: number = 500, search: string = ""): Promise<any> => {
    try {
        const response = await api.get(`/fees/payments?page=${page}&limit=${limit}&search=${search}`);
        return response.data;
    } catch (error) {
        console.error("Error fetching payments:", error);
        throw error;
    }
};

const createPayment = async (paymentData: { amount: number; month: string; call_up_no: string }): Promise<any> => {
    try {
        const response = await api.post("/fees/payments", {
            amount: paymentData.amount,
            month: paymentData.month,
            call_up_no: paymentData.call_up_no,
        });
        return response.data;
    } catch (error) {
        console.error("Error creating payment:", error);
        throw error;
    }
};

const getStudentPaymentData = async (callUpNo: string): Promise<any> => {
    try {
        const response = await api.get(`/fees/payments/student/${callUpNo}`);
        return response.data;
    } catch (error) {
        console.error("Error fetching student payment data:", error);
        throw error;
    }
};

const deletePayment = async (paymentId: number): Promise<any> => {
    try {
        const response = await api.delete(`/fees/payments/${paymentId}`);
        return response.data;
    } catch (error) {
        console.error("Error deleting payment:", error);
        throw error;
    }
};

//================================ALL CALLS FOR MANIPULATING MATERIALS====================================================

const getAllMaterials = async (page: number = 1, limit: number = 12, search: string = "", batchId: string = "", contentType: string = "", lessonId: string = ""): Promise<any> => {
    try {
        // params (not a hand-built query string) so axios URL-encodes the
        // search text — spaces and special characters reach the backend intact.
        const response = await api.get("/materials", {
            params: {
                page,
                limit,
                search: search || undefined,
                batch_id: batchId || undefined,
                content_type: contentType || undefined,
                lesson_id: lessonId || undefined,
            },
        });
        return response.data;
    } catch (error) {
        console.error("Error fetching materials:", error);
        throw error;
    }
};

const addMaterial = async (formData: FormData, onUploadProgress?: (progressEvent: ProgressEvent) => void): Promise<any> => {
    try {
        const response = await api.post("/materials", formData, {
            headers: { "Content-Type": "multipart/form-data" },
            timeout: 120000, // 2 minutes for file uploads
            onUploadProgress,
        });
        return response.data;
    } catch (error) {
        console.error("Error adding material:", error);
        throw error;
    }
};

const updateMaterial = async (materialId: string, data: Record<string, any>): Promise<any> => {
    try {
        const response = await api.put(`/materials/${materialId}`, data);
        return response.data;
    } catch (error) {
        console.error("Error updating material:", error);
        throw error;
    }
};

const deleteMaterial = async (materialId: string): Promise<any> => {
    try {
        const response = await api.delete(`/materials/${materialId}`);
        return response.data;
    } catch (error) {
        console.error("Error deleting material:", error);
        throw error;
    }
};

// GET /materials/:id/signed-url — a short-lived signed R2 URL for the
// material's file. Video playback streams straight from this URL.
const getMaterialSignedUrl = async (materialId: string): Promise<{ url: string; type: string }> => {
    try {
        const response = await api.get(`/materials/${materialId}/signed-url`);
        return response.data?.data;
    } catch (error) {
        console.error("Error fetching material signed URL:", error);
        throw error;
    }
};

// GET /materials/:id/file — fetch the document's bytes THROUGH the backend (so
// the R2 bucket needs no CORS for pdf.js's XHR fetch) and hand the PDF viewer a
// local blob URL. Callers should revoke the URL when done.
const getMaterialFileBlobUrl = async (materialId: string): Promise<string> => {
    try {
        const response = await api.get(`/materials/${materialId}/file`, {
            responseType: "blob",
        });
        const blob =
            response.data instanceof Blob
                ? response.data
                : new Blob([response.data], { type: "application/pdf" });
        return URL.createObjectURL(blob);
    } catch (error) {
        console.error("Error fetching material file:", error);
        throw error;
    }
};

//================================ALL CALLS FOR DIRECT-TO-R2 UPLOADS====================================================
// The bulk upload manager sends file bytes straight to R2 with presigned part
// URLs — these calls only orchestrate (open / sign / list / complete / abort),
// so no file data passes through the API.

// POST /uploads/init — open a multipart upload, receive key + uploadId + partSize
const initUpload = async (payload: { fileName: string; contentType: string; size: number; type: string }): Promise<any> => {
    try {
        const response = await api.post("/uploads/init", payload);
        return response.data;
    } catch (error) {
        console.error("Error starting upload:", error);
        throw error;
    }
};

// POST /uploads/sign-parts — presigned PUT URLs for the given part numbers
const signUploadParts = async (payload: { key: string; uploadId: string; partNumbers: number[] }): Promise<any> => {
    try {
        const response = await api.post("/uploads/sign-parts", payload);
        return response.data;
    } catch (error) {
        console.error("Error signing part URLs:", error);
        throw error;
    }
};

// POST /uploads/list-parts — what R2 already holds (source of truth when resuming)
const listUploadParts = async (payload: { key: string; uploadId: string }): Promise<any> => {
    try {
        const response = await api.post("/uploads/list-parts", payload);
        return response.data;
    } catch (error) {
        // A 404 means the upload no longer exists server-side (aborted/expired).
        // Callers handle that as a normal "start over" signal, so return the
        // prepared response instead of throwing.
        if (error?.response?.status === 404) {
            return error.response.data;
        }
        console.error("Error listing uploaded parts:", error);
        throw error;
    }
};

// POST /uploads/complete — assemble the uploaded parts into the final object
const completeUpload = async (payload: { key: string; uploadId: string; parts: { partNumber: number; etag: string }[] }): Promise<any> => {
    try {
        const response = await api.post("/uploads/complete", payload);
        return response.data;
    } catch (error) {
        console.error("Error completing upload:", error);
        throw error;
    }
};

// POST /uploads/abort — discard an in-progress upload and free its parts
const abortUpload = async (payload: { key: string; uploadId: string }): Promise<any> => {
    try {
        const response = await api.post("/uploads/abort", payload);
        return response.data;
    } catch (error) {
        console.error("Error aborting upload:", error);
        throw error;
    }
};

// POST /materials/bulk — create material rows for files already uploaded to R2
const registerMaterialsBulk = async (materials: {
    title: string;
    description?: string;
    type: string;
    lesson_id: string;
    key: string;
    size?: number;
}[]): Promise<any> => {
    try {
        const response = await api.post("/materials/bulk", { materials });
        return response.data;
    } catch (error) {
        console.error("Error registering materials:", error);
        throw error;
    }
};

//================================ALL CALLS FOR MATERIAL ACCESS====================================================

const getMaterialAccesses = async (materialId: string): Promise<any> => {
    try {
        const response = await api.get(`/access/${materialId}`);
        return response.data;
    } catch (error) {
        console.error("Error fetching material accesses:", error);
        throw error;
    }
};

const grantBatchAccess = async (material_id: string, batch_id: string, expiry_date: string): Promise<any> => {
    try {
        const response = await api.post("/access/grant", { material_id, batch_id, expiry_date });
        return response.data;
    } catch (error) {
        console.error("Error granting batch access:", error);
        throw error;
    }
};

const revokeBatchAccess = async (access_id: string): Promise<any> => {
    try {
        const response = await api.post("/access/revoke", { access_id });
        return response.data;
    } catch (error) {
        console.error("Error revoking batch access:", error);
        throw error;
    }
};

//================================ALL CALLS FOR MARKS / PAPERS====================================================

const getAllPapers = async (page: number = 1, limit: number = 12, batchId: string = "", search: string = ""): Promise<any> => {
    try {
        // params (not a hand-built query string) so axios URL-encodes the
        // search text — spaces and special characters reach the backend intact.
        const response = await api.get("/marks/papers", {
            params: {
                page,
                limit,
                batch_id: batchId || undefined,
                search: search || undefined,
            },
        });
        return response.data;
    } catch (error) {
        console.error("Error fetching papers:", error);
        throw error;
    }
};

const createPaper = async (data: Record<string, any>): Promise<any> => {
    try {
        const response = await api.post("/marks/paper", data);
        return response.data;
    } catch (error) {
        console.error("Error creating paper:", error);
        throw error;
    }
};

const createMark = async (data: Record<string, any>): Promise<any> => {
    try {
        const response = await api.post("/marks/mark", data);
        return response.data;
    } catch (error) {
        console.error("Error creating mark:", error);
        throw error;
    }
};

const updateMarkApi = async (data: Record<string, any>): Promise<any> => {
    try {
        const response = await api.put("/marks/mark", data);
        return response.data;
    } catch (error) {
        console.error("Error updating mark:", error);
        throw error;
    }
};

const getMarksByPaper = async (paperId: string): Promise<any> => {
    try {
        const response = await api.get(`/marks/mark/${paperId}`);
        return response.data;
    } catch (error) {
        console.error("Error fetching marks:", error);
        throw error;
    }
};

const togglePublishMark = async (paperId: string): Promise<any> => {
    try {
        const response = await api.put(`/marks/paper/${paperId}/publish`);
        return response.data;
    } catch (error) {
        console.error("Error toggling publish:", error);
        throw error;
    }
};

const updatePaperApi = async (paperId: string, data: Record<string, any>): Promise<any> => {
    try {
        const response = await api.put(`/marks/paper/${paperId}`, data);
        return response.data;
    } catch (error) {
        console.error("Error updating paper:", error);
        throw error;
    }
};

const deletePaperApi = async (paperId: string): Promise<any> => {
    try {
        const response = await api.delete(`/marks/paper/${paperId}`);
        return response.data;
    } catch (error) {
        console.error("Error deleting paper:", error);
        throw error;
    }
};

//================================ALL CALLS FOR STATS / REPORTS====================================================
// Aggregate figures behind the Dashboard and Reports pages. Each returns the
// wire body {success, msg, data} — these payloads are FLAT, so callers read
// `res.data` (unlike the paged endpoints, which nest {data, meta} and are read
// as `res.data.data`).

// Dashboard KPIs in one call. Staff receive `finance: null`.
const getStatsOverview = async (): Promise<any> => {
    try {
        const response = await api.get("/stats/overview");
        return response.data;
    } catch (error) {
        console.error("Error fetching overview stats:", error);
        throw error;
    }
};

// Admin only — a staff token gets a 403 from the server.
const getFinanceStats = async (months: number = 6, batchId: string = ""): Promise<any> => {
    try {
        const response = await api.get("/stats/finance", {
            params: { months, batch_id: batchId || undefined },
        });
        return response.data;
    } catch (error) {
        console.error("Error fetching finance stats:", error);
        throw error;
    }
};

const getPerformanceStats = async (batchId: string = ""): Promise<any> => {
    try {
        const response = await api.get("/stats/performance", {
            params: { batch_id: batchId || undefined },
        });
        return response.data;
    } catch (error) {
        console.error("Error fetching performance stats:", error);
        throw error;
    }
};

const getAttendanceStats = async (months: number = 6, batchId: string = ""): Promise<any> => {
    try {
        const response = await api.get("/stats/attendance", {
            params: { months, batch_id: batchId || undefined },
        });
        return response.data;
    } catch (error) {
        console.error("Error fetching attendance stats:", error);
        throw error;
    }
};

//================================ALL CALLS FOR MANIPULATING USERS (ADMIN / STAFF)====================================================

interface UserFormData {
    email?: string;
    password?: string;
    firstName?: string;
    lastName?: string;
    mobile?: string;
    address?: string;
    role?: string;
    isActive?: boolean;
}

const getAllUsers = async (page: number = 1, limit: number = 50, search: string = ""): Promise<any> => {
    try {
        const response = await api.get(`/users?page=${page}&limit=${limit}&search=${search}`);
        return response.data;
    } catch (error) {
        console.error("Error fetching users:", error);
        throw error;
    }
};

const addUser = async (userData: UserFormData): Promise<any> => {
    const data = {
        email: userData.email,
        password: userData.password,
        firstName: userData.firstName,
        lastName: userData.lastName,
        mobile: userData.mobile,
        address: userData.address,
        role: userData.role,
    };
    try {
        const response = await api.post("/users", data);
        return response.data;
    } catch (error) {
        console.error("Error adding user:", error);
        throw error;
    }
};

const updateUser = async (userId: string, userData: UserFormData): Promise<any> => {
    const data: Record<string, any> = {};
    if (userData.email !== undefined) data.email = userData.email;
    if (userData.firstName !== undefined) data.firstName = userData.firstName;
    if (userData.lastName !== undefined) data.lastName = userData.lastName;
    if (userData.mobile !== undefined) data.mobile = userData.mobile;
    if (userData.address !== undefined) data.address = userData.address;
    if (userData.role !== undefined) data.role = userData.role;
    // Only include isActive if explicitly set (boolean)
    if (typeof userData.isActive === "boolean") {
        data.isActive = userData.isActive;
    }
    try {
        const response = await api.put(`/users/${userId}`, data);
        return response.data;
    } catch (error) {
        console.error("Error updating user:", error);
        throw error;
    }
};

const resetUserPassword = async (userId: string, newPassword: string): Promise<any> => {
    try {
        const response = await api.put(`/users/${userId}/reset-password`, { password: newPassword });
        return response.data;
    } catch (error) {
        console.error("Error resetting user password:", error);
        throw error;
    }
};

export { firebaseLogin, autoLogin, getAllStudents, getStudentById, updateStudent, deleteStudent, resetStudentPassword, getAllLessons, updateLesson, deleteLesson, addLesson, getAllBatches, addBatch, updateBatch, deleteBatch, addStudent, getTodayClasses, createNewDay, markAttendance, unmarkAttendance, getAttendanceHistory, deleteClassDay, getAllPayments, createPayment, getStudentPaymentData, deletePayment, getAllMaterials, addMaterial, updateMaterial, deleteMaterial, getMaterialSignedUrl, getMaterialFileBlobUrl, initUpload, signUploadParts, listUploadParts, completeUpload, abortUpload, registerMaterialsBulk, getMaterialAccesses, grantBatchAccess, revokeBatchAccess, getAllPapers, createPaper, createMark, updateMarkApi, getMarksByPaper, togglePublishMark, updatePaperApi, deletePaperApi, getStatsOverview, getFinanceStats, getPerformanceStats, getAttendanceStats, getAllUsers, addUser, updateUser, resetUserPassword };