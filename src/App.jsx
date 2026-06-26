import React, { useState } from 'react';
import Dashboard from './pages/Dashboard';
import TodayManager from './pages/TodayManager';
import StudentsList from './pages/StudentsList';
import StudentProfile from './pages/StudentProfile';
import StudentForm from './pages/StudentForm';
import FeesManager from './pages/FeesManager';
import TestsManager from './pages/TestsManager';
import BehaviourManager from './pages/BehaviourManager';
import BottomNav from './components/BottomNav';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentView, setCurrentView] = useState({ name: null, params: {} });

  // Navigation router helper
  const navigate = (viewName, viewParams = {}) => {
    // If navigating to one of the main tabs, reset detailed view
    if (['dashboard', 'students', 'tests', 'fees', 'behaviour'].includes(viewName)) {
      setActiveTab(viewName);
      setCurrentView({ name: null, params: {} });
    } else {
      setCurrentView({ name: viewName, params: viewParams });
    }
  };

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setCurrentView({ name: null, params: {} });
  };

  // Determine which page component to render
  const renderContent = () => {
    if (currentView.name) {
      switch (currentView.name) {
        case 'student-profile':
          return <StudentProfile params={currentView.params} navigate={navigate} />;
        case 'add-student':
        case 'edit-student':
          return <StudentForm params={currentView.params} navigate={navigate} />;
        case 'today':
          return <TodayManager navigate={navigate} />;
        default:
          break;
      }
    }

    // Default to active tab components
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard navigate={navigate} />;
      case 'students':
        return <StudentsList navigate={navigate} />;
      case 'tests':
        return <TestsManager params={currentView.params} navigate={navigate} />;
      case 'fees':
        return <FeesManager navigate={navigate} />;
      case 'behaviour':
        return <BehaviourManager navigate={navigate} />;
      default:
        return <Dashboard navigate={navigate} />;
    }
  };

  // Show navigation bar only on main tabs, not on details/forms for clean mobile UX
  const shouldShowNav = !currentView.name;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 antialiased selection:bg-indigo-100 select-none pb-safe">
      {/* Main Content Area */}
      <main className="w-full">
        {renderContent()}
      </main>

      {/* Bottom Navigation */}
      {shouldShowNav && (
        <BottomNav activeTab={activeTab} setActiveTab={handleTabChange} />
      )}
    </div>
  );
}
