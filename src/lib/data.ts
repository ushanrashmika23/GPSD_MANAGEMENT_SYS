import type {
  AppUser,
  Batch,
  Student,
  AttendanceRecord,
  Payment,
  Paper,
  Mark,
  Material,
  Lesson,
  CMessage,
} from "./types";

export const INIT_USERS: AppUser[] = [
  { id: "u1", name: "Mr. Sudath Kumara", email: "admin@mathsinstitute.lk", role: "admin", active: true, lastLogin: "2025-06-14 08:45" },
  { id: "u2", name: "Ms. Dilrukshi Perera", email: "staff@mathsinstitute.lk", role: "staff", active: true, lastLogin: "2025-06-13 17:20" },
  { id: "u3", name: "Mr. Kasun Jayasinghe", email: "kasun@mathsinstitute.lk", role: "staff", active: false, lastLogin: "2025-05-10 09:00" },
];

export const INIT_BATCHES: Batch[] = [
  { id: "b1", name: "Batch A — 2025", fee: 3500, startTime: "08:00", endTime: "10:30", endYear: 2025, active: true, day: "Saturday" },
  { id: "b2", name: "Batch B — 2025", fee: 3500, startTime: "11:00", endTime: "13:30", endYear: 2025, active: true, day: "Saturday" },
  { id: "b3", name: "Batch C — 2025", fee: 3500, startTime: "08:00", endTime: "10:30", endYear: 2025, active: true, day: "Sunday" },
  { id: "b4", name: "Batch D — 2024 (Repeat)", fee: 3000, startTime: "14:00", endTime: "16:30", endYear: 2024, active: false, day: "Sunday" },
  { id: "b5", name: "Batch E — 2025", fee: 3500, startTime: "08:00", endTime: "10:30", endYear: 2025, active: true, day: "Saturday" },
  { id: "b6", name: "Batch F — 2025", fee: 3500, startTime: "11:00", endTime: "13:30", endYear: 2025, active: true, day: "Saturday" },
  { id: "b7", name: "Batch G — 2024 (Repeat)", fee: 3000, startTime: "14:00", endTime: "16:30", endYear: 2024, active: false, day: "Sunday" },
];

