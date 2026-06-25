import React from 'react';
import { Calendar, Users, IndianRupee, Award, Smile } from 'lucide-react';

export default function BottomNav({ activeTab, setActiveTab }) {
  const navItems = [
    { id: 'today', label: 'Today', icon: Calendar },
    { id: 'students', label: 'Students', icon: Users },
    { id: 'tests', label: 'Tests', icon: Award },
    { id: 'fees', label: 'Fees', icon: IndianRupee },
    { id: 'behaviour', label: 'Behaviour', icon: Smile },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-4 py-2 flex justify-around items-center safe-bottom z-50 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`flex flex-col items-center justify-center py-1 px-4 rounded-xl transition-all duration-250 ${
              isActive 
                ? 'text-indigo-600 font-semibold scale-105' 
                : 'text-slate-500 hover:text-indigo-500'
            }`}
          >
            <Icon className={`w-6 h-6 transition-transform duration-200 ${isActive ? 'stroke-[2.5px]' : 'stroke-[2px]'}`} />
            <span className="text-[10px] mt-1 tracking-wide">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
