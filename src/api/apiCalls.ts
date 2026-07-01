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


export { getAllLessons, updateLesson, deleteLesson, addLesson, getAllBatches, addBatch, updateBatch, deleteBatch };