export const INIT_STUDENTS: Student[] = [
  { id: "s1", callupNo: "MA001", fullName: "Kavindra Perera", school: "Royal College, Colombo", address: "45/2, Gampaha Road, Kiribathgoda", nic: "200015600234", mobile: "0771234567", parentName: "Sunil Perera", parentMobile: "0112345678", notes: "", active: true, registrationDate: "2025-01-10", batchIds: ["b1"] },
  { id: "s2", callupNo: "MA002", fullName: "Nimali Fernando", school: "Visakha Vidyalaya, Colombo", address: "12, Temple Road, Nugegoda", nic: "200025600567", mobile: "0779876543", parentName: "Nimal Fernando", parentMobile: "0114567890", notes: "Needs extra attention in integration", active: true, registrationDate: "2025-01-10", batchIds: ["b1"] },
  { id: "s3", callupNo: "MA003", fullName: "Hasitha Jayawardena", school: "Ananda College, Colombo", address: "78, Main Street, Maharagama", nic: "200034500123", mobile: "0763456789", parentName: "Priyantha Jayawardena", parentMobile: "0774567890", notes: "", active: true, registrationDate: "2025-01-15", batchIds: ["b2"] },
  { id: "s4", callupNo: "MA004", fullName: "Dulani Wickramasinghe", school: "Devi Balika Vidyalaya, Colombo", address: "23, Station Road, Kalutara", nic: "200045600789", mobile: "0712345678", parentName: "Rohan Wickramasinghe", parentMobile: "0342234567", notes: "", active: true, registrationDate: "2025-01-15", batchIds: ["b1"] },
  { id: "s5", callupNo: "MA005", fullName: "Chamara Silva", school: "Dharmaraja College, Kandy", address: "67, Peradeniya Road, Kandy", nic: "200056700234", mobile: "0812345678", parentName: "Saman Silva", parentMobile: "0812345679", notes: "Travels from Kandy", active: true, registrationDate: "2025-02-01", batchIds: ["b2"] },
  { id: "s6", callupNo: "MA006", fullName: "Thilini Dissanayake", school: "Musaeus College, Colombo", address: "89, Dutugemunu Street, Dehiwala", nic: "200065400345", mobile: "0723456789", parentName: "Gamini Dissanayake", parentMobile: "0112234567", notes: "", active: true, registrationDate: "2025-02-01", batchIds: ["b3"] },
  { id: "s7", callupNo: "MA007", fullName: "Ruwan Bandara", school: "Nalanda College, Colombo", address: "34, Nawala Road, Rajagiriya", nic: "200075600456", mobile: "0774567890", parentName: "Bandara H.", parentMobile: "0114456789", notes: "", active: true, registrationDate: "2025-02-10", batchIds: ["b2"] },
  { id: "s8", callupNo: "MA008", fullName: "Sanduni Rathnayake", school: "Sirimavo Bandaranaike Vidyalaya", address: "56, Sri Jayawardenepura Road, Nugegoda", nic: "200085600567", mobile: "0745678901", parentName: "Kamal Rathnayake", parentMobile: "0115567890", notes: "", active: true, registrationDate: "2025-02-10", batchIds: ["b1", "b3"] },
  { id: "s9", callupNo: "MA009", fullName: "Dinusha Madushanka", school: "Thurstan College, Colombo", address: "23, High Level Road, Homagama", nic: "200095600678", mobile: "0756789012", parentName: "Madushanka W.", parentMobile: "0112678901", notes: "", active: true, registrationDate: "2025-03-01", batchIds: ["b3"] },
  { id: "s10", callupNo: "MA010", fullName: "Prabhath Herath", school: "Bandaranayake College, Gampaha", address: "12, Kandy Road, Gampaha", nic: "200105600789", mobile: "0767890123", parentName: "Herath P.", parentMobile: "0332789012", notes: "Outstanding performance", active: true, registrationDate: "2025-03-01", batchIds: ["b2"] },
  { id: "s11", callupNo: "MA011", fullName: "Anusha Gamage", school: "Holy Family Convent, Bambalapitiya", address: "78, Galle Road, Bambalapitiya", nic: "200115600890", mobile: "0778901234", parentName: "Gamage P.", parentMobile: "0112890123", notes: "", active: true, registrationDate: "2025-03-15", batchIds: ["b1"] },
  { id: "s12", callupNo: "MA012", fullName: "Tharaka Seneviratne", school: "S. Thomas College, Mt. Lavinia", address: "45, Beach Road, Mt. Lavinia", nic: "200125600901", mobile: "0789012345", parentName: "Seneviratne A.", parentMobile: "0112901234", notes: "", active: true, registrationDate: "2025-03-15", batchIds: ["b3"] },
  { id: "s13", callupNo: "MA013", fullName: "Sachini Kumarasinghe", school: "Visakha Vidyalaya, Colombo", address: "34, Havelock Road, Colombo 5", nic: "200135601012", mobile: "0790123456", parentName: "Kumarasinghe R.", parentMobile: "0112012345", notes: "", active: false, registrationDate: "2025-01-20", batchIds: ["b2"] },
  { id: "s14", callupNo: "MA014", fullName: "Ishara Rajapaksha", school: "Richmond College, Galle", address: "23, Lighthouse Street, Galle", nic: "200145601123", mobile: "0912345678", parentName: "Rajapaksha M.", parentMobile: "0912345679", notes: "Travels from Galle", active: true, registrationDate: "2025-04-01", batchIds: ["b2"] },
  { id: "s15", callupNo: "MA015", fullName: "Maneesha Wijesinghe", school: "Girls High School, Kandy", address: "67, D.S. Senanayake Veediya, Kandy", nic: "200155601234", mobile: "0812345679", parentName: "Wijesinghe D.", parentMobile: "0812345680", notes: "", active: true, registrationDate: "2025-04-01", batchIds: ["b3"] },
  { id: "s16", callupNo: "MA016", fullName: "Lahiru Gunawardena", school: "Mahinda College, Galle", address: "89, Hospital Road, Galle", nic: "200165601345", mobile: "0913456789", parentName: "Gunawardena K.", parentMobile: "0913456790", notes: "", active: true, registrationDate: "2025-04-15", batchIds: ["b1"] },
];

