import React, { useState } from "react";
import { format, addDays } from "date-fns";
import AutoScheduleBuilder from "../components/shifts/AutoScheduleBuilder";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

function getWeekStart(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function TestAutoSchedule() {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const weekStart = getWeekStart(selectedDate);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50" dir="rtl">
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-indigo-300/20 rounded-full blur-3xl" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-purple-300/20 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-8">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <button
            onClick={() => navigate("/admin/shifts")}
            className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800 font-semibold mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            חזרה לדוח שיבוץים
          </button>
          <h1 className="text-3xl font-extrabold text-slate-800">🧪 סביבת טסט - יצירת שיבוץ אוטומטי</h1>
          <p className="text-slate-500 mt-2">בחר שבוע לבדיקה (לא משמרת נתונים)</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-6 rounded-2xl bg-white border border-slate-200 p-6 shadow-md">
          <label className="block text-sm font-semibold text-slate-700 mb-3">בחר תאריך להצגת השבוע:</label>
          <input
            type="date"
            value={format(selectedDate, "yyyy-MM-dd")}
            onChange={e => setSelectedDate(new Date(e.target.value))}
            className="w-full border border-slate-300 rounded-lg px-4 py-2 outline-none focus:border-indigo-400 text-right"
          />
          <p className="text-xs text-slate-400 mt-2">
            שבוע: {format(weekStart, "dd/MM")} – {format(addDays(weekStart, 4), "dd/MM/yyyy")}
          </p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <AutoScheduleBuilder weekStart={weekStart} />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mt-8 rounded-2xl bg-amber-50 border border-amber-200 p-4">
          <h3 className="font-bold text-amber-900 mb-2">💡 דברים לבדוק:</h3>
          <ul className="text-sm text-amber-800 space-y-1 list-disc list-inside">
            <li>לחץ "צור שיבוץ" וראה את התוצאה ב-Console (F12)</li>
            <li>שנה קלט על ידי עריכת הSelect בטבלה</li>
            <li>צפה בקבוצות שונות של אילוצים והשפעתם על השיבוץ</li>
            <li>לחץ "אשר ושמור" אם ברצונך לשמור (יוצר בדוק/אמיתי!)</li>
          </ul>
        </motion.div>
      </div>
    </div>
  );
}