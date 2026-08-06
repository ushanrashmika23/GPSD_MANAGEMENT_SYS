export type Role = "admin" | "staff";

export type NavSection =
  | "dashboard"
  | "students"
  | "batches"
  | "attendance"
  | "fees"
  | "marks"
  | "materials"
  | "lessons"
  | "qrcodes"
  | "communication"
  | "reports"
  | "users"
  | "settings";

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  lastLogin?: string;
}

export interface Batch {
  id: string;
  name: string;
  fee: number;
  startTime: string;
  endTime: string;
  examDate: string;   // "YYYY-MM-DD"
  active: boolean;
  day: string;
}

export interface Student {
  id: string;
  callupNo: string;
  fullName: string;
  email: string;
  school: string;
  address: string;
  nic: string;
  mobile: string;
  parentName: string;
  parentMobile: string;
  notes: string;
  active: boolean;
  registrationDate: string;
  batchIds: string[];
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  batchId: string;
  date: string;
  present: boolean;
}

export interface Payment {
  id: string;
  studentId: string;
  batchId: string;
  month: string;
  amount: number;
  receiptNo: string;
  date: string;
}

export interface Paper {
  id: string;
  name: string;
  batchId: string;
  date: string;
  totalMarks: number;
  published: boolean;
}

export interface Mark {
  id: string;
  paperId: string;
  studentId: string;
  marks: number;
}

export interface Material {
  id: string;
  title: string;
  description?: string;
  type: "DOCUMENT" | "VIDEO";
  url: string;
  batchIds: string[];
  batchNames: { id: string; name: string }[];
  lessonId: string;
  lessonName?: string;
  lessonType?: string;
  uploadDate: string;
  expiryDate: string | null;
  accessCount: number;
}

// export interface Lesson {
//   id: string;
//   title: string;
//   topic: string;
//   batchIds: string[];
//   date: string;
// }

export interface CMessage {
  id: string;
  type: "whatsapp" | "email" | "sms";
  subject: string;
  content: string;
  batchIds: string[];
  sentDate: string;
  status: "sent" | "scheduled" | "failed";
}

export interface AppState {
  students: Student[];
  batches: Batch[];
  attendance: AttendanceRecord[];
  payments: Payment[];
  papers: Paper[];
  marks: Mark[];
  materials: Material[];
  // lessons: Lesson[];
  messages: CMessage[];
  users: AppUser[];
  setStudents: React.Dispatch<React.SetStateAction<Student[]>>;
  setBatches: React.Dispatch<React.SetStateAction<Batch[]>>;
  setAttendance: React.Dispatch<React.SetStateAction<AttendanceRecord[]>>;
  setPayments: React.Dispatch<React.SetStateAction<Payment[]>>;
  setPapers: React.Dispatch<React.SetStateAction<Paper[]>>;
  setMarks: React.Dispatch<React.SetStateAction<Mark[]>>;
  setMaterials: React.Dispatch<React.SetStateAction<Material[]>>;
  // setLessons: React.Dispatch<React.SetStateAction<Lesson[]>>;
  setMessages: React.Dispatch<React.SetStateAction<CMessage[]>>;
  setUsers: React.Dispatch<React.SetStateAction<AppUser[]>>;
}