export const INIT_ATT: AttendanceRecord[] = (() => {
  const recs: AttendanceRecord[] = [];
  let id = 1;
  const dates = [
    "2025-04-05", "2025-04-12", "2025-04-19", "2025-04-26",
    "2025-05-03", "2025-05-10", "2025-05-17", "2025-05-24",
    "2025-06-07", "2025-06-14",
  ];
  INIT_STUDENTS.forEach((s) => {
    s.batchIds.forEach((bid) => {
      dates.forEach((date) => {
        recs.push({
          id: `att${id++}`,
          studentId: s.id,
          batchId: bid,
          date,
          present: s.active ? Math.random() > 0.18 : false,
        });
      });
    });
  });
  return recs;
})();

export const INIT_PAYMENTS: Payment[] = (() => {
  const pays: Payment[] = [];
  let id = 1;
  const months = ["2025-02", "2025-03", "2025-04", "2025-05"];
  INIT_STUDENTS.forEach((s) => {
    if (!s.active) return;
    s.batchIds.forEach((bid) => {
      const batch = INIT_BATCHES.find((b) => b.id === bid)!;
      months.forEach((month) => {
        if (Math.random() > 0.15) {
          pays.push({
            id: `pay${id}`,
            studentId: s.id,
            batchId: bid,
            month,
            amount: batch.fee,
            receiptNo: `RCP${String(id).padStart(4, "0")}`,
            date: `${month}-${String(Math.floor(Math.random() * 20) + 1).padStart(2, "0")}`,
          });
          id++;
        }
      });
    });
  });
  return pays;
})();

export const INIT_PAPERS: Paper[] = [
  { id: "p1", name: "Term Test 1 — Pure Mathematics", batchId: "b1", date: "2025-03-15", totalMarks: 100, published: true },
  { id: "p2", name: "Term Test 1 — Applied Mathematics", batchId: "b1", date: "2025-03-22", totalMarks: 100, published: true },
  { id: "p3", name: "Mid Term — Pure Mathematics", batchId: "b2", date: "2025-04-10", totalMarks: 100, published: true },
  { id: "p4", name: "Term Test 1 — Pure Mathematics", batchId: "b2", date: "2025-03-15", totalMarks: 100, published: true },
  { id: "p5", name: "Practice Paper — Integration", batchId: "b3", date: "2025-05-01", totalMarks: 50, published: true },
  { id: "p6", name: "Term Test 2 — Pure Mathematics", batchId: "b1", date: "2025-06-05", totalMarks: 100, published: false },
];

export const INIT_MARKS: Mark[] = (() => {
  const mks: Mark[] = [];
  let id = 1;
  INIT_PAPERS.forEach((p) => {
    const bStudents = INIT_STUDENTS.filter(
      (s) => s.batchIds.includes(p.batchId) && s.active
    );
    bStudents.forEach((s) => {
      const base = Math.floor(
        Math.random() * (p.totalMarks * 0.55) + p.totalMarks * 0.35
      );
      mks.push({
        id: `mk${id++}`,
        paperId: p.id,
        studentId: s.id,
        marks: Math.min(base, p.totalMarks),
      });
    });
  });
  return mks;
})();

