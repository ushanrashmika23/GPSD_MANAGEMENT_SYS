import api from "./axios";
import type { Lesson } from "../components/staff/LessonsPage";

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

const getAllMaterials = async (page: number = 1, limit: number = 12, search: string = "", batchId: string = "", contentType: string = ""): Promise<any> => {
    try {
        const response = await api.get(`/materials?page=${page}&limit=${limit}&search=${search}&batch_id=${batchId}&content_type=${contentType}`);
        return response.data;
    } catch (error) {
        console.error("Error fetching materials:", error);
        throw error;
    }
};

const addMaterial = async (formData: FormData): Promise<any> => {
    try {
        const response = await api.post("/materials", formData, {
            headers: { "Content-Type": "multipart/form-data" },
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

export { getAllStudents, getStudentById, updateStudent, deleteStudent, getAllLessons, updateLesson, deleteLesson, addLesson, getAllBatches, addBatch, updateBatch, deleteBatch, addStudent, getTodayClasses, createNewDay, markAttendance, getAllPayments, createPayment, getStudentPaymentData, deletePayment, getAllMaterials, addMaterial, updateMaterial, deleteMaterial };