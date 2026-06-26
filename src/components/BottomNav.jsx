import React from 'react';
import { Home, Users, IndianRupee, Award, Smile } from 'lucide-react';

export default function BottomNav({ activeTab, setActiveTab }) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'students', label: 'Students', icon: Users },
    { id: 'fees', label: 'Fees', icon: IndianRupee },
    { id: 'behaviour', label: 'Behaviour', icon: Smile },
    { id: 'tests', label: 'Tests', icon: Award },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-between items-center safe-bottom z-50 shadow-[0_-4px_12px_rgba(0,0,0,0.03)] h-14">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`flex-1 flex flex-col items-center justify-center py-1.5 px-0.5 transition-all duration-200 ${
              isActive 
                ? 'text-indigo-600 font-bold scale-[1.02]' 
                : 'text-slate-500 hover:text-indigo-500'
            }`}
          >
            <Icon className={`w-5 h-5 transition-transform duration-200 ${isActive ? 'stroke-[2.5px]' : 'stroke-[2px]'}`} />
            <span className="text-[10px] font-medium mt-1 tracking-tight truncate leading-none">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