export const INIT_MATERIALS: Material[] = [
  { id: "mat1", title: "Integration Techniques — Lecture Notes", type: "pdf", url: "#", batchIds: ["b1", "b2", "b3"], lessonId: "l1", uploadDate: "2025-05-10", expiryDate: null, accessCount: 87 },
  { id: "mat2", title: "Lecture 12 — Integration by Parts (Video)", type: "video", url: "https://drive.google.com", batchIds: ["b1", "b2"], lessonId: "l1", uploadDate: "2025-05-10", expiryDate: "2025-12-31", accessCount: 64 },
  { id: "mat3", title: "Differential Equations — Summary Sheet", type: "pdf", url: "#", batchIds: ["b1", "b2", "b3"], lessonId: "l2", uploadDate: "2025-04-25", expiryDate: null, accessCount: 102 },
  { id: "mat4", title: "Lecture 8 — Second Order DEs (Recording)", type: "video", url: "https://drive.google.com", batchIds: ["b2", "b3"], lessonId: "l2", uploadDate: "2025-04-25", expiryDate: "2025-12-31", accessCount: 45 },
  { id: "mat5", title: "Vectors — Past Paper Collection 2015–2023", type: "pdf", url: "#", batchIds: ["b1"], lessonId: "l3", uploadDate: "2025-03-15", expiryDate: null, accessCount: 123 },
  { id: "mat6", title: "AL 2019 Combined Maths Paper (Official)", type: "link", url: "https://nie.lk", batchIds: ["b1", "b2", "b3"], lessonId: "l4", uploadDate: "2025-03-01", expiryDate: null, accessCount: 156 },
  { id: "mat7", title: "Complex Numbers — Argand Diagrams Notes", type: "pdf", url: "#", batchIds: ["b1", "b2", "b3"], lessonId: "l6", uploadDate: "2025-05-22", expiryDate: null, accessCount: 31 },
];

export const INIT_LESSONS: Lesson[] = [
  { id: "l1", title: "Integration Techniques", topic: "Pure Mathematics", batchIds: ["b1", "b2", "b3"], date: "2025-05-10" },
  { id: "l2", title: "Differential Equations", topic: "Pure Mathematics", batchIds: ["b1", "b2", "b3"], date: "2025-04-25" },
  { id: "l3", title: "Vectors and 3D Geometry", topic: "Pure Mathematics", batchIds: ["b1"], date: "2025-03-15" },
  { id: "l4", title: "Mechanics — Projectile Motion", topic: "Applied Mathematics", batchIds: ["b1", "b2"], date: "2025-03-01" },
  { id: "l5", title: "Statistics — Normal Distribution", topic: "Applied Mathematics", batchIds: ["b2", "b3"], date: "2025-02-15" },
  { id: "l6", title: "Complex Numbers", topic: "Pure Mathematics", batchIds: ["b1", "b2", "b3"], date: "2025-05-20" },
];

export const INIT_MESSAGES: CMessage[] = [
  { id: "msg1", type: "whatsapp", subject: "Class Cancellation — May 31", content: "Dear Students, this Saturday's class (May 31) is cancelled due to a public holiday. The class will be rescheduled. We apologise for the inconvenience.", batchIds: ["b1", "b2", "b3"], sentDate: "2025-05-28 10:30", status: "sent" },
  { id: "msg2", type: "email", subject: "Term Test 1 Results Published", content: "Dear Students, the results for Term Test 1 (Pure Mathematics) have been published. Please log in to the student portal to view your results and rank.", batchIds: ["b1"], sentDate: "2025-04-01 14:00", status: "sent" },
  { id: "msg3", type: "sms", subject: "Fee Reminder — May 2025", content: "Reminder: Your class fee for May 2025 is due. Please pay by May 15. Receipt required at next class.", batchIds: ["b1", "b2", "b3"], sentDate: "2025-05-10 09:00", status: "sent" },
  { id: "msg4", type: "whatsapp", subject: "New Materials Uploaded", content: "Integration Techniques notes and the lecture recording have been uploaded to the student portal. Check them out!", batchIds: ["b1", "b2"], sentDate: "2025-05-11 11:00", status: "sent" },
  { id: "msg5", type: "email", subject: "Class Schedule — June 2025", content: "Dear Students, please find attached the revised class schedule for June 2025. Note the additional makeup class on June 21.", batchIds: ["b1", "b2", "b3"], sentDate: "2025-05-30 09:00", status: "scheduled" },
];
