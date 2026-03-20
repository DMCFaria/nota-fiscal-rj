import { Outlet } from "react-router-dom";
import { useState, useEffect } from "react";
import Sidebar from "../components/Sidebar/Sidebar";
import Breadcrumb from "../components/Breadcrumb/Breadcrumb";
import "../styles/mainlayout.css";

export default function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      
      // Comportamento diferente para mobile e desktop
      if (mobile) {
        setSidebarOpen(false); // Mobile começa com sidebar fechada
      } else {
        setSidebarOpen(true); // Desktop sempre começa com sidebar aberta
      }
    };

    handleResize(); // Executa uma vez no início
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleSidebar = () => {
    // Só permite alternar a sidebar em mobile
    if (isMobile) {
      setSidebarOpen(!sidebarOpen);
    }
    // Em desktop, o menu hambúrguer não faz nada
  };

  const closeSidebar = () => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  return (
    <div className="main-layout">
      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={closeSidebar}
        isMobile={isMobile}
      />
      
      {/* Overlay para mobile - só aparece quando sidebar está aberta em mobile */}
      {isMobile && sidebarOpen && (
        <div 
          className="sidebar-overlay active" 
          onClick={closeSidebar}
        />
      )}
      
      <div className="main-content">
        <Breadcrumb 
          onMenuClick={toggleSidebar} 
          sidebarOpen={sidebarOpen}
          isMobile={isMobile}
        />
        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}