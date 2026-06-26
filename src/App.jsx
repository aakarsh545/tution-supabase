import React, { useState, useEffect } from 'react';
import Dashboard from './pages/Dashboard';
import TodayManager from './pages/TodayManager';
import StudentsList from './pages/StudentsList';
import StudentProfile from './pages/StudentProfile';
import StudentForm from './pages/StudentForm';
import FeesManager from './pages/FeesManager';
import TestsManager from './pages/TestsManager';
import BehaviourManager from './pages/BehaviourManager';
import BottomNav from './components/BottomNav';
import CalendarView from './pages/CalendarView';
import StudentAttendanceCalendar from './pages/StudentAttendanceCalendar';
import EditAttendance from './pages/EditAttendance';
import { App as CapApp } from '@capacitor/app';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentView, setCurrentView] = useState({ name: null, params: {} });

  const goBack = () => {
    if (currentView.name) {
      switch (currentView.name) {
        case 'student-attendance-calendar':
          navigate('student-profile', { id: currentView.params.id });
          break;
        case 'student-profile':
          navigate('students');
          break;
        case 'add-student':
          navigate('students');
          break;
        case 'edit-student':
          navigate('student-profile', { id: currentView.params.id });
          break;
        case 'today':
          navigate('dashboard');
          break;
        case 'calendar':
          navigate('dashboard');
          break;
        case 'edit-attendance':
          navigate('dashboard');
          break;
        default:
          navigate('dashboard');
          break;
      }
    } else {
      if (activeTab !== 'dashboard') {
        navigate('dashboard');
      }
    }
  };

  useEffect(() => {
    const listenerPromise = CapApp.addListener('backButton', () => {
      const isDashboard = !currentView.name && activeTab === 'dashboard';
      if (isDashboard) {
        CapApp.minimizeApp();
      } else {
        goBack();
      }
    });

    window.__triggerBackButton = () => {
      const isDashboard = !currentView.name && activeTab === 'dashboard';
      if (isDashboard) {
        console.log("App minimized");
      } else {
        goBack();
      }
    };

    return () => {
      listenerPromise.then(h => h.remove());
      delete window.__triggerBackButton;
    };
  }, [currentView, activeTab]);

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
        case 'calendar':
          return <CalendarView navigate={navigate} />;
        case 'student-attendance-calendar':
          return <StudentAttendanceCalendar params={currentView.params} navigate={navigate} />;
        case 'edit-attendance':
          return <EditAttendance navigate={navigate} />;
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
